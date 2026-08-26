// Sample Jira webhook payload for testing
const sampleJiraPayload = {
  "webhookEvent": "jira:issue_created",
  "timestamp": 1623456789000,
  "issue_event_type_name": "issue_created",
  "user": {
    "accountId": "5b10a2844c20165700ede21g",
    "displayName": "Test User",
    "emailAddress": "test@example.com"
  },
  "issue": {
    "id": "10001",
    "key": "TEST-1",
    "fields": {
      "summary": "Test issue",
      "description": "This is a test issue",
      "issuetype": {
        "name": "Task"
      }
    }
  }
};

module.exports = { sampleJiraPayload };