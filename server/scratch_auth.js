const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: './.env' });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const user = await db.collection('users').findOne({ email: 'anshulchouhan5176@gmail.com' });
  if (!user) { console.log('User not found'); process.exit(1); }
  
  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
  
  const res = await fetch('http://localhost:5000/api/integrations/jira/auth', {
    headers: {
      'Authorization': 'Bearer ' + token,
      'x-organization-id': user.activeOrganizationId ? user.activeOrganizationId.toString() : (user.workspaces && user.workspaces[0] ? user.workspaces[0].id.toString() : '')
    }
  });
  
  const data = await res.json();
  console.log('Auth URL:', data.url);
  process.exit(0);
}
run().catch(console.error);
