'use strict';
const express = require('express');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const authenticate = require('../middleware/authenticate');
const verifyTenantAccess = require('../middleware/verifyTenantAccess');
const Integration = require('../models/Integration');
const Organization = require('../models/Organization');
const SlackChannelMessage = require('../models/SlackChannelMessage');
const {
  fetchConversationHistory,
  fetchConversationReplies,
  fetchUsersList,
  conversationsJoin,
  fetchSlackFile,
} = require('../services/slackClient');

const router = express.Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const E11000 = 11000;

/** Build a userId -> { name, avatar } map from Slack's users.list response. */
function buildUserMap(usersList) {
  const map = {};
  if (!usersList || !Array.isArray(usersList.members)) return map;
  for (const m of usersList.members) {
    if (!m || !m.id) continue;
    map[m.id] = {
      name: m.profile?.real_name || m.profile?.display_name || m.name || m.id,
      avatar: m.profile?.image_72 || null,
    };
  }
  return map;
}

/** Normalize reaction objects to a slim { name, count, users } shape. */
function normalizeReactions(reactions) {
  if (!Array.isArray(reactions)) return [];
  return reactions.map((r) => ({
    name: r.name || null,
    count: typeof r.count === 'number' ? r.count : 0,
    users: Array.isArray(r.users) ? r.users : [],
  }));
}

/** Pull a display name from a file attachment, if present. */
function fileNameFor(raw) {
  if (!Array.isArray(raw.files) || raw.files.length === 0) return null;
  return raw.files[0]?.name || raw.files[0]?.title || null;
}

/**
 * Persist a raw Slack message (from history or an Events API payload) into the
 * workspace-scoped SlackChannelMessage collection. Deduplication is enforced by
 * the unique { organizationId, channelId, messageTs } index, so re-fetches and
 * re-delivered events never create duplicates.
 */
async function upsertMessage({ organizationId, integration, userMap, raw }) {
  const messageTs = raw.ts;
  if (!messageTs) return null;

  const userId = raw.user || null;
  const bot = Boolean(raw.bot_id);
  const userName = bot
    ? raw.username || raw.bot_profile?.name || 'Slack bot'
    : userMap[userId]?.name || fileNameFor(raw) || userId || 'Unknown';
  const userAvatar = bot ? null : userMap[userId]?.avatar || null;

  const doc = {
    organizationId,
    slackTeamId: integration.slackTeamId || null,
    channelId: raw.channel,
    messageTs,
    userId,
    userName,
    userAvatar,
    text: typeof raw.text === 'string' ? raw.text : '',
    threadTs: raw.thread_ts || null,
    isReply: Boolean(raw.thread_ts && raw.thread_ts !== messageTs),
    replyCount: typeof raw.reply_count === 'number' ? raw.reply_count : 0,
    reactions: normalizeReactions(raw.reactions),
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    files: Array.isArray(raw.files) ? raw.files : [],
    bot,
  };

  try {
    await SlackChannelMessage.updateOne(
      { organizationId, channelId: raw.channel, messageTs },
      { $set: doc },
      { upsert: true }
    );
  } catch (err) {
    // Duplicate-key on a concurrent upsert is fine — the record already exists.
    if (err?.code !== E11000) throw err;
  }

  return doc;
}

/** Map a persisted message doc into the shape the Communication UI expects. */
function toClientMessage(doc) {
  return {
    id: doc.messageTs,
    ts: doc.messageTs,
    userId: doc.userId,
    userName: doc.userName || 'Unknown',
    userAvatar: doc.userAvatar || null,
    text: doc.text || '',
    threadTs: doc.threadTs,
    isReply: doc.isReply,
    replyCount: doc.replyCount || 0,
    reactions: doc.reactions || [],
    attachments: doc.attachments || [],
    files: doc.files || [],
    bot: doc.bot || false,
    createdAt: doc.createdAt,
  };
}

const slackIntegrationFor = (orgId) =>
  Integration.findOne({ organizationId: orgId, provider: 'slack', status: 'active' });

