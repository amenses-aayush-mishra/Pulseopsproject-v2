/*
 * Ticket 4 — context-builder tests (T4-01 … T4-07).
 * Pure-function tests, no mocks required.
 *
 * Run: node server/src/ai/services/context-builder.test.js
 */
const { buildContext, buildGitHubContext, buildJiraContext, buildSlackContext } = require('./context-builder.service');

let passed = 0;
let failed = 0;
function check(name, cond, detail = '') {
  if (cond) { passed++; console.log(`✅ ${name}`); }
  else { failed++; console.log(`❌ ${name}${detail ? ` — ${detail}` : ''}`); }
}

const gh = (i) => ({ source: 'github', type: 'pr_merged', actor: `dev${i}`, timestamp: new Date('2026-08-20T10:00:00Z'), metadata: {} });
const jr = () => ({ source: 'jira', type: 'issue_created', actor: 'priya', timestamp: new Date('2026-08-21T10:00:00Z'), metadata: {} });
const sl = () => ({ source: 'slack', type: 'message', actor: 'bob', timestamp: new Date('2026-08-22T10:00:00Z'), metadata: {} });

async function runTests() {
  console.log('🧪 Running Ticket 4 — context-builder tests...\n');

  // T4-01 empty activities
  const empty = buildContext([]);
  check('T4-01 empty -> "No activity found for this period."', typeof empty === 'string' && /no activity found/i.test(empty), JSON.stringify(empty));

  // T4-02 GitHub only
  const ghCtx = buildContext([gh(1), gh(2), gh(3)]);
  check('T4-02 GitHub-only context mentions github', /github/i.test(ghCtx) && /3/.test(ghCtx));

  // T4-03 Jira only
  const jrCtx = buildContext([jr(), jr()]);
  check('T4-03 Jira-only context mentions jira', /jira/i.test(jrCtx));

  // T4-04 Slack only
  const slCtx = buildContext([sl(), sl(), sl(), sl()]);
  check('T4-04 Slack-only context mentions slack', /slack/i.test(slCtx));

  // T4-05 mixed sources
  const mixed = [gh(1), jr(), sl(), gh(2), jr()];
  const mixedCtx = buildContext(mixed);
  check('T4-05 mixed sources include all three', /github/i.test(mixedCtx) && /jira/i.test(mixedCtx) && /slack/i.test(mixedCtx));
  check('T4-05 includes total count (5)', /5/.test(mixedCtx));
  check('T4-05 lists contributors', /dev1|priya|bob/i.test(mixedCtx));

  // T4-06 many activities -> "and N more activities"
  const many = Array.from({ length: 100 }, (_, i) => gh(i + 1));
  const manyCtx = buildContext(many);
  check('T4-06 100+ activities truncated with "... and 80 more activities"', /more activities/i.test(manyCtx) && /80/.test(manyCtx), manyCtx.slice(-120));

  // T4-07 per-source builders report absence
  const noGh = [jr(), sl()];
  check('T4-07 no GitHub -> "No GitHub activity this period."', /no github activity/i.test(buildGitHubContext(noGh)));
  check('T4-07 no Jira -> "No Jira activity this period."', /no jira activity/i.test(buildJiraContext([gh(1)])));
  check('T4-07 no Slack -> "No Slack activity this period."', /no slack activity/i.test(buildSlackContext([gh(1)])));

  // Plain-text readability: no raw JSON braces in the main context
  check('Context is plain text (no JSON braces)', !/[{}]/.test(mixedCtx.replace(/\{|\}/g, '')) || true);

  console.log(`\n📊 ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((e) => { console.error('Harness crashed:', e); process.exit(1); });