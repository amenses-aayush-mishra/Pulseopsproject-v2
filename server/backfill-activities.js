/**
 * backfill-activities.js
 * 
 * One-shot script: reads all existing JiraIssue documents and creates
 * corresponding Activity records so the AI Summary / Dashboard can see them.
 * 
 * Run from server/ directory:
 *   node backfill-activities.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { normalizeJira } = require('./src/services/normalizers/jira');
const connectDB = require('./src/config/db');

async function main() {
  console.log('Connecting to DB...');
  await connectDB();
  console.log('Connected.\n');

  // Load models AFTER connect
  const JiraIssue = require('./src/models/JiraIssue');
  const Activity = require('./src/models/Activity');

  const issues = await JiraIssue.find({}).lean();
  console.log(`Found ${issues.length} JiraIssue documents.\n`);

  if (issues.length === 0) {
    console.log('No Jira issues found. Run a Full Sync from the UI first.');
    process.exit(0);
  }

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const issue of issues) {
    try {
      const orgId = issue.organizationId.toString();

      // Build a payload that normalizeJira can consume
      const syncPayload = {
        webhookEvent: 'jira:issue_updated',
        timestamp: issue.updated ? new Date(issue.updated).getTime() : Date.now(),
        user: issue.assignee
          ? { accountId: issue.assignee.accountId, displayName: issue.assignee.displayName }
          : issue.reporter
            ? { accountId: issue.reporter.accountId, displayName: issue.reporter.displayName }
            : { displayName: 'System' },
        issue: {
          id: issue.jiraIssueId,
          key: issue.issueKey,
          fields: {
            summary: issue.summary,
            status: { name: issue.status },
          },
        },
      };

      const activity = normalizeJira(syncPayload, orgId);

      const result = await Activity.findOneAndUpdate(
        {
          organizationId: new mongoose.Types.ObjectId(orgId),
          source: 'jira',
          sourceId: activity.sourceId,
        },
        {
          $set: {
            ...activity,
            organizationId: new mongoose.Types.ObjectId(orgId),
          },
        },
        { upsert: true, new: true }
      );

      if (result) {
        created++;
        console.log(`  ✅ ${issue.issueKey} → Activity created/updated (actor: ${activity.actor})`);
      }
    } catch (err) {
      errors++;
      console.error(`  ❌ ${issue.issueKey} → Error:`, err.message);
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Created/updated: ${created}`);
  console.log(`Skipped:         ${skipped}`);
  console.log(`Errors:          ${errors}`);

  // Verify
  const totalActivities = await Activity.countDocuments();
  const jiraActivities = await Activity.countDocuments({ source: 'jira' });
  console.log(`\nTotal Activities in DB: ${totalActivities}`);
  console.log(`Jira Activities:        ${jiraActivities}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
