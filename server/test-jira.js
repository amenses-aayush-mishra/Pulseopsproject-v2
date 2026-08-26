require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function run() {
  console.log('--- PHASE 0: PRE-TEST ENVIRONMENT AUDIT ---');
  
  const envVars = ['JIRA_CLIENT_ID', 'JIRA_CLIENT_SECRET', 'JIRA_REDIRECT_URI', 'MONGO_URI'];
  envVars.forEach(v => {
    console.log(`${v}: ${process.env[v] ? 'AVAILABLE' : 'MISSING'}`);
  });

  const modelsDir = path.join(__dirname, 'src', 'models');
  const expectedModels = ['JiraProject.js', 'JiraComment.js', 'JiraWorklog.js', 'JiraAttachment.js', 'JiraWebhookEvent.js', 'JiraSyncState.js'];
  expectedModels.forEach(m => {
    const exists = fs.existsSync(path.join(modelsDir, m));
    console.log(`Model ${m}: ${exists ? 'EXISTS' : 'MISSING'}`);
  });

  console.log('\n--- PHASE 1: CONNECTION HEALTH ---');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB Connected');

  const Integration = require('./src/models/Integration');
  const activeJira = await Integration.findOne({ provider: 'jira', status: 'active', jiraCloudId: { $ne: undefined } });

  if (!activeJira) {
    console.log('No active Jira integration found with a cloudId.');
  } else {
    console.log(`organizationId: ${activeJira.organizationId}`);
    console.log(`hasAccessToken: ${!!activeJira.accessToken}`);
    console.log(`hasRefreshToken: ${!!activeJira.refreshToken}`);
    console.log(`jiraCloudId: ${activeJira.jiraCloudId}`);
    console.log(`jiraSiteUrl: ${activeJira.jiraSiteUrl}`);
    console.log(`tokenExpiresAt: ${activeJira.tokenExpiresAt}`);
    console.log(`grantedScopes: ${activeJira.metadata?.grantedScopes || 'undefined'}`);
    console.log(`connectedAs: ${activeJira.metadata?.connectedAs ? JSON.stringify(activeJira.metadata.connectedAs) : 'undefined'}`);
    console.log(`jiraWebhookId: ${activeJira.jiraWebhookId || 'undefined'}`);
  }

  mongoose.disconnect();
}

run().catch(console.error);
