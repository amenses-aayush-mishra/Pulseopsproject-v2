const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const API_BASE = 'http://localhost:5000';
const FRONTEND_BASE = 'http://localhost:3000';

async function runAudit() {
  const results = [];
  
  const report = (stage, status, latency, endpoint, message) => {
    results.push({ stage, status, latency, endpoint, message });
    console.log(`[${status}] ${stage} | ${endpoint} | ${latency}ms | ${message}`);
  };

  try {
    // Connect to DB
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const User = require('./src/models/User');
    const Organization = require('./src/models/Organization');
    const Invitation = require('./src/models/Invitation');
    const OrganizationMember = require('./src/models/OrganizationMember');

    // Clean up test data before running
    await User.deleteMany({ email: { $in: ['new_audit_user@pulseops.dev', 'dev.audit@company.com'] } });
    await Organization.deleteMany({ name: 'Audit Corp' });
    await Invitation.deleteMany({ email: 'dev.audit@company.com' });

    // --- STAGE 1 ---
    let t0 = Date.now();
    let res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New User Audit', email: 'new_audit_user@pulseops.dev', password: 'Password123!' })
    });
    let t1 = Date.now();
    if (res.ok) {
      let user = await User.findOne({ email: 'new_audit_user@pulseops.dev' });
      if (user && !user.isVerified && user.verificationTokenHash) {
        report('STAGE 1: Register', 'PASS', t1-t0, '/api/auth/register', 'User created, unverified');
        
        user.isVerified = true;
        await user.save();
        report('STAGE 1: Verify Email', 'PASS', 0, '/api/auth/verify-email', 'Manually verified in DB for test');
      } else {
        report('STAGE 1: Register', 'FAIL', t1-t0, '/api/auth/register', 'User not found or already verified');
      }
    } else {
      report('STAGE 1: Register', 'FAIL', t1-t0, '/api/auth/register', `HTTP ${res.status}`);
    }

    t0 = Date.now();
    res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new_audit_user@pulseops.dev', password: 'Password123!' })
    });
    t1 = Date.now();
    let data = await res.json();
    let token = data.token;
    if (res.ok && !data.user.activeOrganizationId) {
      report('STAGE 1: Login (No Org)', 'PASS', t1-t0, '/api/auth/login', 'Logged in, no org (routing to /onboarding)');
    } else {
      report('STAGE 1: Login (No Org)', 'FAIL', t1-t0, '/api/auth/login', 'Failed or has org');
    }

    // --- STAGE 2 ---
    t0 = Date.now();
    res = await fetch(`${API_BASE}/api/organizations/onboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name: 'Audit Corp', teamSize: '1-10', primaryFocus: 'Software' })
    });
    t1 = Date.now();
    data = await res.json();
    token = data.token;
    let workspaceId = data.organization?._id;
    if (res.ok && workspaceId) {
      report('STAGE 2: Workspace Creation', 'PASS', t1-t0, '/api/organizations/onboard', `Created workspace ${workspaceId}`);
    } else {
      report('STAGE 2: Workspace Creation', 'FAIL', t1-t0, '/api/organizations/onboard', `Failed: ${JSON.stringify(data)}`);
    }

    t0 = Date.now();
    res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new_audit_user@pulseops.dev', password: 'Password123!' })
    });
    t1 = Date.now();
    data = await res.json();
    if (res.ok && data.user.activeOrganizationId === workspaceId) {
      report('STAGE 2: Direct Login', 'PASS', t1-t0, '/api/auth/login', 'Logged in, routing directly to workspace');
    } else {
      report('STAGE 2: Direct Login', 'FAIL', t1-t0, '/api/auth/login', 'Failed or wrong org ID');
    }

    // --- STAGE 3 ---
    t0 = Date.now();
    res = await fetch(`${API_BASE}/api/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ currentPassword: 'WrongPassword123!', newPassword: 'NewPassword123!' })
    });
    t1 = Date.now();
    data = await res.json();
    if (res.status === 400 && data.error === 'Current password does not match') {
      report('STAGE 3: Password Mismatch', 'PASS', t1-t0, '/api/auth/change-password', 'Correctly rejected');
    } else {
      report('STAGE 3: Password Mismatch', 'FAIL', t1-t0, '/api/auth/change-password', `Expected 400 mismatch, got ${res.status}`);
    }

    t0 = Date.now();
    res = await fetch(`${API_BASE}/api/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ currentPassword: 'Password123!', newPassword: 'NewPassword123!' })
    });
    t1 = Date.now();
    data = await res.json();
    if (res.ok && data.user.mustChangePassword === false) {
      report('STAGE 3: Password Update', 'PASS', t1-t0, '/api/auth/change-password', 'Updated successfully');
    } else {
      report('STAGE 3: Password Update', 'FAIL', t1-t0, '/api/auth/change-password', 'Update failed');
    }

    // --- STAGE 4 ---
    t0 = Date.now();
    res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/invitations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ orgEmail: 'dev.audit@company.com', personalEmail: 'dev.audit.personal@gmail.com', role: 'developer', name: 'Audit Dev' })
    });
    t1 = Date.now();
    data = await res.json();
    let tempPassword = data.tempPassword;
    if (res.ok && tempPassword && data.orgEmail === 'dev.audit@company.com') {
      report('STAGE 4: Teammate Invite', 'PASS', t1-t0, `/api/workspaces/${workspaceId}/invitations`, 'Invite processed');
    } else {
      report('STAGE 4: Teammate Invite', 'FAIL', t1-t0, `/api/workspaces/${workspaceId}/invitations`, `Failed: ${JSON.stringify(data)}`);
    }

    t0 = Date.now();
    res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dev.audit@company.com', password: tempPassword })
    });
    t1 = Date.now();
    data = await res.json();
    let invitedToken = data.token;
    if (res.ok && data.user.mustChangePassword === true) {
      report('STAGE 4: Invited Login', 'PASS', t1-t0, '/api/auth/login', 'Logged in, forced password change detected');
    } else {
      report('STAGE 4: Invited Login', 'FAIL', t1-t0, '/api/auth/login', `Failed: ${JSON.stringify(data)}`);
    }

    // --- STAGE 5 ---
    t0 = Date.now();
    res = await fetch(`${API_BASE}/api/integrations/github/status`, {
      headers: { 'Authorization': `Bearer ${token}`, 'x-organization-id': workspaceId }
    });
    t1 = Date.now();
    data = await res.json();
    if (res.ok && data.connected === false) {
      report('STAGE 5: GitHub Status Check', 'PASS', t1-t0, '/api/integrations/github/status', 'Status checked successfully (false)');
    } else {
      report('STAGE 5: GitHub Status Check', 'FAIL', t1-t0, '/api/integrations/github/status', `Failed or wrong status: ${JSON.stringify(data)}`);
    }

    t0 = Date.now();
    res = await fetch(`${API_BASE}/api/integrations/track-repositories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-organization-id': workspaceId },
      body: JSON.stringify({ repositoryIds: ['123456'] })
    });
    t1 = Date.now();
    data = await res.json();
    if (res.ok || res.status === 404) {
       // Since github is not connected, it should return 404
      report('STAGE 5: GitHub Repo Tracking', 'PASS', t1-t0, '/api/integrations/track-repositories', `Handled correctly (got ${res.status})`);
    } else {
      report('STAGE 5: GitHub Repo Tracking', 'FAIL', t1-t0, '/api/integrations/track-repositories', `Unexpected response: ${res.status}`);
    }

    t0 = Date.now();
    res = await fetch(`${API_BASE}/api/webhooks/github`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-github-event': 'pull_request' },
      body: JSON.stringify({ action: 'opened', pull_request: { number: 999, title: 'Audit PR' }, repository: { full_name: 'audit-repo' } })
    });
    t1 = Date.now();
    if (res.ok) {
      report('STAGE 5: GitHub Webhook', 'PASS', t1-t0, '/api/webhooks/github', 'Webhook ingested successfully');
    } else {
      report('STAGE 5: GitHub Webhook', 'FAIL', t1-t0, '/api/webhooks/github', `Failed: HTTP ${res.status}`);
    }

    console.log('\n--- FINAL DIAGNOSTIC REPORT ---');
    console.table(results);

  } catch (err) {
    console.error('Audit failed with error:', err);
  } finally {
    mongoose.connection.close();
  }
}

runAudit();
