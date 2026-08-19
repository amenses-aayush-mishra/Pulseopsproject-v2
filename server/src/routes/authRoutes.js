const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const Organization = require('../models/Organization');
const OrganizationMember = require('../models/OrganizationMember');
const Invitation = require('../models/Invitation');
const authenticate = require('../middleware/authenticate');
const { transporter } = require('../utils/mailer');

const router = express.Router();

const createRateLimiter = require('../middleware/rateLimiter');

// TASK-112: rate limiting for sensitive auth routes — 15-minute sliding window,
// 20 requests per IP, 429 { code: 'RATE_LIMIT_EXCEEDED' } when exceeded.
const authRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });

// Expose transporter for test stubbing (e2e-audit-runner.js)
router.transporter = transporter;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const resolveRole = async (user) => {
  if (!user.activeOrganizationId) return null;
  const membership = await OrganizationMember.findOne({
    organizationId: user.activeOrganizationId,
    userId: user._id,
  });
  return membership ? membership.role : null;
};

/**
 * Returns full workspace membership payload for a user.
 * Queries OrganizationMember for all active memberships, populates org name.
 * Always accurate — derived from DB, not from user.activeOrganizationId alone.
 */
const fetchWorkspacePayload = async (userId) => {
  const memberships = await OrganizationMember.find({
    userId,
    status: 'active',
  }).populate('organizationId', 'name slug');

  const workspaces = memberships
    .filter((m) => m.organizationId)
    .map((m) => ({
      id: m.organizationId._id.toString(),
      name: m.organizationId.name,
      slug: m.organizationId.slug || '',
      role: m.role,
    }));

  return {
    workspaces,
    hasWorkspace: workspaces.length > 0,
    workspaceCount: workspaces.length,
  };
};

