'use strict';
const express = require('express');
const mongoose = require('mongoose');
const authenticate = require('../middleware/authenticate');
const verifyTenantAccess = require('../middleware/verifyTenantAccess');
const requirePermission = require('../middleware/requirePermission');
const Repository = require('../models/Repository');
const Integration = require('../models/Integration');
const { githubRequest } = require('../services/githubClient');

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

// ---------------------------------------------------------------------------
// GET /api/repositories/:repositoryId
// Repository Intelligence — combines the imported Repository document with live
// GitHub data (repo detail, commits, contributors, pull requests) fetched with
// the org's stored OAuth token via the shared githubClient service. Each GitHub
// section degrades gracefully so the dashboard still renders if one call fails.
// ---------------------------------------------------------------------------
router.get(
  '/:repositoryId',
  authenticate,
  verifyTenantAccess,
  requirePermission('view_projects'),
  async (req, res) => {
    try {
      const { repositoryId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(repositoryId)) {
        return res.status(404).json({ message: 'Repository not found.' });
      }

      const repository = await Repository.findOne({
        _id: repositoryId,
        organizationId: req.organizationId,
      }).lean();

      if (!repository) {
        return res.status(404).json({ message: 'Repository not found.' });
      }

      const integration = await Integration.findOne({
        organizationId: req.organizationId,
        provider: 'github',
        status: 'active',
      });
      if (!integration?.accessToken) {
        return res
          .status(404)
          .json({ message: 'GitHub is not connected for this workspace.' });
      }

      const fullName = repository.fullName || repository.name;
      const branch = repository.defaultBranch || 'main';

      const [detailResult, commitsResult, contributorsResult, pullsResult] =
        await Promise.allSettled([
          githubRequest(`/repos/${fullName}`, integration),
          githubRequest(
            `/repos/${fullName}/commits?per_page=10&sha=${encodeURIComponent(branch)}`,
            integration
          ),
          githubRequest(`/repos/${fullName}/contributors?per_page=10`, integration),
          githubRequest(
            `/repos/${fullName}/pulls?state=all&per_page=30&sort=updated&direction=desc`,
            integration
          ),
        ]);

      const readJson = async (result) =>
        result.status === 'fulfilled' && result.value.ok
          ? result.value.json()
          : null;

      const [detail, commits, contributors, pulls] = await Promise.all([
        readJson(detailResult),
        readJson(commitsResult),
        readJson(contributorsResult),
        readJson(pullsResult),
      ]);

      const formattedCommits = (commits || []).slice(0, 10).map((c) => ({
        sha: c.sha,
        shortSha: c.sha ? c.sha.slice(0, 7) : null,
        message: c.commit?.message?.split('\n')[0] || 'No message',
        authorName: c.commit?.author?.name || c.author?.login || 'Unknown',
        authorLogin: c.author?.login || null,
        avatarUrl: c.author?.avatar_url || null,
        date: c.commit?.author?.date || c.created_at || null,
        htmlUrl: c.html_url || null,
      }));

      const formattedContributors = (contributors || []).map((ctr) => ({
        login: ctr.login,
        avatarUrl: ctr.avatar_url,
        contributions: ctr.contributions,
        htmlUrl: ctr.html_url,
      }));

      const pullsList = pulls || [];
      const openPRs = pullsList.filter((p) => p.state === 'open');
      const mergedPRs = pullsList.filter(
        (p) => p.state === 'closed' && (p.merged_at || p.pull_request?.merged_at)
      );
      const closedPRs = pullsList.filter(
        (p) => p.state === 'closed' && !(p.merged_at || p.pull_request?.merged_at)
      );

      const formattedPRs = pullsList.slice(0, 8).map((p) => ({
        number: p.number,
        title: p.title,
        state: p.state,
        merged: !!(p.merged_at || p.pull_request?.merged_at),
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        authorLogin: p.user?.login || null,
        avatarUrl: p.user?.avatar_url || null,
        htmlUrl: p.html_url,
      }));

      // Light activity summary derived from live commit data.
      const now = Date.now();
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      const commitsLast7d = formattedCommits.filter(
        (c) => c.date && now - new Date(c.date).getTime() < weekMs
      ).length;

      return res.status(200).json({
        repository: {
          _id: repository._id,
          name: repository.name,
          fullName: repository.fullName || repository.name,
          private: repository.private,
          htmlUrl: repository.htmlUrl,
          defaultBranch: branch,
          importedAt: repository.createdAt,
        },
        github: {
          detail: detail
            ? {
                fullName: detail.full_name,
                name: detail.name,
                private: detail.private,
                defaultBranch: detail.default_branch,
                createdAt: detail.created_at,
                updatedAt: detail.updated_at,
                stargazersCount: detail.stargazers_count ?? 0,
                forksCount: detail.forks_count ?? 0,
                openIssuesCount: detail.open_issues_count ?? 0,
                language: detail.language || null,
                description: detail.description || null,
                htmlUrl: detail.html_url,
              }
            : null,
          commits: formattedCommits,
          contributors: formattedContributors,
          pullRequests: {
            open: openPRs.length,
            merged: mergedPRs.length,
            closed: closedPRs.length,
            recent: formattedPRs,
          },
          activity: {
            commitsLast7d,
            contributorCount: formattedContributors.length,
          },
        },
      });
    } catch (err) {
      console.error('[repositories/:id] error:', err.message);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
);

module.exports = router;
