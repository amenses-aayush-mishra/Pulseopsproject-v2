/**
 * Jira webhook fixture payloads (T1 / T2 tests).
 */

const issueCreated = {
  webhookEvent: 'jira:issue_created',
  timestamp: 1623456789000,
  issue_event_type_name: 'issue_created',
  user: { accountId: '5b10a2844c20165700ede21g', displayName: 'Priya Shah' },
  issue: {
    id: '10001',
    key: 'PAY-101',
    fields: { summary: 'Fix checkout bug', issuetype: { name: 'Task' } },
  },
};

const issueUpdated = {
  webhookEvent: 'jira:issue_updated',
  timestamp: 1623456789500,
  issue_event_type_name: 'issue_updated',
  user: { accountId: '5b10a2844c20165700ede21g', displayName: 'Priya Shah' },
  issue: {
    id: '10001',
    key: 'PAY-101',
    fields: { summary: 'Fix checkout bug', issuetype: { name: 'Task' } },
  },
  changelog: { id: '101', items: [{ field: 'status', fromString: 'Open', toString: 'Done' }] },
};

module.exports = { issueCreated, issueUpdated };