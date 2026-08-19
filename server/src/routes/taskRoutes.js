'use strict';
const express = require('express');
const authenticate = require('../middleware/authenticate');
const verifyTenantAccess = require('../middleware/verifyTenantAccess');
const requirePermission = require('../middleware/requirePermission');
const JiraIssue = require('../models/JiraIssue');

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/tasks
// Returns all Jira issues synced into this workspace, shaped as tasks.
// Mirrors GET /api/repositories exactly (same auth chain, same tenant scoping).
// ---------------------------------------------------------------------------
router.get(
  '/',
  authenticate,
  verifyTenantAccess,
  requirePermission('view_projects'),
  async (req, res) => {
    try {
      const docs = await JiraIssue.find({ organizationId: req.organizationId })
        .sort({ updatedAt: -1 })
        .lean();

      const tasks = docs.map((d) => ({
        _id: d._id,
        source: 'jira',
        key: d.jiraKey || null,
        projectKey: d.projectKey || null,
        title: d.summary || '',
        status: d.status || null,
        issueType: d.issueType || null,
        priority: d.priority || null,
        assignee: d.assignee || null,
        url: d.url || null,
        createdAt: d.createdAt || null,
        updatedAt: d.updatedAt || null,
      }));

      return res.status(200).json({ tasks });
    } catch (err) {
      console.error('[tasks] error:', err.message);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
);

module.exports = router;
