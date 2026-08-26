async function testWebhook() {
  const payload = {
    webhookEvent: 'jira:issue_created',
    cloudId: 'test-cloud-id',
    timestamp: 1623456789000,
    issue: {
      id: '10001',
      key: 'TEST-123',
      fields: {
        summary: 'Test issue',
        issuetype: { name: 'Task' },
        status: { name: 'To Do' },
        project: { key: 'TEST', name: 'Test Project' },
        assignee: { accountId: 'user1', displayName: 'Test User' },
        reporter: { accountId: 'user2', displayName: 'Reporter' },
        created: '2024-01-01T00:00:00.000Z',
        updated: '2024-01-01T00:00:00.000Z',
        resolutiondate: null,
        labels: [],
        components: [],
        comment: { total: 0 },
      },
    },
  };

  try {
    const res = await fetch('http://localhost:5000/api/webhooks/jira', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  }
}

testWebhook();