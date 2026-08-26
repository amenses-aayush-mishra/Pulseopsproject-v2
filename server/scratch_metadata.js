const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const user = await db.collection('users').findOne({ email: 'anshulchouhan5176@gmail.com' });
  const orgId = user.activeOrganizationId ? user.activeOrganizationId : (user.workspaces && user.workspaces[0] ? user.workspaces[0].id : null);
  
  const integration = await db.collection('integrations').findOne({ organizationId: orgId, provider: 'jira' });
  if (!integration) { console.log('Integration not found'); process.exit(1); }
  
  console.log('Integration doc:', JSON.stringify(integration, null, 2));
  process.exit(0);
}
run().catch(console.error);
