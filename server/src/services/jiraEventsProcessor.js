const mongoose = require('mongoose');
const JiraWebhookEvent = require('../models/JiraWebhookEvent');
const JiraIssue = require('../models/JiraIssue');
const JiraComment = require('../models/JiraComment');
const JiraWorklog = require('../models/JiraWorklog');
const Activity = require('../models/Activity');
const { normalizeJira } = require('./normalizers/jira');

let isWorkerRunning = false;
let workerTimeout = null;

async function processEvent(eventDoc) {
  const { eventType, payload, organizationId } = eventDoc;
  const issue = payload.issue;
  
  if (!issue || !issue.id) {
    throw new Error('Invalid payload: missing issue data');
  }

  const fields = issue.fields || {};
  
  // Extract assignee
  const assignee = fields.assignee ? {
    accountId: fields.assignee.accountId,
    displayName: fields.assignee.displayName,
    emailAddress: fields.assignee.emailAddress,
    avatarUrl: fields.assignee.avatarUrls?.['48x48'],
  } : null;
  
  // Extract reporter
  const reporter = fields.reporter ? {
    accountId: fields.reporter.accountId,
    displayName: fields.reporter.displayName,
    emailAddress: fields.reporter.emailAddress,
  } : null;

  // Prepare issue data for upsert
  const issueData = {
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
    commentCount: Array.isArray(fields.comment) ? fields.comment.length : (fields.comment && fields.comment.comments ? fields.comment.comments.length : 0),
    timeEstimate: fields.timeestimate,
    timeSpent: fields.timespent,
    webhookEvent: eventType,
    webhookTimestamp: payload.timestamp ? new Date(parseInt(payload.timestamp, 10)) : new Date(),
    lastSyncAt: new Date(),
  };

  if (eventType === 'jira:issue_deleted') {
    await JiraIssue.findOneAndUpdate(
      { organizationId, jiraIssueId: issue.id },
      { 
        $set: { 
          status: 'Deleted',
          webhookEvent: eventType,
          webhookTimestamp: issueData.webhookTimestamp,
          lastSyncAt: new Date(),
        } 
      },
      { new: true }
    );
  } else if (eventType.startsWith('jira:issue_')) {
    await JiraIssue.findOneAndUpdate(
      { organizationId, jiraIssueId: issue.id },
      { $set: issueData },
      { upsert: true, new: true }
    );
  } else if (eventType.startsWith('comment_') && payload.comment) {
    // Upsert issue first to ensure parent exists
    await JiraIssue.findOneAndUpdate({ organizationId, jiraIssueId: issue.id }, { $set: issueData }, { upsert: true });
    
    if (eventType === 'comment_deleted') {
      await JiraComment.findOneAndDelete({ organizationId, commentId: payload.comment.id });
    } else {
      await JiraComment.findOneAndUpdate(
        { organizationId, commentId: payload.comment.id },
        {
          $set: {
            jiraIssueId: issue.id,
            author: payload.comment.author ? {
              accountId: payload.comment.author.accountId,
              displayName: payload.comment.author.displayName,
              emailAddress: payload.comment.author.emailAddress,
              avatarUrl: payload.comment.author.avatarUrls?.['48x48'],
            } : null,
            body: payload.comment.body,
            created: new Date(payload.comment.created),
            updated: new Date(payload.comment.updated),
          }
        },
        { upsert: true }
      );
    }
  } else if (eventType.startsWith('worklog_') && payload.worklog) {
    await JiraIssue.findOneAndUpdate({ organizationId, jiraIssueId: issue.id }, { $set: issueData }, { upsert: true });
    
    if (eventType === 'worklog_deleted') {
      await JiraWorklog.findOneAndDelete({ organizationId, worklogId: payload.worklog.id });
    } else {
      await JiraWorklog.findOneAndUpdate(
        { organizationId, worklogId: payload.worklog.id },
        {
          $set: {
            jiraIssueId: issue.id,
            author: payload.worklog.author ? {
              accountId: payload.worklog.author.accountId,
              displayName: payload.worklog.author.displayName,
              emailAddress: payload.worklog.author.emailAddress,
              avatarUrl: payload.worklog.author.avatarUrls?.['48x48'],
            } : null,
            timeSpentSeconds: payload.worklog.timeSpentSeconds,
            comment: payload.worklog.comment,
            started: new Date(payload.worklog.started),
            created: new Date(payload.worklog.created),
            updated: new Date(payload.worklog.updated),
          }
        },
        { upsert: true }
      );
    }
  }

  // Best-effort Activity tracking (if not already done by the route)
  // Since we removed it from the route, we should do it here if it's an issue event
  // Normalizer might only support issue events currently
  if (eventType.startsWith('jira:issue_')) {
    try {
      const orgObjectId = new mongoose.Types.ObjectId(organizationId.toString());
      const activity = normalizeJira(payload, organizationId.toString());
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
      console.warn('[jira/worker] Activity creation skipped:', actErr.message);
    }
  }
}

async function processQueue() {
  try {
    // Find one pending event, prioritize oldest first
    const event = await JiraWebhookEvent.findOneAndUpdate(
      { status: 'pending' },
      { $set: { status: 'processing', lastAttemptAt: new Date() }, $inc: { attempts: 1 } },
      { sort: { createdAt: 1 }, new: true }
    );

    if (!event) {
      // Queue is empty, back off for a bit
      workerTimeout = setTimeout(processQueue, 5000);
      return;
    }

    try {
      await processEvent(event);
      await JiraWebhookEvent.updateOne({ _id: event._id }, { $set: { status: 'completed' } });
    } catch (err) {
      console.error(`[jira/worker] Error processing event ${event._id}:`, err);
      // If we failed multiple times, mark as error, else put back to pending
      if (event.attempts >= 3) {
        await JiraWebhookEvent.updateOne({ _id: event._id }, { $set: { status: 'error', error: err.message } });
      } else {
        await JiraWebhookEvent.updateOne({ _id: event._id }, { $set: { status: 'pending', error: err.message } });
      }
    }

    // Immediately process next item
    setImmediate(processQueue);
  } catch (err) {
    console.error('[jira/worker] Critical error in queue loop:', err);
    workerTimeout = setTimeout(processQueue, 10000);
  }
}

function startJiraWorker() {
  if (isWorkerRunning) return;
  isWorkerRunning = true;
  console.log('[jira/worker] Starting Jira webhook processor worker...');
  processQueue();
}

function stopJiraWorker() {
  if (workerTimeout) clearTimeout(workerTimeout);
  isWorkerRunning = false;
  console.log('[jira/worker] Stopped Jira webhook processor worker.');
}

module.exports = {
  startJiraWorker,
  stopJiraWorker
};
