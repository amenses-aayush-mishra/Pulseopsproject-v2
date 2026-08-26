/**
 * aiSummaryApi.js
 *
 * Plain-CJS API module for the AI Summary panel — separated out from the
 * JSX component so Node's console-script tests can exercise the fetch/mapping
 * logic without a JSX/CSS transpiler (the repo has no Babel/esbuild in the client,
 * and next-api helpers are baked into Next's internal compiler only).
 */
const API_BASE = process.env.NEXT_PUBLIC_EXPRESS_API_URL || 'http://localhost:5000';

const LATEST_ENDPOINT = `${API_BASE}/api/ai-summaries/latest`;
const GENERATE_ENDPOINT = `${API_BASE}/api/ai-summaries`;

async function fetchLatestSummary(organizationId) {
  try {
    const res = await fetch(
      `${LATEST_ENDPOINT}?organizationId=${encodeURIComponent(organizationId)}`
    );
    if (res.status === 404) return null;
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(json?.message || json?.error || `Failed to fetch latest summary (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return json?.data || null;
  } catch (err) {
    if (err?.status === 404) return null;
    throw err;
  }
}

async function generateSummary(organizationId, type = 'weekly') {
  const res = await fetch(GENERATE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organizationId, type }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.message || json?.error || `Failed to generate summary (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return json?.data || null;
}

module.exports = { API_BASE, fetchLatestSummary, generateSummary };