// ---------------------------------------------------------------------------
// GET /api/communication/messages
// Returns the connected Slack channel + real messages for the current
// PulseOps workspace, plus the workspace's Slack/workspace context.
// ---------------------------------------------------------------------------
router.get('/messages', authenticate, verifyTenantAccess, async (req, res) => {
  try {
    const integration = await slackIntegrationFor(req.organizationId);

    if (!integration) {
      return res.json({ connected: false, messages: [] });
    }

    // Connected via incoming webhook but no bot token (pre-scope extension
    // connections) — the channel cannot be read yet; prompt a reconnect.
    if (!integration.slackBotToken) {
      return res.json({
        connected: true,
        channelUnavailable: true,
        teamName: integration.slackTeamName || 'Slack',
        channelName: integration.slackChannelName || null,
        channelId: integration.slackChannelId || null,
        messages: [],
      });
    }

    const org = await Organization.findById(req.organizationId).lean();
    const workspaceName = org?.name || null;

    // Best-effort user directory enrichment (requires users:read scope).
    let userMap = {};
    try {
      const usersList = await fetchUsersList(integration);
      userMap = usersList.ok ? buildUserMap(usersList) : {};
    } catch (err) {
      console.warn('[communication] users.list failed (names fall back to ids):', err.message);
    }

    // Ensure the bot is a member of the connected channel. conversations.history
    // returns `not_in_channel` when the bot is not in the channel; joining
    // best-effort at read time self-heals public-channel membership.
    try {
      const joined = await conversationsJoin(integration, integration.slackChannelId);
      if (!joined.ok) {
        console.warn(
          `[communication] conversations.join not ok (channel=${integration.slackChannelId}):`,
          joined.error
        );
      }
    } catch (err) {
      console.warn('[communication] conversations.join error:', err.message);
    }

    // Fetch fresh history from Slack and persist (deduped).
    let rawMessages = [];
    try {
      const history = await fetchConversationHistory(integration, integration.slackChannelId, {
        limit: 60,
      });
      if (history.ok && Array.isArray(history.messages)) {
        rawMessages = history.messages;
      } else {
        console.warn('[communication] conversations.history not ok:', history?.error);
      }
    } catch (err) {
      console.error('[communication] fetch history error:', err.message);
      // Fall through to serving what we already have in the DB rather than erroring.
    }

    const persisted = [];
    for (const raw of rawMessages) {
      const doc = await upsertMessage({
        organizationId: req.organizationId,
        integration,
        userMap,
        raw: { ...raw, channel: integration.slackChannelId },
      });
      if (doc) persisted.push(doc);
    }

    // Compute reply counts from the DB for parents Slack didn't annotate.
    const threadTss = persisted
      .filter((m) => !m.isReply && !m.replyCount && m.messageTs)
      .map((m) => m.messageTs);
    const counts = {};
    if (threadTss.length) {
      const rows = await SlackChannelMessage.aggregate([
        {
          $match: {
            organizationId: req.organizationId,
            channelId: integration.slackChannelId,
            threadTs: { $in: threadTss },
            isReply: true,
          },
        },
        { $group: { _id: '$threadTs', count: { $sum: 1 } } },
      ]);
      for (const r of rows) counts[r._id] = r.count;
    }

    // Timeline = top-level messages only (thread replies live behind the drawer).
    const docs = await SlackChannelMessage.find({
      organizationId: req.organizationId,
      channelId: integration.slackChannelId,
      $or: [{ threadTs: null }, { isReply: false }],
    })
      .sort({ messageTs: 1 })
      .limit(200)
      .lean();

    const messages = docs.map((doc) => {
      const msg = toClientMessage(doc);
      if (!msg.replyCount && counts[msg.ts]) msg.replyCount = counts[msg.ts];
      return msg;
    });

    return res.json({
      connected: true,
      teamName: integration.slackTeamName || 'Slack',
      channelName: integration.slackChannelName || null,
      channelId: integration.slackChannelId || null,
      workspaceName,
      messages,
    });
  } catch (err) {
    console.error('[communication/messages] error:', err.message);
    return res.status(500).json({ error: 'Unable to load messages.' });
  }
});


