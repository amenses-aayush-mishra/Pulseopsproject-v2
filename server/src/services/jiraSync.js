const mongoose = require('mongoose');
const JiraService = require('./jira.service');
const JiraIssue = require('../models/JiraIssue');
const JiraSyncState = require('../models/JiraSyncState');
const Activity = require('../models/Activity');
const { normalizeJira } = require('./normalizers/jira');

/**
 * Background sync for a Jira project.
 *
 * Key design decisions:
 * - Per-issue try/catch: one bad issue (schema validation, duplicate key, etc.)
 *   must NOT abort the entire batch. Failed issues are counted separately.
 * - issuesSynced counts only successfully persisted issues.
 * - failedCount counts issues that hit an error during persistence.
 * - The sync is considered 'synced' even if some issues failed — the counts
 *   tell the full story. Only a total failure (e.g. Jira API error, token
 *   expiry) sets status='error'.
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
        `project = ${projectKey} ORDER BY updated DESC`,
        nextPageToken,
        maxResults
      );
      
      const issues = result.issues || [];
      
      if (issues.length === 0) {
        hasMore = false;
        break;
      }

      let batchSynced = 0;
      let batchFailed = 0;

      // Upsert issues into MongoDB — per-issue try/catch so one failure
      // does not abort the entire page.
      for (const issue of issues) {
        try {
          const fields = issue.fields || {};
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

          // Guard required fields — if a required field is missing from the
          // Jira API response, skip this issue rather than crashing.
          if (!fields.summary || !fields.status?.name || !fields.created || !fields.updated) {
            console.warn(`[jira/sync] Issue ${issue.key} missing required fields, skipping.`);
            batchFailed++;
            continue;
          }

          // Jira v3 API returns description as a complex ADF object;
          // Mongoose schema expects a plain string. Convert ADF to text or
          // fall back to null if unparseable.
          let descriptionText = null;
          if (typeof fields.description === 'string') {
            descriptionText = fields.description;
          } else if (fields.description && typeof fields.description === 'object') {
            // ADF-to-plaintext: walk the content tree and join text nodes.
            const walk = (node) => {
              if (!node) return '';
              if (node.text) return node.text;
              const kids = Array.isArray(node.content) ? node.content.map(walk).join('') : '';
              const after = node.type === 'paragraph' ? '\n' : '';
              return kids + after;
            };
            descriptionText = walk(fields.description).trim() || null;
          }

          await JiraIssue.findOneAndUpdate(
            // Scope by organizationId + jiraIssueId — compound unique index
            { organizationId, jiraIssueId: issue.id },
            {
              $set: {
                organizationId,
                jiraIssueId: issue.id,
                issueKey: issue.key,
                summary: fields.summary,
                description: descriptionText,
                // issueType is no longer required — Jira sub-tasks/epics may omit it
                issueType: fields.issuetype?.name || null,
                status: fields.status?.name,
                priority: fields.priority?.name,
                projectKey: fields.project?.key,
                projectName: fields.project?.name,
                assignee,
                reporter,
                created: new Date(fields.created),
                updated: new Date(fields.updated),
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

          batchSynced++;

          // Also normalize and create an Activity record for Dashboard/AI Summaries
          try {
            const syncPayload = {
              webhookEvent: 'jira:issue_updated',
              timestamp: fields.updated ? new Date(fields.updated).getTime() : Date.now(),
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
                    organizationId: orgObjectId,
                  }
                },
                { upsert: true }
              );
            }
          } catch (actErr) {
            // Activity creation failure is non-fatal — the issue is still synced.
            console.warn('[jira/sync] Activity creation skipped for issue', issue.key, ':', actErr.message);
          }

        } catch (issueErr) {
          // Per-issue error — log it but continue processing the rest of the batch.
          console.error(`[jira/sync] Failed to upsert issue ${issue.key || issue.id}:`, issueErr.message);
          batchFailed++;
        }
      }

      // Persist per-page progress to JiraSyncState
      syncState.issuesSynced = (syncState.issuesSynced || 0) + batchSynced;
      syncState.failedCount = (syncState.failedCount || 0) + batchFailed;
      syncState.nextPageToken = result.nextPageToken || '';
      await syncState.save();

      console.log(`[jira/sync] Page done — synced: ${batchSynced}, failed: ${batchFailed}, total so far: ${syncState.issuesSynced}`);

      nextPageToken = result.nextPageToken || '';
      hasMore = !result.isLast && !!nextPageToken;
    }

    // Mark complete
    syncState.status = 'synced';
    syncState.lastSyncCompletedAt = new Date();
    await syncState.save();
    
    console.log(`[jira/sync] Project ${projectKey} sync complete — ${syncState.issuesSynced} synced, ${syncState.failedCount} failed.`);
  } catch (err) {
    // Outer catch: Jira API error, token expiry, network failure, etc.
    // Surface the real error message — do NOT convert to 0.
    console.error(`[jira/sync] Project ${projectKey} sync failed (outer):`, err.message, err.status || '');
    syncState.status = 'error';
    syncState.lastError = err.message || 'Unknown sync error';
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
  const { decrypt } = require('../utils/crypto');
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

      const accessToken = decrypt(integration.accessToken);
      const jql = `project = ${syncState.projectKey} AND updated >= "-24h"`;
      
      const result = await JiraService.getIssues(
        accessToken,
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
