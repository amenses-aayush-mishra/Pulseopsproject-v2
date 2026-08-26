const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config({path:'.env'});
const connectDB = require('../src/config/db');

connectDB().then(async () => {
  // Use the correct user ID that's a member of the org
  const userId = '6a85a2f64a3f09d3b64138aa';
  const orgId = '6a8bfb8e075f782ea09405b4';
  
  // Generate a test JWT token
  const token = jwt.sign(
    { userId, activeOrganizationId: orgId, role: 'owner', email: 'test@test.com' },
    process.env.JWT_SECRET
  );
  console.log('Test JWT:', token);

  const headers = {
    'Authorization': `Bearer ${token}`,
    'x-organization-id': orgId,
    'Content-Type': 'application/json'
  };
  
  // Test /jira/status
  console.log('\n=== Testing /api/integrations/jira/status ===');
  try {
    const res = await fetch('http://localhost:5000/api/integrations/jira/status', { headers });
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  // Test /jira/auth
  console.log('\n=== Testing /api/integrations/jira/auth ===');
  try {
    const res = await fetch('http://localhost:5000/api/integrations/jira/auth', { headers });
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  // Test /jira/projects
  console.log('\n=== Testing /api/integrations/jira/projects ===');
  try {
    const res = await fetch('http://localhost:5000/api/integrations/jira/projects', { headers });
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  // Test /jira/issues
  console.log('\n=== Testing /api/integrations/jira/issues ===');
  try {
    const res = await fetch('http://localhost:5000/api/integrations/jira/issues', { headers });
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  // Test /jira/register-webhook
  console.log('\n=== Testing /api/integrations/jira/register-webhook ===');
  try {
    const res = await fetch('http://localhost:5000/api/integrations/jira/register-webhook', { 
      method: 'POST',
      headers,
      body: JSON.stringify({ projectKey: 'TEST' })
    });
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  mongoose.disconnect();
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });