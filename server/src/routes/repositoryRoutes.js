'use strict';
const express = require('express');
const authenticate = require('../middleware/authenticate');
const verifyTenantAccess = require('../middleware/verifyTenantAccess');
const requirePermission = require('../middleware/requirePermission');
const Repository = require('../models/Repository');

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/repositories
// Returns all imported repositories for the requesting organization, newest
// first. Protected by authenticate + verifyTenantAccess and requires the
// existing `view_projects` permission (no new RBAC permissions introduced).
// ---------------------------------------------------------------------------
router.get(
  '/',
  authenticate,
  verifyTenantAccess,
  requirePermission('view_projects'),
  async (req, res) => {
    try {
      const docs = await Repository.find({ organizationId: req.organizationId })
        .sort({ createdAt: -1 })
        .lean();

      const repositories = docs.map((r) => ({
        _id: r._id,
        name: r.name,
        fullName: r.fullName,
        private: r.private,
        defaultBranch: r.defaultBranch,
        htmlUrl: r.htmlUrl,
        createdAt: r.createdAt,
      }));

      return res.status(200).json({ repositories });
    } catch (err) {
      console.error('[repositories] error:', err.message);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
);

module.exports = router;
