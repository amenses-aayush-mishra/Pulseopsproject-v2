/*
 * Ticket 3 — activity.service tests (T3-01 … T3-07).
 *
 * Console-script pattern. Mocks the Activity model via require.cache so query
 * construction/filtering is asserted without a live MongoDB.
 *
 * Run: node server/src/services/ai/activity.service.test.js
 */
const path = require('path');

let passed = 0;
let failed = 0;
function check(name, cond, detail = '') {
  if (cond) { passed++; console.log(`✅ ${name}`); }
  else { failed++; console.log(`❌ ${name}${detail ? ` — ${detail}` : ''}`); }
}

// ---------------------------------------------------------------------------
// Mock Activity model capturing the query passed to find().
// ---------------------------------------------------------------------------
const capturedQueries = [];
const MockActivityModel = {
  lastQuery: null,
  sortArgs: null,
  config: { results: [] },
  find(query) {
    this.lastQuery = query;
    capturedQueries.push(query);
    const chain = {
      sort: (arg) => { this.sortArgs = arg; return chain; },
      lean: () => chain,
      exec: async () => MockActivityModel.config.results,
    };
    return chain;
  },
};

function installMock(rel, fake) {
  const file = require.resolve(path.join(__dirname, rel));
  require.cache[file] = { id: file, filename: file, loaded: true, exports: fake };
}

async function runTests() {
  // Activity is exported directly by the model module (not as { Activity }).
  // Mirror that public contract so this harness tests the service query rather
  // than failing during module loading.
  installMock('../../models/Activity', MockActivityModel);

  const svc = require('./activity.service');

  const ORG = '507f1f77bcf86cd799439011';
  const start = new Date('2026-08-01T00:00:00Z');
  const end = new Date('2026-08-31T23:59:59Z');

  console.log('🧪 Running Ticket 3 — activity.service tests...\n');

  // T3-01 fetch by orgId only
  MockActivityModel.config.results = [{ _id: 'a1' }, { _id: 'a2' }];
  let out = await svc.getActivityForRange({ organizationId: ORG, startDate: start, endDate: end });
  let q = MockActivityModel.lastQuery;
  check('T3-01 returns array of activities', Array.isArray(out) && out.length === 2);
  check('T3-01 filters by organizationId', String(q.organizationId) === ORG, JSON.stringify(q));
  check('T3-01 applies timestamp range', !!q.timestamp && q.timestamp.$gte === start && q.timestamp.$lte === end);

  // T3-02 explicit date window honored
  const start2 = new Date('2026-08-18T00:00:00Z');
  const end2 = new Date('2026-08-24T00:00:00Z');
  await svc.getActivityForRange({ organizationId: ORG, startDate: start2, endDate: end2 });
  q = MockActivityModel.lastQuery;
  check('T3-02 honors custom date window', q.timestamp.$gte.getTime() === start2.getTime() && q.timestamp.$lte.getTime() === end2.getTime());

  // T3-03 source filter
  MockActivityModel.config.results = [{ _id: 'g1', source: 'github' }];
  out = await svc.getActivityForRange({ organizationId: ORG, startDate: start, endDate: end, source: 'github' });
  q = MockActivityModel.lastQuery;
  check('T3-03 source filter applied', q.source === 'github' && out[0].source === 'github', JSON.stringify(q));

  // T3-04 type filter
  await svc.getActivityForRange({ organizationId: ORG, startDate: start, endDate: end, type: 'pr_merged' });
  check('T3-04 type filter applied', MockActivityModel.lastQuery.type === 'pr_merged');

  // T3-05 actor filter
  await svc.getActivityForRange({ organizationId: ORG, startDate: start, endDate: end, actor: 'priya' });
  check("T3-05 actor filter applied", MockActivityModel.lastQuery.actor === 'priya');

  // T3-06 no activities -> empty array
  MockActivityModel.config.results = [];
  out = await svc.getActivityForRange({ organizationId: ORG, startDate: start, endDate: end });
  check('T3-06 no activities -> empty array', Array.isArray(out) && out.length === 0);

  // T3-07 reversed range builds $gte > $lte (matches nothing upstream)
  out = await svc.getActivityForRange({ organizationId: ORG, startDate: end2, endDate: start2 });
  q = MockActivityModel.lastQuery;
  check('T3-07 reversed range yields empty result', q.timestamp.$gte.getTime() > q.timestamp.$lte.getTime() && out.length === 0);

  // Sorting newest-first + optional filters compose
  await svc.getActivityForRange({ organizationId: ORG, startDate: start, endDate: end, source: 'slack', actor: 'bob' });
  q = MockActivityModel.lastQuery;
  check('Filters compose (source+actor together)', q.source === 'slack' && q.actor === 'bob', JSON.stringify(q));
  check('Sort: timestamp descending (newest first)', !!MockActivityModel.sortArgs && MockActivityModel.sortArgs.timestamp === -1, JSON.stringify(MockActivityModel.sortArgs));

  console.log(`\n📊 ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((e) => { console.error('Harness crashed:', e); process.exit(1); });
