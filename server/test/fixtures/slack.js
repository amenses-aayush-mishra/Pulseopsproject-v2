/**
 * Slack Events API fixture payloads (T1 / T2 tests).
 */

// Plain text message.
const message = {
  token: 'XXYYZZ',
  team_id: 'T1234567890',
  api_app_id: 'A1234567890',
  type: 'event_callback',
  event_id: 'Ev1234567890',
  event_time: 1234567890,
  event: {
    type: 'message',
    user: 'U1234567890',
    text: 'Hello world!',
    ts: '1234567890.000200',
    channel: 'C1234567890',
    event_ts: '1234567890.000200',
  },
};

// File share: message with a `file_share` subtype.
const fileShare = {
  team_id: 'T1234567890',
  type: 'event_callback',
  event_id: 'Ev1234567891',
  event_time: 1234567891,
  event: {
    type: 'message',
    subtype: 'file_share',
    user: 'U1234567890',
    ts: '1234567890.000300',
    channel: 'C1234567890',
    event_ts: '1234567890.000300',
    files: [{ id: 'F1234567890', name: 'report.pdf' }],
  },
};

// URL verification (Slack sends when registering the endpoint).
const urlVerification = {
  token: 'XXYYZZ',
  challenge: '3eZbrw1aBm2rZgRNFdxV2573ZrqwszuOZbKdCQ2n',
  type: 'url_verification',
};

module.exports = { message, fileShare, urlVerification };