const signAuthToken = (user, role) =>
  jwt.sign(
    {
      userId: user._id.toString(),
      activeOrganizationId: user.activeOrganizationId
        ? user.activeOrganizationId.toString()
        : null,
      role,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

/**
 * Invitation interceptor (TASK-106).
 * When an optional inviteToken is present on login/oauth-sync:
 *   - 404 if no pending, unexpired invitation matches the token hash.
 *   - 403 (INVITATION_EMAIL_MISMATCH) if the invitation was issued to a
 *     different email address (hard email lock).
 *   - Otherwise: upsert the OrganizationMember, accept the invitation, set the
 *     invited workspace as the user's activeOrganizationId, and re-resolve role.
 * Returns { ok: true } when there is nothing to apply.
 */
const applyInvitation = async (user, inviteToken) => {
  if (!inviteToken || typeof inviteToken !== 'string') {
    return { ok: true };
  }

  const tokenHash = sha256(inviteToken);
  const invitation = await Invitation.findOne({
    tokenHash,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  });

  if (!invitation) {
    return { ok: false, status: 404, message: 'Invitation token invalid or expired' };
  }

  // Hard email lock: the invitation belongs to exactly one email address.
  if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
    return {
      ok: false,
      status: 403,
      message: 'Forbidden. Invitation was issued to a different email address.',
      code: 'INVITATION_EMAIL_MISMATCH',
    };
  }

  // Attach membership (upsert — idempotent and concurrent-safe).
  await OrganizationMember.findOneAndUpdate(
    { organizationId: invitation.organizationId, userId: user._id },
    { $set: { role: invitation.role, status: 'active' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Consume the invitation.
  await Invitation.updateOne({ _id: invitation._id }, { $set: { status: 'accepted' } });

  // Make the invited workspace the user's active organization.
  user.activeOrganizationId = invitation.organizationId;
  await user.save();

  return { ok: true };
};

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------
router.post('/register', authRateLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';

    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ message: 'A valid email is required.' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'User already exists' });
    }

    // TASK-112: pending-invitation lookup — if an owner already invited this
    // email but the user self-registers without clicking the invite link, the
    // 201 response carries hasPendingInvite:true so the client can inform them.
    // (Invitation acceptance itself stays with the inviteToken interceptor.)
    const pendingInvite = await Invitation.findOne({
      email: email.toLowerCase().trim(),
      status: 'pending',
      expiresAt: { $gt: new Date() },
    });

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      passwordHash,
      isVerified: true,
      authProvider: 'credentials',
    });

    return res.status(201).json(
      pendingInvite
        ? {
            message: 'Account registered. You have a pending organization invitation waiting.',
            hasPendingInvite: true,
          }
        : {
            message: 'Registration successful.',
            hasPendingInvite: false,
          }
    );
  } catch (error) {
    console.error('Register error:', error.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/auth/verify-email
// ---------------------------------------------------------------------------
router.get('/verify-email', authRateLimiter, async (req, res) => {
  try {
    const rawToken = typeof req.query.token === 'string' ? req.query.token.trim() : '';
    if (!rawToken) {
      return res.status(400).json({ message: 'Verification token is required.' });
    }

    const tokenHash = sha256(rawToken);
    const user = await User.findOne({
      verificationTokenHash: tokenHash,
      verificationTokenExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification token.' });
    }

    user.isVerified = true;
    user.verificationTokenHash = null;
    user.verificationTokenExpires = null;
    await user.save();

    return res.status(200).json({ message: 'Email verified successfully.' });
  } catch (error) {
    console.error('Verify email error:', error.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
router.post('/login', authRateLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Hard check: unverified accounts cannot log in.
    if (user.isVerified === false) {
      return res.status(403).json({
        message: 'Email not verified. Please check your inbox.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    // Invitation interceptor: attach workspace membership if inviteToken present.
    // TASK-112: inviteToken is type-checked + trimmed before hashing/DB lookups.
    const inviteToken =
      typeof req.body.inviteToken === 'string' ? req.body.inviteToken.trim() : undefined;
    const inviteResult = await applyInvitation(user, inviteToken);
    if (!inviteResult.ok) {
      return res
        .status(inviteResult.status)
        .json(
          inviteResult.code
            ? { message: inviteResult.message, code: inviteResult.code }
            : { message: inviteResult.message }
        );
    }

    const role = await resolveRole(user);
    const wpPayload = await fetchWorkspacePayload(user._id);

    // If the user has workspaces but no activeOrganizationId yet, pin to first.
    if (wpPayload.hasWorkspace && !user.activeOrganizationId) {
      user.activeOrganizationId = wpPayload.workspaces[0].id;
      await user.save();
    }

    const token = signAuthToken(user, role);

    return res.status(200).json({
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        activeOrganizationId: user.activeOrganizationId
          ? user.activeOrganizationId.toString()
          : null,
        role,
        mustChangePassword: user.mustChangePassword === true,
        hasWorkspace: wpPayload.hasWorkspace,
        workspaceCount: wpPayload.workspaceCount,
        workspaces: wpPayload.workspaces,
        isInvitedUser: Boolean(user.isInvited || user.temporaryPassword || user.mustChangePassword),
      },
    });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/oauth/sync — atomic upsert (double-click race safe)
// ---------------------------------------------------------------------------
router.post('/oauth/sync', authRateLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const name = typeof req.body.name === 'string' ? req.body.name : '';

    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ message: 'A valid email is required.' });
    }

    // Atomic upsert: concurrent identical requests create exactly one document.
    const user = await User.findOneAndUpdate(
      { email },
      {
        $setOnInsert: {
          email,
          name: name || '',
          isVerified: true,
          authProvider: 'google',
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // If an existing account was unverified (e.g. registered via /register), upgrade it.
    if (!user.isVerified) {
      user.isVerified = true;
      await user.save();
    }

    // Invitation interceptor: attach workspace membership if inviteToken present.
    // TASK-112: inviteToken is type-checked + trimmed before hashing/DB lookups.
    const inviteToken =
      typeof req.body.inviteToken === 'string' ? req.body.inviteToken.trim() : undefined;
    const inviteResult = await applyInvitation(user, inviteToken);
    if (!inviteResult.ok) {
      return res
        .status(inviteResult.status)
        .json(
          inviteResult.code
            ? { message: inviteResult.message, code: inviteResult.code }
            : { message: inviteResult.message }
        );
    }

    const role = await resolveRole(user);
    const wpPayload = await fetchWorkspacePayload(user._id);

    // If the user has workspaces but no activeOrganizationId yet, pin to first.
    if (wpPayload.hasWorkspace && !user.activeOrganizationId) {
      user.activeOrganizationId = wpPayload.workspaces[0].id;
      await user.save();
    }

    const token = signAuthToken(user, role);

    return res.status(200).json({
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        activeOrganizationId: user.activeOrganizationId
          ? user.activeOrganizationId.toString()
          : null,
        role,
        mustChangePassword: user.mustChangePassword === true,
        hasWorkspace: wpPayload.hasWorkspace,
        workspaceCount: wpPayload.workspaceCount,
        workspaces: wpPayload.workspaces,
        isInvitedUser: Boolean(user.isInvited || user.temporaryPassword || user.mustChangePassword),
      },
    });
  } catch (error) {
    console.error('OAuth sync error:', error.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/change-password — protected
// Rotates the user's password and clears the mustChangePassword gate. Used by
// the invitation landing flow (TASK-109) where an owner pre-provisioned an
// account with a temporary password (mustChangePassword:true).
// ---------------------------------------------------------------------------
router.post('/change-password', authRateLimiter, authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (!user.passwordHash) {
      return res.status(400).json({ 
        error: 'OAuth accounts (Google/GitHub) do not use passwords. Log in with your OAuth provider.' 
      });
    }

    const currentPassword =
      typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password does not match' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = false;
    await user.save();

    const role = await resolveRole(user);
    const token = signAuthToken(user, role);

    return res.status(200).json({
      message: 'Password updated successfully.',
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        activeOrganizationId: user.activeOrganizationId
          ? user.activeOrganizationId.toString()
          : null,
        role,
        mustChangePassword: false,
      },
    });
  } catch (error) {
    console.error('Change password error:', error.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/auth/me — protected
// ---------------------------------------------------------------------------
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const memberships = await OrganizationMember.find({
      userId: user._id,
      status: 'active',
    }).populate('organizationId');

    const availableOrganizations = memberships
      .filter((m) => m.organizationId)
      .map((m) => ({
        id: m.organizationId._id.toString(),
        name: m.organizationId.name,
        role: m.role,
      }));

    let activeOrganization = null;
    let role = null;
    if (user.activeOrganizationId) {
      const activeMember = memberships.find(
        (m) =>
          m.organizationId &&
          m.organizationId._id.toString() === user.activeOrganizationId.toString()
      );
      if (activeMember) {
        const activeOrg = activeMember.organizationId;
        activeOrganization =
          availableOrganizations.find(
            (o) => o.id === user.activeOrganizationId.toString()
          ) || null;
        // Theme engine (TASK-107): expose the active org's theme settings so
        // the workspace shell can apply brand color / density / navigation.
        if (activeOrganization && activeOrg) {
          activeOrganization.themeSettings = activeOrg.themeSettings || {};
        }
        role = activeMember.role;
      }
    }

    const wpPayload = await fetchWorkspacePayload(user._id);

    return res.status(200).json({
      user,
      activeOrganization,
      role,
      availableOrganizations,
      hasWorkspace: wpPayload.hasWorkspace,
      workspaceCount: wpPayload.workspaceCount,
      workspaces: wpPayload.workspaces,
    });
  } catch (error) {
    console.error('Me error:', error.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;