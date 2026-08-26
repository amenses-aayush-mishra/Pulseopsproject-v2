// Sample Slack webhook payload for testing
const sampleSlackPayload = {
  "token": "XXYYZZ",
  "team_id": "T1234567890",
  "api_app_id": "A1234567890",
  "event": {
    "type": "message",
    "user": "U1234567890",
    "text": "Hello world!",
    "ts": "1234567890.000200",
    "channel": "C1234567890",
    "event_ts": "1234567890.000200"
  },
  "type": "event_callback",
  "event_id": "Ev1234567890",
  "event_time": 1234567890
};

module.exports = { sampleSlackPayload };