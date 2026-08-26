/*
 * Route tests for ai-summaries.js
 *
 * Follows the existing console-script test pattern (no jest / supertest — they
 * are not project dependencies). It mocks the Mongoose model + AI services via
 * require.cache, mounts the real router on an ephemeral express app, and
 * exercises every endpoint over real HTTP using Node's global fetch.
 *
 * Run: node server/src/routes/ai-summaries.route.test.js
 */
const express = require('express');
const path = require('path');

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
  return condition;
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const sampleActivities = [
  { source: 'github', type: 'pr_merged', actor: 'alice', timestamp: new Date(), metadata: { prTitle: 'feat: onboard flow' } },
  { source: 'slack', type: 'message', actor: 'bob', timestamp: new Date(), metadata: { text: 'hello' } }
];

const sampleSummaryData = {
  summary: 'Team showed strong velocity this week with increased PR activity.',
  key_metrics: {
    prs_merged: 15,
    prs_opened: 20,
    active_developers: 8,
    jira_issues_completed: 12,
    jira_issues_created: 18,
    slack_messages: 450
  },
  top_contributors: ['alice@example.com', 'bob@example.com'],
  risks: ['PR review delays', 'Technical debt accumulation'],
  recommendations: ['Increase code review bandwidth', 'Schedule refactoring sprint']
};

const sampleSummaryDoc = {
  _id: '507f1f77bcf86cd799439011',
  organizationId: 'org123',
  type: 'weekly_summary',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-07'),
  generatedAt: new Date(),
  ...sampleSummaryData
};

// Chainable mongoose query stub (supports .sort().skip().limit().lean().exec()).
function queryChain(execFn) {
  const chain = {
    sort: () => chain,
    skip: () => chain,
    limit: () => chain,
    lean: () => chain,
    exec: async () => execFn()
  };
  return chain;
}

const MockAISummary = {
  config: {
    findOneResult: null,
    findOneError: null,
    findResults: [],
    findError: null,
    countTotal: 0,
    createResult: null
  },
  lastCreate: null,
  findOne() {
    return queryChain(() => {
      if (this.config.findOneError) throw this.config.findOneError;
      return this.config.findOneResult;
    });
  },
  find() {
    return queryChain(() => {
      if (this.config.findError) throw this.config.findError;
      return this.config.findResults;
    });
  },
  countDocuments() {
    return Promise.resolve(this.config.countTotal);
  },
  create(payload) {
    this.lastCreate = payload;
    return Promise.resolve(this.config.createResult || payload);
  }
};

const MockActivityService = {
  config: { activities: [] },
  lastOpts: null,
  async getActivityForRange(opts) {
    MockActivityService.lastOpts = opts;
    return MockActivityService.config.activities;
  }
};

const MockContextBuilder = {
  buildContext: () => '## Engineering Activity Context'
};

const MockGeminiService = {
  config: { summaryData: sampleSummaryData },
  lastCall: null,
  geminiService: {
    async generateSummary(context, type) {
      MockGeminiService.lastCall = { context, type };
      return MockGeminiService.config.summaryData;
    }
  }
};

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

/**
 * Point require() at a fake module before the route module loads.
 * @param {string} rel - Module path relative to the route directory
 * @param {*} fake - Fake exports to serve instead
 */
function installMock(rel, fake) {
  const file = require.resolve(path.join(__dirname, rel));
  require.cache[file] = { id: file, filename: file, loaded: true, exports: fake };
}

