/**
 * migrate-jira-issue-index.js
 *
 * One-time migration: drop the globally-unique jiraIssueId_1 index
 * and replace it with the compound (organizationId, jiraIssueId) unique index.
 *
 * WHY: Jira issue IDs like "10001" are scoped to an Atlassian site, not
 * globally unique. Two workspaces connecting the same Atlassian account
 * produced E11000 duplicate key errors, causing syncState.status = 'error'.
 *
 * RUN: node server/migrate-jira-issue-index.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function migrate() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('ERROR: MONGODB_URI not set in environment');
    process.exit(1);
  }

  console.log('[migrate] Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('[migrate] Connected.');

  const db = mongoose.connection.db;
  const collection = db.collection('jiraissues');

  // 1) List current indexes so we can see what exists
  const existing = await collection.indexes();
  const existingNames = existing.map(i => i.name);
  console.log('[migrate] Current indexes:', existingNames);

  // 2) Drop the old globally-unique single-field index if it exists
  const OLD_INDEX = 'jiraIssueId_1';
  if (existingNames.includes(OLD_INDEX)) {
    console.log(`[migrate] Dropping old index: ${OLD_INDEX}`);
    await collection.dropIndex(OLD_INDEX);
    console.log(`[migrate] Dropped: ${OLD_INDEX}`);
  } else {
    console.log(`[migrate] Old index "${OLD_INDEX}" not found — nothing to drop.`);
  }

  // 3) Create the new compound unique index
  const NEW_INDEX = 'organizationId_1_jiraIssueId_1';
  if (!existingNames.includes(NEW_INDEX)) {
    console.log(`[migrate] Creating compound index: ${NEW_INDEX}`);
    await collection.createIndex(
      { organizationId: 1, jiraIssueId: 1 },
      { unique: true, name: NEW_INDEX }
    );
    console.log(`[migrate] Created: ${NEW_INDEX}`);
  } else {
    console.log(`[migrate] Index "${NEW_INDEX}" already exists — skipping.`);
  }

  // 4) Verify final state
  const final = await collection.indexes();
  console.log('[migrate] Final indexes:', final.map(i => `${i.name}${i.unique ? ' (unique)' : ''}`));

  await mongoose.disconnect();
  console.log('[migrate] Done. Disconnected from MongoDB.');
}

migrate().catch(err => {
  console.error('[migrate] FAILED:', err.message);
  process.exit(1);
});
