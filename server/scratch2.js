const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  // Find ALL Jira integrations regardless of status
  const integrations = await db.collection('integrations').find({ provider: 'jira' }).toArray();
  console.log('Total Jira integration docs:', integrations.length);
  for (const i of integrations) {
    console.log('---');
    console.log('  _id:', i._id.toString());
    console.log('  organizationId:', i.organizationId?.toString());
    console.log('  status:', i.status);
    console.log('  jiraCloudId:', i.jiraCloudId);
    console.log('  jiraSiteUrl:', i.jiraSiteUrl);
    console.log('  tokenExpiresAt:', i.tokenExpiresAt);
    console.log('  hasAccessToken:', !!i.accessToken);
    console.log('  hasRefreshToken:', !!i.refreshToken);
    console.log('  grantedScopes:', i.metadata?.grantedScopes);
    console.log('  connectedAs:', JSON.stringify(i.metadata?.connectedAs));
    console.log('  jiraWebhookId:', i.jiraWebhookId);
    console.log('  state:', i.state ? i.state.substring(0, 16) + '...' : null);
  }
  process.exit(0);
}
run().catch(console.error);
