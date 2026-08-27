'use strict';

/**
 * notificationService.js — RBAC-scoped notification fan-out.
 *
 * Called fire-and-forget from webhook routes after an Activity is saved.
 * Does NOT block the HTTP response.
 */

const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const OrganizationMember = require('../models/OrganizationMember');

// ---------------------------------------------------------------------------
// Deep-link mapping by source
// ---------------------------------------------------------------------------
const SOURCE_LINK = {
  github:    (orgId) => `/workspace/${orgId}/repositories`,
  jira:      (orgId) => `/workspace/${orgId}/tickets`,
  slack:     (orgId) => `/workspace/${orgId}/communication`,
  analytics: (orgId) => `/workspace/${orgId}/analytics`,
};

// ---------------------------------------------------------------------------
// Human-readable title/body builders
// ---------------------------------------------------------------------------
function buildTitle(activity) {
  const actor = activity.actor || 'Someone';
  switch (activity.type) {
    case 'pr_opened':           return `${actor} opened a new Pull Request`;
    case 'pr_merged':           return `${actor} merged a Pull Request`;
    case 'pr_closed':           return `${actor} closed a Pull Request`;
    case 'pr_conflict':         return `PR conflict detected by ${actor}`;
    case 'push':                return `${actor} pushed new commits`;
    case 'issue_created':       return `${actor} created a Jira issue`;
    case 'issue_completed':     return `${actor} completed a Jira issue`;
    case 'issue_status_changed':return `${actor} updated a Jira issue status`;
    case 'message':             return `${actor} sent a Slack message`;
    case 'file_share':          return `${actor} shared a file on Slack`;
    case 'channel_silence':     return `Slack channel has been quiet for 3+ days`;
    default:                    return `New ${activity.source} activity from ${actor}`;
  }
}

function buildBody(activity) {
  const meta = activity.metadata || {};
  if (activity.source === 'github') {
    const pr = meta.pull_request || {};
    return pr.title ? `"${pr.title}"` : '';
  }
  if (activity.source === 'jira') {
    return meta.issueSummary ? `"${meta.issueSummary}"` : (meta.issueKey || '');
  }
  if (activity.source === 'slack') {
    const text = meta.text || '';
    return text.length > 80 ? `${text.slice(0, 77)}…` : text;
  }
  return '';
}

// ---------------------------------------------------------------------------
// RBAC filtering — which roles should receive this activity?
// ---------------------------------------------------------------------------
function memberShouldReceive(member, activity) {
  const role = (member.role || '').toLowerCase();

  // Viewers never get notifications
  if (role === 'viewer') return false;

  // Owner / Admin → always
  if (['owner', 'admin'].includes(role)) return true;

  // Maintainer → GitHub + Jira only
  if (role === 'maintainer') {
    return ['github', 'jira'].includes(activity.source);
  }

  // Developer → only activities they are the actor on
  if (role === 'developer') {
    // Compare activity.actor (login/email string) against member's stored email
    // or invitedEmail. Best-effort — no lookup of User model to keep it fast.
    const actorLower = (activity.actor || '').toLowerCase();
    const emailLower = (member.invitedEmail || '').toLowerCase();
    return actorLower && emailLower && (actorLower === emailLower || emailLower.startsWith(actorLower));
  }

  return false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Called after Activity is saved.  Fan-out notifications to relevant members.
 * Fire-and-forget — callers do NOT await this.
 */
async function createNotificationsForActivity(activity) {
  try {
    if (!activity || !activity.organizationId) return;

    const orgId = activity.organizationId;

    // Fetch all active members of this organization
    const members = await OrganizationMember.find({
      organizationId: orgId,
      status: 'active',
    }).lean();

    if (!members.length) return;

    const link = (SOURCE_LINK[activity.source] || SOURCE_LINK.github)(orgId.toString());
    const title = buildTitle(activity);
    const body = buildBody(activity);

    const docs = [];
    for (const member of members) {
      if (!memberShouldReceive(member, activity)) continue;
      docs.push({
        organizationId: orgId,
        userId:         member.userId,
        title,
        body,
        link,
        source:         activity.source,
        activityType:   activity.type,
        read:           false,
      });
    }

    if (docs.length) {
      await Notification.insertMany(docs, { ordered: false });
    }
  } catch (err) {
    // Never crash the webhook handler
    console.warn('[notificationService] Fan-out error (non-fatal):', err.message);
  }
}

/**
 * Returns the latest notifications for a user in an org (max 50).
 */
async function getNotifications(userId, orgId, limit = 20) {
  return Notification.find({
    userId:         new mongoose.Types.ObjectId(userId),
    organizationId: new mongoose.Types.ObjectId(orgId),
  })
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 50))
    .lean();
}

/**
 * Counts unread notifications for a user in an org.
 */
async function getUnreadCount(userId, orgId) {
  return Notification.countDocuments({
    userId:         new mongoose.Types.ObjectId(userId),
    organizationId: new mongoose.Types.ObjectId(orgId),
    read:           false,
  });
}

/**
 * Marks a single notification as read (owned by userId for safety).
 */
async function markRead(notificationId, userId) {
  return Notification.findOneAndUpdate(
    { _id: notificationId, userId: new mongoose.Types.ObjectId(userId) },
    { $set: { read: true } },
    { new: true }
  );
}

/**
 * Marks all notifications as read for a user in an org.
 */
async function markAllRead(userId, orgId) {
  return Notification.updateMany(
    {
      userId:         new mongoose.Types.ObjectId(userId),
      organizationId: new mongoose.Types.ObjectId(orgId),
      read:           false,
    },
    { $set: { read: true } }
  );
}

module.exports = {
  createNotificationsForActivity,
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
};
