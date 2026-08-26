// Context builder service for transforming activity data into plain-text summaries
// Used to prepare data for AI prompts

/**
 * Summarize activities into structured data
 * @param {Array<Object>} activities - Array of activity objects from Activity model
 * @returns {Object} Summary object
 */
function summarizeActivities(activities) {
  const bySource = {};
  const byType = {};
  const actors = new Set();

  activities.forEach(activity => {
    // Count by source
    bySource[activity.source] = (bySource[activity.source] || 0) + 1;
    
    // Count by type
    byType[activity.type] = (byType[activity.type] || 0) + 1;
    
    // Collect actors
    if (activity.actor) actors.add(activity.actor);
  });

  // Sort activities by timestamp to get proper date range
  const sortedActivities = [...activities].sort((a, b) => a.timestamp - b.timestamp);
  
  return {
    total: activities.length,
    bySource,
    byType,
    actors: Array.from(actors),
    dateRange: {
      start: sortedActivities[0] ? new Date(sortedActivities[0].timestamp) : new Date(),
      end: sortedActivities[sortedActivities.length - 1] ? new Date(sortedActivities[sortedActivities.length - 1].timestamp) : new Date()
    }
  };
}

/**
 * Build plain-text context from activities for AI prompts
 * @param {Array<Object>} activities - Array of activity objects
 * @returns {string} Formatted context string
 */
function buildContext(activities) {
  if (!activities || activities.length === 0) {
    return "No activity found for this period.";
  }

  const summary = summarizeActivities(activities);
  
  // Build structured context
  let context = `## Engineering Activity Summary\n\n`;
  context += `Period: ${summary.dateRange.start.toLocaleDateString()} - ${summary.dateRange.end.toLocaleDateString()}\n`;
  context += `Total Activities: ${summary.total}\n\n`;
  
  // Source breakdown
  context += `### Activity by Source:\n`;
  for (const [source, count] of Object.entries(summary.bySource)) {
    context += `- ${source}: ${count} activities\n`;
  }
  context += `\n`;
  
  // Type breakdown
  context += `### Activity by Type:\n`;
  for (const [type, count] of Object.entries(summary.byType)) {
    context += `- ${type}: ${count}\n`;
  }
  context += `\n`;
  
  // Active contributors
  context += `### Active Contributors:\n`;
  if (summary.actors.length > 0) {
    context += `- ${summary.actors.join(', ')}\n`;
  } else {
    context += `- No active contributors\n`;
  }
  context += `\n`;
  
  // Detailed activity list (limit to keep prompt manageable)
  context += `### Recent Activities:\n`;
  const recentActivities = activities.slice(0, 20); // Limit to 20 for prompt size
  recentActivities.forEach(activity => {
    const time = new Date(activity.timestamp).toLocaleString();
    const source = activity.source.toUpperCase();
    const type = activity.type;
    const actor = activity.actor;
    const details = activity.metadata?.prTitle || 
                   activity.metadata?.issueSummary || 
                   activity.metadata?.text || 
                   '';
    
    context += `- [${time}] ${source} - ${actor} did ${type}`;
    if (details) context += `: "${details.substring(0, 100)}"`;
    context += `\n`;
  });
  
  if (activities.length > 20) {
    context += `\n... and ${activities.length - 20} more activities\n`;
  }
  
  return context;
}

/**
 * Build GitHub-specific context
 * @param {Array<Object>} activities - Array of activity objects
 * @returns {string} GitHub context string
 */
function buildGitHubContext(activities) {
  const githubActivities = activities.filter(a => a.source === 'github');
  if (githubActivities.length === 0) {
    return "No GitHub activity this period.";
  }
  
  const prsOpened = githubActivities.filter(a => a.type === 'pr_opened').length;
  const prsMerged = githubActivities.filter(a => a.type === 'pr_closed' && a.metadata?.prState === 'merged').length;
  const prsClosed = githubActivities.filter(a => a.type === 'pr_closed' && a.metadata?.prState !== 'merged').length;
  const reviews = githubActivities.filter(a => a.type.includes('review')).length;
  
  let context = `### GitHub Activity:\n`;
  context += `- PRs Opened: ${prsOpened}\n`;
  context += `- PRs Merged: ${prsMerged}\n`;
  context += `- PRs Closed (without merge): ${prsClosed}\n`;
  context += `- PR Reviews: ${reviews}\n`;
  
  return context;
}

/**
 * Build Jira-specific context
 * @param {Array<Object>} activities - Array of activity objects
 * @returns {string} Jira context string
 */
function buildJiraContext(activities) {
  const jiraActivities = activities.filter(a => a.source === 'jira');
  if (jiraActivities.length === 0) {
    return "No Jira activity this period.";
  }
  
  const created = jiraActivities.filter(a => a.type === 'issue_created').length;
  const updated = jiraActivities.filter(a => a.type === 'issue_updated').length;
  const completed = jiraActivities.filter(a => a.type === 'issue_completed' || a.metadata?.status === 'Done').length;
  
  let context = `### Jira Activity:\n`;
  context += `- Issues Created: ${created}\n`;
  context += `- Issues Updated: ${updated}\n`;
  context += `- Issues Completed: ${completed}\n`;
  
  return context;
}

/**
 * Build Slack-specific context
 * @param {Array<Object>} activities - Array of activity objects
 * @returns {string} Slack context string
 */
function buildSlackContext(activities) {
  const slackActivities = activities.filter(a => a.source === 'slack');
  if (slackActivities.length === 0) {
    return "No Slack activity this period.";
  }
  
  const messages = slackActivities.filter(a => a.type === 'message').length;
  const fileShares = slackActivities.filter(a => a.type === 'file_share').length;
  
  let context = `### Slack Activity:\n`;
  context += `- Messages Sent: ${messages}\n`;
  context += `- File Shares: ${fileShares}\n`;
  
  return context;
}

module.exports = {
  summarizeActivities,
  buildContext,
  buildGitHubContext,
  buildJiraContext,
  buildSlackContext
};