// ---------------------------------------------------------------------------
// GET /api/communication/files/:fileId
// Secure proxy for Slack-uploaded files (images/PDF/docs) used by the
// Communication UI. Slack's `url_private*` URLs require an authorized Slack
// context and cannot reliably be used for inline preview in the browser, so
// the backend resolves the file with the bot token and streams the bytes back.
// Auth: reuses the standard `authenticate` + `verifyTenantAccess` middleware.
// The requested file must belong to a message in THIS workspace's connected
// channel. Bytes are streamed (never stored); no token is exposed.
// ---------------------------------------------------------------------------
router.get('/files/:fileId', authenticate, verifyTenantAccess, async (req, res) => {
  try {
    const integration = await slackIntegrationFor(req.organizationId);
    if (!integration?.slackBotToken) {
      return res.status(400).json({ error: 'Slack is not connected for file access.' });
    }

    const fileId = req.params.fileId;
    const channelId = integration.slackChannelId;

    // Authorization: ensure the file belongs to a message in the requesting
    // workspace's connected channel.
    const owner = await SlackChannelMessage.findOne({
      organizationId: req.organizationId,
      channelId,
      files: { $elemMatch: { id: fileId } },
    }).lean();

    const fileMeta = owner?.files?.find((f) => f.id === fileId);
    if (!owner || !fileMeta) {
      return res.status(404).json({ error: 'File not found in this workspace.' });
    }

    const response = await fetchSlackFile(integration, fileId);

    // Prefer the actual Slack file metadata; fall back to stored metadata only
    // if Slack doesn't return a usable value.
    const file = response; // fetchSlackFile spreads Slack file metadata onto the response
    const contentType =
      file.mimetype || fileMeta.mimetype || response.headers.get('content-type') || 'application/octet-stream';
    const isBase = String(contentType).toLowerCase();
    const inline = isBase.startsWith('image/') || isBase === 'application/pdf' || isBase.startsWith('text/');

    // Use the actual Slack filename; never fall back to a generic placeholder.
    const filename = String(fileMeta.name || file.name || 'file').replace(/["\r\n]/g, '_');
    const dispositionMode = inline ? 'inline' : 'attachment';
    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `${dispositionMode}; filename="${filename}"`
    );
    res.setHeader('Cache-Control', 'private, max-age=300');

    await pipeline(Readable.fromWeb(response.body), res);
  } catch (err) {
    console.error('[communication/files] error:', err.message);
    if (!res.headersSent) {
      return res.status(502).json({ error: 'Unable to proxy Slack file.' });
    }
  }
});



// ---------------------------------------------------------------------------
// GET /api/communication/messages/:messageTs/thread
// Returns the full thread (parent + replies) for a top-level Slack message.
// ---------------------------------------------------------------------------
router.get('/messages/:messageTs/thread', authenticate, verifyTenantAccess, async (req, res) => {
  try {
    const integration = await slackIntegrationFor(req.organizationId);
    if (!integration || !integration.slackBotToken) {
      return res.status(404).json({ error: 'Slack is not connected for thread access.' });
    }

    const threadTs = req.params.messageTs;
    const org = await Organization.findById(req.organizationId).lean();
    const workspaceName = org?.name || null;

    let userMap = {};
    try {
      const usersList = await fetchUsersList(integration);
      userMap = usersList.ok ? buildUserMap(usersList) : {};
    } catch (err) {
      console.warn('[communication] users.list failed (thread):', err.message);
    }

    let fetched = [];
    try {
      // Best-effort join so the bot can read the thread (see /messages).
      try {
        const joined = await conversationsJoin(integration, integration.slackChannelId);
        if (!joined.ok) {
          console.warn(`[communication/thread] conversations.join not ok:`, joined.error);
        }
      } catch (joinErr) {
        console.warn('[communication/thread] conversations.join error:', joinErr.message);
      }
      const replies = await fetchConversationReplies(
        integration,
        integration.slackChannelId,
        threadTs
      );
      if (replies.ok && Array.isArray(replies.messages)) {
        fetched = replies.messages;
      }
    } catch (err) {
      console.error('[communication/thread] fetch error:', err.message);
    }

    const persisted = [];
    for (const raw of fetched) {
      const doc = await upsertMessage({
        organizationId: req.organizationId,
        integration,
        userMap,
        raw: { ...raw, channel: integration.slackChannelId },
      });
      if (doc) persisted.push(doc);
    }

    // Update the parent's replyCount to match what Slack reports.
    const parentRaw = fetched.find((m) => m.ts === threadTs);
    if (parentRaw && typeof parentRaw.reply_count === 'number') {
      await SlackChannelMessage.updateOne(
        {
          organizationId: req.organizationId,
          channelId: integration.slackChannelId,
          messageTs: threadTs,
        },
        { $set: { replyCount: parentRaw.reply_count } }
      );
    }

    const docs = await SlackChannelMessage.find({
      organizationId: req.organizationId,
      channelId: integration.slackChannelId,
      threadTs,
    })
      .sort({ messageTs: 1 })
      .lean();

    return res.json({
      connected: true,
      teamName: integration.slackTeamName || 'Slack',
      channelName: integration.slackChannelName || null,
      workspaceName,
      threadTs,
      messages: docs.map(toClientMessage),
    });
  } catch (err) {
    console.error('[communication/thread] error:', err.message);
    return res.status(500).json({ error: 'Unable to load thread.' });
  }
});

module.exports = router;
