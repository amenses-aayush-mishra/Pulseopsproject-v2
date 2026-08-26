'use strict';
const dns = require('dns');

/**
 * SSRF-protected link preview fetching.
 *
 * Only metadata (title/description/og:image) is ever extracted and persisted —
 * fetched page bytes are never stored or returned to the API. Every URL is
 * guarded before fetching and on every redirect:
 *   - http/https schemes only, no URL-embedded credentials
 *   - hostname is resolved and EACH resolved IP is checked against a blocklist
 *     (private/loopback/link-local/CGN/literal 0, multicast, reserved, IPv6
 *     equivalents) — a DNS-rebinding countermeasure for the resolved set
 *   - body read is streamed with a hard size cap + timeout; content-type must
 *     be HTML
 */

const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 6000;
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB metadata budget

// Inclusive IPv4 ranges that are never allowed.
const PRIVATE_RANGES = [
  ['0.0.0.0', '0.255.255.255'],
  ['10.0.0.0', '10.255.255.255'],
  ['127.0.0.0', '127.255.255.255'],
  ['100.64.0.0', '100.127.255.255'],
  ['169.254.0.0', '169.254.255.255'],
  ['172.16.0.0', '172.31.255.255'],
  ['192.168.0.0', '192.168.255.255'],
  ['224.0.0.0', '239.255.255.255'],
  ['240.0.0.0', '255.255.255.255'],
];

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;

class LinkError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

/** "1.2.3.4" -> unsigned 32-bit integer. */
function ipv4ToInt(ip) {
  const p = ip.split('.').map(Number);
  return p[0] * 16777216 + p[1] * 65536 + p[2] * 256 + p[3];
}

function isPrivateIpv4(ip) {
  const n = ipv4ToInt(ip);
  for (const [from, to] of PRIVATE_RANGES) {
    if (n >= ipv4ToInt(from) && n <= ipv4ToInt(to)) return true;
  }
  return false;
}

function isPrivateIpv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === '::' || lower === '::1') return true;
  // Unique local fc00::/7
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  // Link-local fe80::/10
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true;
  // IPv4-mapped (::ffff:a.b.c.d) — delegate to the IPv4 checker.
  if (lower.startsWith('::ffff:') && !lower.includes('.')) return true;
  if (lower.startsWith('::ffff:')) return isPrivateIpv4(lower.slice(7));
  return false;
}

function isPrivateIp(ip) {
  return ip.includes(':') ? isPrivateIpv6(ip) : isPrivateIpv4(ip);
}

/** Normalise a raw URL string into a canonical URL (or null when invalid). */
function normalizeUrl(raw) {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password) return null;
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Extract unique http(s) URLs from message text, with trailing punctuation
 * stripped and invalid URLs discarded.
 */
function extractUrls(text) {
  const found = new Set();
  const value = text || '';
  let m;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(value)) !== null) {
    const cleaned = m[0].replace(/[)}\]>'".,;:!?]+$/, '');
    const normalized = normalizeUrl(cleaned);
    if (normalized) found.add(normalized);
  }
  return [...found];
}

/** Hostname only (used by the UI badge). */
function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

/**
 * SSRF check: scheme/credential rules + resolve the hostname and reject if ANY
 * resolved address is unusable.
 */
async function isSafeUrl(rawUrl) {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) return false;
  const parsed = new URL(normalized);
  const hostname = parsed.hostname.replace(/^\[(.*)\]$/, '$1');
  const resolved = new Set();

  // Literal IPv4 form — check directly.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    if (hostname.split('.').some((o) => Number(o) > 255)) return false;
    return !isPrivateIpv4(hostname);
  }

  try {
    const [a4, a6] = await Promise.all([
      dns.promises.resolve4(hostname).catch(() => []),
      dns.promises.resolve6(hostname).catch(() => []),
    ]);
    for (const ip of [...a4, ...a6]) resolved.add(ip);
  } catch {
    return false;
  }
  if (resolved.size === 0) return false;
  for (const ip of resolved) {
    if (isPrivateIp(ip)) return false;
  }
  return true;
}

/** Minimal HTML entity decoding for title/description strings. */
function decodeEntities(text) {
  return String(text)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** Pull og:/meta/title metadata out of the head of the document. */
function parseMetadata(html, baseUrl) {
  const head = String(html).slice(0, 256 * 1024);
  const first = (...patterns) => {
    for (const re of patterns) {
      const m = head.match(re);
      if (m && m[1]) {
        const value = decodeEntities(m[1].trim().replace(/\s+/g, ' ')).slice(0, 300);
        if (value) return value;
      }
    }
    return null;
  };

  const title = first(
    /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*name=["']title["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i
  );
  const description = first(
    /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i
  );
  let imageUrl = first(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  if (imageUrl) {
    const resolved = normalizeUrl(new URL(imageUrl, baseUrl).toString());
    imageUrl = resolved || null;
  }

  return { title, description, imageUrl };
}

/** Stream the response body with a hard byte cap (never buffers the world). */
async function readBodyCapped(res, maxBytes) {
  const reader = res.body && res.body.getReader
    ? res.body.getReader()
    : null;
  if (!reader) throw new LinkError('empty_body');
  const chunks = [];
  const decoder = new TextDecoder('utf-8');
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      reader.cancel().catch(() => {});
      throw new LinkError('body_too_large');
    }
    chunks.push(decoder.decode(value, { stream: true }));
  }
  chunks.push(decoder.decode());
  return chunks.join('');
}

/**
 * Fetch an external URL and return its preview metadata. Every hop (including
 * each redirect target) is re-validated with isSafeUrl.
 * @returns {Promise<{title:string|null, description:string|null, imageUrl:string|null}>}
 */
async function fetchPreview(rawUrl, redirects = 0) {
  if (redirects > MAX_REDIRECTS) throw new LinkError('too_many_redirects');
  const url = normalizeUrl(rawUrl);
  if (!url) throw new LinkError('invalid_url');
  if (!(await isSafeUrl(url))) throw new LinkError('ssrf_blocked');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'User-Agent': 'PulseOpsLinkBot/1.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
  } catch {
    throw new LinkError('fetch_failed');
  } finally {
    clearTimeout(timer);
  }

  try {
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get('location');
      res.body && res.body.cancel && res.body.cancel().catch(() => {});
      if (!location) throw new LinkError('redirect_no_location');
      return fetchPreview(new URL(location, url).toString(), redirects + 1);
    }
    if (res.status !== 200) throw new LinkError(`http_${res.status}`);

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('html')) throw new LinkError('non_html');

    const html = await readBodyCapped(res, MAX_BODY_BYTES);
    return parseMetadata(html, url);
  } finally {
    if (res && res.body && res.body.cancel) res.body.cancel().catch(() => {});
  }
}

module.exports = {
  extractUrls,
  normalizeUrl,
  domainOf,
  isSafeUrl,
  fetchPreview,
  parseMetadata,
  isPrivateIpv4,
  isPrivateIpv6,
  LinkError,
  MAX_BODY_BYTES,
  MAX_REDIRECTS,
  FETCH_TIMEOUT_MS,
};