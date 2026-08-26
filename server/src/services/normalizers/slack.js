function normalizeSlack(payload, organizationId) {
  // Map Slack Events API payload to Activity shape
  
  // Handle URL verification and other non-event types
  if (payload.type === 'url_verification') {
    return {
      organizationId,
      source: 'slack',
      sourceId: payload.challenge || 'url_verification',
      actor: 'slack_platform',
      timestamp: new Date(),
      type: 'url_verification',
      metadata: { challenge: payload.challenge }
    };
  }
  
  // Handle event_callback type
  if (payload.type === 'event_callback' && payload.event) {
    const event = payload.event;
    
    // Determine the actor (user who triggered the event)
    const actor = event.user || 
                  event.username || 
                  'unknown';
    
    // Determine source ID - use event timestamp or event ID
    const sourceId = event.event_ts || 
                     event.ts || 
                     payload.event_id || 
                     'unknown';
    
    // Determine event type
    // Slack sends `message` events; file shares come as a message with a
    // `file_share` subtype (older clients) or an attached `files` array.
    let type = event.type || payload.type;
    if (type === 'message') {
      if (event.subtype === 'file_share' || Array.isArray(event.files) && event.files.length > 0) {
        type = 'file_share';
      } else {
        type = 'message';
      }
    }
    
    // Convert Slack timestamp to Date object
    // Slack timestamps are strings like "1234567890.000200"
    let timestamp = new Date(); // fallback to now
    if (event.event_ts) {
      const seconds = parseFloat(event.event_ts);
      if (!isNaN(seconds)) {
        timestamp = new Date(seconds * 1000);
      }
    } else if (event.ts) {
      const seconds = parseFloat(event.ts);
      if (!isNaN(seconds)) {
        timestamp = new Date(seconds * 1000);
      }
    } else if (payload.event_time) {
      timestamp = new Date(parseInt(payload.event_time, 10) * 1000);
    }
    
    return {
      organizationId,
      source: 'slack',
      sourceId,
      actor,
      timestamp,
      type,
      metadata: {
        // Store the full event for reference
        event,
        // Extract key information for easier querying
        channel: event.channel,
        team_id: payload.team_id,
        event_id: payload.event_id
      }
    };
  }
  
  // Fallback for unknown payload types
  return {
    organizationId,
    source: 'slack',
    sourceId: 'unknown',
    actor: 'unknown',
    timestamp: new Date(),
    type: payload.type || 'unknown',
    metadata: { ...payload }
  };
}

module.exports = { normalizeSlack };