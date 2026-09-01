/*
 * Test for aiSummaryApi.js (pulseops client).
 *
 * Follows the repo's console-script pattern (no jest/vitest in node_modules).
 * Mocks global.fetch / axios semantics by stubbing the global fetch then
 * calling the module's exported functions, asserting on shape + error handling.
 *
 * Run: node client/app/_components/aiSummaryApi.test.js
 */
const assert = require('assert');

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`✅ ${name}`);
  } else {
    failed++;
    console.log(`❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// ---------------------------------------------------------------------------
// Helpers: stub global fetch, restore after each case
// ---------------------------------------------------------------------------
const realFetch = global.fetch;
let fetchStub;

function stubFetch(impl) {
  fetchStub = impl;
  global.fetch = async (...args) => impl(...args);
}

function restoreFetch() {
  global.fetch = realFetch;
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

// We must load the module AFTER we can override process.env, so require it lazily.
const { fetchLatestSummary, generateSummary, API_BASE } = require('./aiSummaryApi');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
async function runTests() {
  console.log('🧪 Running aiSummaryApi tests...\n');
  check('API_BASE defaults to localhost:5000 in tests', API_BASE === 'http://localhost:5000', API_BASE);

  try {
    // 1) fetchLatestSummary — resolves .data on 200
    stubFetch(async (url) => {
      check('latest GET URL encodes organizationId', String(url).includes('organizationId=org_123'), url);
      return jsonResponse(200, { data: { _id: 'x', summary: 'hi' } });
    });
    const s1 = await fetchLatestSummary('org_123');
    check('fetchLatestSummary returns .data on 200', s1 && s1._id === 'x', JSON.stringify(s1));

    // 2) fetchLatestSummary — returns null on 404
    stubFetch(async () => jsonResponse(404, { message: 'none' }));
    const s2 = await fetchLatestSummary('org_123');
    check('fetchLatestSummary returns null on 404 (empty state)', s2 === null, JSON.stringify(s2));

    // 3) fetchLatestSummary — throws on other errors
    stubFetch(async () => jsonResponse(500, { error: 'boom' }));
    let threw = false;
    try { await fetchLatestSummary('org_123'); } catch (_) { threw = true; }
    check('fetchLatestSummary throws on 500', threw);

    // 4) generateSummary — POSTs body and returns .data
    stubFetch(async (url, opts) => {
      check('generateSummary POSTs to /api/ai-summaries', String(url).endsWith('/api/ai-summaries'), url);
      check('generateSummary POST method', opts.method === 'POST');
      const body = JSON.parse(opts.body);
      check('generateSummary body has organizationId', body.organizationId === 'org_123');
      check('generateSummary body defaults type weekly', body.type === 'weekly');
      return jsonResponse(201, { data: { _id: 'new', generatedAt: new Date().toISOString() } });
    });
    const g1 = await generateSummary('org_123');
    check('generateSummary returns .data on 201', g1 && g1._id === 'new', JSON.stringify(g1));

    // 5) generateSummary — throws on error
    stubFetch(async () => jsonResponse(400, { error: 'No activities' }));
    let threwGen = false;
    try { await generateSummary('org_123'); } catch (_) { threwGen = true; }
    check('generateSummary throws on 400', threwGen);

    // 6) generateSummary & fetchLatestSummary — sends Authorization & x-organization-id when token provided
    stubFetch(async (url, opts) => {
      check('auth headers include Bearer token', opts.headers?.Authorization === 'Bearer secret_token');
      check('auth headers include x-organization-id', opts.headers?.['x-organization-id'] === 'org_123');
      return jsonResponse(200, { data: { _id: 'auth_ok' } });
    });
    await fetchLatestSummary('org_123', 'secret_token');
    await generateSummary('org_123', 'weekly', 'secret_token');

  } finally {
    restoreFetch();
  }

  console.log(`\n📊 ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error('❌ Test harness crashed:', error);
  process.exit(1);
});