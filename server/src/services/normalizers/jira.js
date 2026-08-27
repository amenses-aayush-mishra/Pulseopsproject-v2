function normalizeJira(payload, organizationId) {
  // Map Jira webhook payload to Activity shape
  
  // Determine the actor (user who triggered the event)
  const actor = payload.user?.accountId || 
                payload.user?.displayName || 
                payload.user?.emailAddress || 
                'unknown';
  
  // Determine source ID - prefer issue ID, fall back to webhook event + timestamp
  let sourceId = '';
  if (payload.issue?.id) {
    sourceId = payload.issue.id.toString();
  } else if (payload.webhookEvent && payload.timestamp) {
    sourceId = `${payload.webhookEvent}_${payload.timestamp}`;
  } else {
    sourceId = payload.webhookEvent || 'unknown';
  }
  
  // Extract key fields for easier querying and context building
  const issueKey = payload.issue?.key;
  const issueSummary = payload.issue?.fields?.summary;
  const issueStatus = payload.issue?.fields?.status?.name || '';
  const statusLower = issueStatus.toLowerCase();

  // Determine event type from webhookEvent and status
  let type = (payload.webhookEvent || 'unknown').replace(/^jira:/, '');
  if (statusLower && (['done', 'closed', 'resolved'].includes(statusLower) || statusLower.includes('done') || statusLower.includes('closed'))) {
    type = 'issue_completed';
  }

  // Convert Jira timestamp to Date object
  let timestamp = new Date(); // fallback to now
  if (payload.timestamp && !isNaN(payload.timestamp)) {
    timestamp = new Date(parseInt(payload.timestamp, 10));
  }

  return {
    organizationId,
    source: 'jira',
    sourceId,
    actor,
    timestamp,
    type,
    metadata: {
      // Store the full payload for reference
      ...payload,
      // Extract key information for easier querying and context building
      issueKey,
      issueSummary,
      issueStatus,
      webhookEvent: payload.webhookEvent,
      issue_event_type_name: payload.issue_event_type_name,
      changelog: payload.changelog
    }
  };
}

module.exports = { normalizeJira };