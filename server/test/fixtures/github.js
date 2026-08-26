/**
 * GitHub webhook fixture payloads (T1 / T2 tests).
 * Match the shape GitHub actually sends for each event.
 */

const prOpened = {
  action: 'opened',
  number: 14,
  pull_request: {
    id: 91001,
    number: 14,
    state: 'open',
    merged: false,
    title: 'feat: add onboarding flow',
    user: { login: 'priya' },
  },
  repository: { id: 555001, name: 'payments-api', full_name: 'acme/payments-api' },
  sender: { login: 'priya' },
};

const prMerged = {
  action: 'closed',
  number: 12,
  pull_request: {
    id: 91002,
    number: 12,
    state: 'closed',
    merged: true,
    user: { login: 'daniel' },
  },
  repository: { id: 555001, name: 'payments-api', full_name: 'acme/payments-api' },
  sender: { login: 'daniel' },
};

const prClosed = {
  action: 'closed',
  number: 13,
  pull_request: {
    id: 91003,
    number: 13,
    state: 'closed',
    merged: false,
    user: { login: 'alex' },
  },
  repository: { id: 555001, name: 'payments-api', full_name: 'acme/payments-api' },
  sender: { login: 'alex' },
};

const push = {
  ref: 'refs/heads/main',
  before: 'abc123',
  after: 'def456',
  commits: [{ id: 'c1', message: 'fix: n+1 query' }],
  pusher: { name: 'priya', email: 'priya@acme.com' },
  repository: { id: 555001, name: 'payments-api', full_name: 'acme/payments-api' },
};

const ping = {
  zen: 'Keep it logically awesome.',
  hook_id: 42,
  repository: { id: 555001, name: 'payments-api', full_name: 'acme/payments-api' },
};

module.exports = { prOpened, prMerged, prClosed, push, ping };