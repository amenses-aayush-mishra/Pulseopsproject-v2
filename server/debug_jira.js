const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
require('dotenv').config();
const { jiraRequest } = require('./src/services/jiraClient');

async function testAll() {
  await mongoose.connect(process.env.MONGO_URI);
  const Integration = mongoose.model('Integration', new mongoose.Schema({}, { strict: false }));
  const integration = await Integration.findOne({ organizationId: '6a85f4f255d004a7d4388a3f', provider: 'jira' });

  // Query all projects first
  const pRes = await jiraRequest('/rest/api/3/project/search', integration);
  const pData = await pRes.json();
  console.log('All Jira Projects on site:', pData.values);

  for (const proj of (pData.values || [])) {
    const jql = `project = "${proj.key}"`;
    const res = await jiraRequest(`/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}`, integration);
    const data = await res.json();
    console.log(`Issues in project ${proj.key} (${proj.name}): ${data.issues?.length || 0}`);
    if (data.issues?.length) {
      console.log('Issues:', data.issues.map(i => ({ key: i.key, summary: i.fields?.summary, status: i.fields?.status?.name })));
    }
  }

  await mongoose.disconnect();
}
testAll().catch(console.error);
