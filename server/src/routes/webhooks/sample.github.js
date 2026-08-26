// Sample GitHub webhook payload for testing
const sampleGitHubPayload = {
  "repository": {
    "id": 123456,
    "name": "test-repo",
    "full_name": "test-org/test-repo"
  },
  "ref": "refs/heads/main",
  "before": "abc123",
  "after": "def456",
  "pusher": {
    "name": "test-user",
    "email": "test@example.com"
  }
};

module.exports = { sampleGitHubPayload };