/*
 * seed-demo-data.js — populate an organization with realistic Activity rows so
 * the AI summary + analytics features have data to work against.
 *
 * Usage: node scripts/seed-demo-data.js --org <organizationId> [--days 7]
 */
require('dotenv').config();
const connectDB = require('../src/config/db');
const Activity = require('../src/models/Activity');

const args = process.argv.slice(2);
const orgIdx = args.indexOf('--org');
const daysIdx = args.indexOf('--days');
const ORG = orgIdx >= 0 ? args[orgIdx + 1] : null;
const DAYS = daysIdx >= 0 ? Number(args[daysIdx + 1]) || 7 : 7;

if (!ORG) {
  console.error('Usage: node scripts/seed-demo-data.js --org <organizationId> [--days 7]');
  process.exit(1);
}

// Deterministic-ish pseudo-random for reproducible seeds.
let seed = 42;
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const minutesAgo = (m) => new Date(Date.now() - m * 60 * 1000);

const ACTORS = ['priya', 'daniel', 'alex', 'sam'];
const REPO = { id: 555001, name: 'payments-api', full_name: 'acme/payments-api' };
const JIRA_KEYS = ['PAY-101', 'PAY-102', 'PAY-103', 'ONB-201', 'ONB-202'];

function buildActivities() {
  const rows = [];
  let n = 0;

  const add = (source, type, actor, meta, minutesBack) => {
    rows.push({
      organizationId: ORG,
      source,
      sourceId: `${type}_${++n}_${minutesBack}`,
      actor,
      timestamp: minutesAgo(minutesBack),
      type,
      metadata: meta,
    });
  };

  // Spread events across the last DAYS days.
  const span = DAYS * 24 * 60;

  // GitHub: PR lifecycle
  for (let i = 0; i < 14; i++) {
    const who = pick(ACTORS);
    add('github', 'pr_opened', who, { prTitle: `feat: improvement ${i}`, prState: 'open', repository: REPO }, Math.floor(rand() * span));
  }
  for (let i = 0; i < 9; i++) {
    const who = pick(ACTORS);
    add('github', 'pr_merged', who, { prTitle: `fix: bug ${i}`, prState: 'merged', mergedAt: true, repository: REPO }, Math.floor(rand() * span));
  }
  for (let i = 0; i < 4; i++) {
    const who = pick(ACTORS);
    add('github', 'pr_closed', who, { prTitle: `chore: cleanup ${i}`, prState: 'closed', repository: REPO }, Math.floor(rand() * span));
  }
  // GitHub: pushes
  for (let i = 0; i < 10; i++) {
    const who = pick(ACTORS);
    add('github', 'push', who, { ref: 'refs/heads/main', commits: [{ message: `commit ${i}` }], repository: REPO }, Math.floor(rand() * span));
  }

  // Slack: messages + file share
  for (let i = 0; i < 30; i++) {
    const who = pick(ACTORS);
    add('slack', 'message', who, { channel: { name: 'eng-general' }, text: `standup note ${i}` }, Math.floor(rand() * span));
  }
  add('slack', 'file_share', 'priya', { channel: { name: 'eng-general' }, files: [{ name: 'architecture.pdf' }] }, Math.floor(span / 2));

  // Jira: issues created + completed
  for (const key of JIRA_KEYS) {
    add('jira', 'issue_created', pick(['priya', 'daniel']), { issueKey: key, summary: `${key}: customer request` }, Math.floor(rand() * span));
  }
  for (let i = 0; i < 6; i++) {
    add('jira', 'issue_completed', pick(['alex', 'sam']), { issueKey: pick(JIRA_KEYS), status: 'Done' }, Math.floor(rand() * span));
  }

  return rows;
}

(async () => {
  await connectDB();

  const rows = buildActivities();
  const inserted = await Activity.insertMany(rows);
  console.log(`✅ Seeded ${inserted.length} activities for org ${ORG} over the last ${DAYS} days`);

  const byType = inserted.reduce((acc, r) => { acc[r.type] = (acc[r.type] || 0) + 1; return acc; }, {});
  console.log('By type:', JSON.stringify(byType));

  await require('mongoose').disconnect();
  process.exit(0);
})().catch((e) => { console.error('SEED ERROR:', e.message); process.exit(1); });