async function main() {
  installMock('../services/ai/activity.service', MockActivityService);
  installMock('../ai/services/context-builder.service', MockContextBuilder);
  installMock('../services/ai/gemini.service', MockGeminiService);
  installMock('../models/AISummary', MockAISummary);

  const router = require('./ai-summaries');

  const app = express();
  app.use(express.json());
  app.use('/api/ai-summaries', router);

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/ai-summaries`;

  async function req(method, url, body) {
    const opts = { method, headers: {} };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(base + url, opts);
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (_) { json = text; }
    return { status: res.status, json };
  }

  try {
    await runTests(router, req);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log(`\n📊 ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

async function runTests(router, req) {
  console.log('🧪 Running AI Summaries Route Tests...\n');

  // --- normalizeSummaryType (unit) ----------------------------------------
  check('type map: weekly -> weekly_summary', router.normalizeSummaryType('weekly') === 'weekly_summary');
  check('type map: weekly_summary unchanged', router.normalizeSummaryType('weekly_summary') === 'weekly_summary');
  check('type map: MONTHLY -> monthly_summary', router.normalizeSummaryType('MONTHLY') === 'monthly_summary');
  check('type map: quarterly -> quarterly_summary', router.normalizeSummaryType('quarterly') === 'quarterly_summary');
  check('type map: default (no arg) -> weekly_summary', router.normalizeSummaryType() === 'weekly_summary');
  let threw = false;
  try { router.normalizeSummaryType('bogus'); } catch (_) { threw = true; }
  check('type map: invalid type throws', threw);

  // --- GET /latest --------------------------------------------------------
  MockAISummary.config.findOneResult = null;
  const latestNoOrg = await req('GET', '/latest');
  check('GET /latest missing org -> 400', latestNoOrg.status === 400 && latestNoOrg.json.error === 'organizationId is required', JSON.stringify(latestNoOrg.json));

  MockAISummary.config.findOneResult = sampleSummaryDoc;
  const latestOk = await req('GET', '/latest?organizationId=org123');
  check('GET /latest returns latest summary', latestOk.status === 200 && latestOk.json.data && latestOk.json.data._id === sampleSummaryDoc._id, JSON.stringify(latestOk.json));

  MockAISummary.config.findOneResult = null;
  const latestEmpty = await req('GET', '/latest?organizationId=org123');
  check('GET /latest 404 with data:null', latestEmpty.status === 404 && latestEmpty.json.data === null && !!latestEmpty.json.message, JSON.stringify(latestEmpty.json));

  // --- GET / (paginated list) ---------------------------------------------
  const listNoOrg = await req('GET', '/');
  check('GET / missing org -> 400', listNoOrg.status === 400);

  MockAISummary.config.findResults = [sampleSummaryDoc];
  MockAISummary.config.countTotal = 25;
  const listOk = await req('GET', '/?organizationId=org123&limit=5&offset=10');
  const pag = listOk.json.pagination;
  check('GET / returns data array', listOk.status === 200 && Array.isArray(listOk.json.data));
  check('GET / pagination fields + hasMore', !!pag && pag.total === 25 && pag.limit === 5 && pag.offset === 10 && pag.hasMore === true, JSON.stringify(pag));

  const listClamped = await req('GET', '/?organizationId=org123&limit=9999&offset=-5');
  const pagC = listClamped.json.pagination;
  check('GET / clamps limit to 50, offset to 0', !!pagC && pagC.limit === 50 && pagC.offset === 0, JSON.stringify(pagC));

  const listLastPage = await req('GET', '/?organizationId=org123&limit=10&offset=20');
  check('GET / hasMore false on last page', !!listLastPage.json.pagination && listLastPage.json.pagination.hasMore === false);

  // --- GET /:id -----------------------------------------------------------
  const idNoOrg = await req('GET', '/507f1f77bcf86cd799439011');
  check('GET /:id missing org -> 400', idNoOrg.status === 400);

  MockAISummary.config.findOneResult = sampleSummaryDoc;
  const idOk = await req('GET', '/507f1f77bcf86cd799439011?organizationId=org123');
  check('GET /:id returns summary', idOk.status === 200 && idOk.json.data._id === sampleSummaryDoc._id, JSON.stringify(idOk.json));

  MockAISummary.config.findOneResult = null;
  const idMissing = await req('GET', '/507f1f77bcf86cd799439011?organizationId=org123');
  check('GET /:id 404 not found', idMissing.status === 404 && idMissing.json.message === 'AI summary not found');

  const castErr = new Error('Cast to ObjectId failed');
  castErr.name = 'CastError';
  MockAISummary.config.findOneError = castErr;
  const idBad = await req('GET', '/not-an-objectid?organizationId=org123');
  check('GET /:id invalid ObjectId -> 400', idBad.status === 400 && idBad.json.error === 'Invalid summary ID format', JSON.stringify(idBad.json));
  MockAISummary.config.findOneError = null;

// --- POST / (generate + save) -------------------------------------------
  const postNoOrg = await req('POST', '/', { type: 'weekly' });
  check('POST missing org -> 400', postNoOrg.status === 400 && postNoOrg.json.error === 'organizationId is required', JSON.stringify(postNoOrg.json));

  const postBadType = await req('POST', '/', { organizationId: 'org123', type: 'bogus' });
  check('POST invalid type -> 400', postBadType.status === 400);

  MockActivityService.config.activities = [];
  const postNoActivity = await req('POST', '/', { organizationId: 'org123', type: 'weekly' });
  check('POST no activities -> 400', postNoActivity.status === 400 && postNoActivity.json.error === 'Not enough activity to summarize', JSON.stringify(postNoActivity.json));

  const postBadDate = await req('POST', '/', { organizationId: 'org123', type: 'weekly', startDate: 'not-a-date' });
  check('POST invalid date -> 400', postBadDate.status === 400);

  const postReversed = await req('POST', '/', { organizationId: 'org123', startDate: '2024-01-07', endDate: '2024-01-01' });
  check('POST start > end -> 400', postReversed.status === 400);

  MockActivityService.config.activities = sampleActivities;
  const postOk = await req('POST', '/', {
    organizationId: 'org123',
    type: 'weekly',
    startDate: '2024-01-01',
    endDate: '2024-01-07'
  });
  check('POST success -> 201', postOk.status === 201 && postOk.json.message === 'AI summary generated successfully', JSON.stringify(postOk.json));
  check('POST persists normalized enum type', MockAISummary.lastCreate && MockAISummary.lastCreate.type === 'weekly_summary', JSON.stringify(MockAISummary.lastCreate));
  check('POST persists key_metrics + generatedAt', MockAISummary.lastCreate && MockAISummary.lastCreate.key_metrics === sampleSummaryData.key_metrics && MockAISummary.lastCreate.generatedAt instanceof Date);
  check('POST feeds activity context + short type to Gemini', MockGeminiService.lastCall && MockGeminiService.lastCall.context === '## Engineering Activity Context' && MockGeminiService.lastCall.type === 'weekly');

  console.log('\n🧪 Route tests completed.');
}

main().catch((error) => {
  console.error('❌ Test harness crashed:', error);
  process.exit(1);
});