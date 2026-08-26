const mongoose = require('mongoose');
const JiraService = require('./jira.service');
const JiraIssue = require('../models/JiraIssue');
const JiraSyncState = require('../models/JiraSyncState');
const Activity = require('../models/Activity');
const { normalizeJira } = require('./normalizers/jira');
/**
 * Background sync for a Jira project
 */
async function startProjectSync(organizationId, jiraCloudId, projectKey, accessToken, syncStateId) {
  let syncState = await JiraSyncState.findById(syncStateId);
  if (!syncState) return;

  try {
    let nextPageToken = syncState.nextPageToken || '';
    const maxResults = 50;
    let hasMore = true;

    while (hasMore) {
      const result = await JiraService.getIssues(
        accessToken,
        jiraCloudId,
        `project = ${projectKey}`,
        nextPageToken,
        maxResults
      );
      
      const issues = result.issues || [];
      
      if (issues.length === 0) {
        hasMore = false;
        break;
      }

      // Upsert issues into MongoDB
      for (const issue of issues) {
        const fields = issue.fields;
        const assignee = fields.assignee ? {
          accountId: fields.assignee.accountId,
          displayName: fields.assignee.displayName,
          emailAddress: fields.assignee.emailAddress,
          avatarUrl: fields.assignee.avatarUrls?.['48x48'],
        } : null;
        
        const reporter = fields.reporter ? {
          accountId: fields.reporter.accountId,
          displayName: fields.reporter.displayName,
          emailAddress: fields.reporter.emailAddress,
        } : null;

        await JiraIssue.findOneAndUpdate(
          { organizationId, jiraIssueId: issue.id },
          {
            $set: {
              organizationId,
              jiraIssueId: issue.id,
              issueKey: issue.key,
              summary: fields.summary,
              description: fields.description,
              issueType: fields.issuetype?.name,
              status: fields.status?.name,
              priority: fields.priority?.name,
              projectKey: fields.project?.key,
              projectName: fields.project?.name,
              assignee,
              reporter,
              created: fields.created ? new Date(fields.created) : new Date(),
              updated: fields.updated ? new Date(fields.updated) : new Date(),
              resolved: fields.resolutiondate ? new Date(fields.resolutiondate) : undefined,
              labels: fields.labels || [],
              components: fields.components?.map(c => c.name) || [],
              commentCount: Array.isArray(fields.comment)
                ? fields.comment.length
                : (fields.comment && fields.comment.comments
                    ? fields.comment.comments.length
                    : 0),
              timeEstimate: fields.timeestimate,
              timeSpent: fields.timespent,
              lastSyncAt: new Date(),
            },
          },
          { upsert: true, new: true }
        );

        // Here we could also fetch comments/worklogs for this issue 
        // if they exceed the preview fields. But this serves as the Phase 5 baseline.

        // Also normalize and create an Activity record so it appears on Dashboard and AI Summaries
        try {
          // Construct a payload matching what the webhook delivers so normalizeJira can parse it
          const syncPayload = {
            webhookEvent: 'jira:issue_updated',
            timestamp: fields.updated ? new Date(fields.updated).getTime() : Date.now(),
            // Normalize user: pick accountId + displayName from assignee or reporter
            user: fields.assignee
              ? { accountId: fields.assignee.accountId, displayName: fields.assignee.displayName }
              : fields.reporter
                ? { accountId: fields.reporter.accountId, displayName: fields.reporter.displayName }
                : { displayName: 'System' },
            issue: {
              id: issue.id,
              key: issue.key,
              fields: {
                summary: fields.summary,
                status: fields.status,
              }
            }
          };

          const orgObjectId = new mongoose.Types.ObjectId(organizationId.toString());
          const activity = normalizeJira(syncPayload, organizationId.toString());
          if (activity) {
            await Activity.findOneAndUpdate(
              {
                organizationId: orgObjectId,
                source: 'jira',
                sourceId: activity.sourceId,
              },
              {
                $set: {
                  ...activity,
                  organizationId: orgObjectId,  // always store as ObjectId
                }
              },
              { upsert: true }
            );
          }
        } catch (actErr) {
          console.warn('[jira/sync] Activity creation skipped for issue', issue.key, ':', actErr.message);
        }
      }

      syncState.issuesSynced = (syncState.issuesSynced || 0) + issues.length;
      syncState.nextPageToken = result.nextPageToken || '';
      await syncState.save();

      nextPageToken = result.nextPageToken || '';
      hasMore = !result.isLast && !!nextPageToken;
    }

    syncState.status = 'synced';
    syncState.lastSyncCompletedAt = new Date();
    await syncState.save();
    
    console.log(`[jira/sync] Project ${projectKey} synced successfully.`);
  } catch (err) {
    console.error(`[jira/sync] Project ${projectKey} sync failed:`, err);
    syncState.status = 'error';
    syncState.lastError = err.message;
    syncState.lastErrorAt = new Date();
    await syncState.save();
  }
}

/**
 * Basic reconciliation job that can be scheduled to run periodically.
 * It finds all active projects and fetches issues updated since the last sync.
 */
async function reconcileJiraProjects() {
  console.log('[jira/sync] Starting Jira reconciliation job...');
  const activeSyncs = await JiraSyncState.find({ status: 'synced' });
  const Integration = require('../models/Integration');

  for (const syncState of activeSyncs) {
    try {
      const integration = await Integration.findOne({ 
        organizationId: syncState.organizationId, 
        jiraCloudId: syncState.jiraCloudId,
        status: 'active' 
      });
      if (!integration?.accessToken) continue;

      // Ideally check token expiry, but we omit here for brevity since it's a stub
      const jql = `project = ${syncState.projectKey} AND updated >= "-24h"`;
      
      const result = await JiraService.getIssues(
        integration.accessToken, // Needs decryption in a real run
        integration.jiraCloudId,
        jql,
        '',
        10
      );
      
      console.log(`[jira/sync] Reconciled ${result.issues?.length || 0} issues for ${syncState.projectKey}`);
    } catch (err) {
      console.error(`[jira/sync] Error reconciling project ${syncState.projectKey}:`, err.message);
    }
  }
}

module.exports = {
  startProjectSync,
  reconcileJiraProjects
};
