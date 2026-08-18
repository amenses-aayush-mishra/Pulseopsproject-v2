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

      const [
        detailResult,
        commitsResult,
        contributorsResult,
        pullsResult,
        latestCommitResult,
        branchesResult,
        issuesResult,
        languagesResult,
      ] = await Promise.allSettled([
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
        // Tip-of-branch commit detail — carries per-file stats for Latest Commit.
        githubRequest(
          `/repos/${fullName}/commits/${encodeURIComponent(branch)}`,
          integration
        ),
        githubRequest(`/repos/${fullName}/branches?per_page=20`, integration),
        githubRequest(
          `/repos/${fullName}/issues?state=all&per_page=15`,
          integration
        ),
        githubRequest(`/repos/${fullName}/languages`, integration),
      ]);

      const readJson = async (result) =>
        result.status === 'fulfilled' && result.value.ok
          ? result.value.json()
          : null;

      const [
        detail,
        commits,
        contributors,
        pulls,
        latestCommit,
        branches,
        issues,
        languages,
      ] = await Promise.all([
        readJson(detailResult),
        readJson(commitsResult),
        readJson(contributorsResult),
        readJson(pullsResult),
        readJson(latestCommitResult),
        readJson(branchesResult),
        readJson(issuesResult),
        readJson(languagesResult),
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
        branch,
      }));

      const formattedContributors = (contributors || []).map((ctr) => ({
        login: ctr.login,
        avatarUrl: ctr.avatar_url,
        contributions: ctr.contributions,
        htmlUrl: ctr.html_url,
      }));

      // Contribution % is reliable: it is normalized from the same contributor
      // list GitHub returns (total = sum of per-contributor commit counts).
      const totalContributions = formattedContributors.reduce(
        (sum, ctr) => sum + (ctr.contributions || 0),
        0
      );
      formattedContributors.forEach((ctr) => {
        ctr.contributionPercent =
          totalContributions > 0
            ? Math.round(((ctr.contributions || 0) / totalContributions) * 100)
            : 0;
      });

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
        // head/base refs ship on the pulls list payload — no extra calls needed.
        headRef: p.head?.ref || null,
        baseRef: p.base?.ref || null,
        // labels + comment counts are present on the pulls list payload.
        labels: Array.isArray(p.labels)
          ? p.labels.map((l) => ({ name: l.name, color: l.color }))
          : [],
        commentCount: p.comments ?? null,
        reviewCommentCount: p.review_comments ?? null,
      }));

      // --- Latest commit (tip of default branch) with per-file stats ----------
      const latestCommitFiles = Array.isArray(latestCommit?.files)
        ? latestCommit.files.map((f) => ({
            filename: f.filename,
            status: f.status,
            additions: f.additions,
            deletions: f.deletions,
            changes: f.changes,
          }))
        : [];
      const latestCommitInfo = latestCommit
        ? {
            sha: latestCommit.sha,
            shortSha: latestCommit.sha ? latestCommit.sha.slice(0, 7) : null,
            message:
              latestCommit.commit?.message?.split('\n')[0] || 'No message',
            authorName:
              latestCommit.commit?.author?.name ||
              latestCommit.author?.login ||
              'Unknown',
            authorLogin: latestCommit.author?.login || null,
            avatarUrl: latestCommit.author?.avatar_url || null,
            date:
              latestCommit.commit?.author?.date || latestCommit.created_at || null,
            htmlUrl: latestCommit.html_url || null,
            branch,
            filesCount: latestCommitFiles.length,
            files: latestCommitFiles,
            additions:
              latestCommit.stats?.additions ??
              latestCommitFiles.reduce((s, f) => s + (f.additions || 0), 0),
            deletions:
              latestCommit.stats?.deletions ??
              latestCommitFiles.reduce((s, f) => s + (f.deletions || 0), 0),
          }
        : null;

      // --- Branches (name + default marker; per-branch message/date needs N+1,
      // so only the tip SHA is surfaced — clean + cheap).
      const formattedBranches = (branches || []).map((b) => ({
        name: b.name,
        default: b.name === branch,
        protected: !!b.protected,
        sha: b.commit?.sha || null,
      }));

      // --- Issues (read-only; GitHub's issues endpoint also returns PRs, so drop them)
      const formattedIssues = (issues || [])
        .filter((i) => !i.pull_request)
        .slice(0, 15)
        .map((i) => ({
          number: i.number,
          title: i.title,
          state: i.state,
          authorLogin: i.user?.login || null,
          avatarUrl: i.user?.avatar_url || null,
          labels: Array.isArray(i.labels)
            ? i.labels.map((l) => ({ name: l.name, color: l.color }))
            : [],
          createdAt: i.created_at,
          updatedAt: i.updated_at,
          htmlUrl: i.html_url,
        }));

      // --- Languages breakdown ------------------------------------------------
      const languageEntries = Object.entries(languages || {}).sort(
        (a, b) => b[1] - a[1]
      );
      const languageTotal = languageEntries.reduce((s, [, bytes]) => s + bytes, 0);
      const formattedLanguages = languageEntries.map(([name, bytes]) => ({
        name,
        bytes,
        percent:
          languageTotal > 0 ? Math.round((bytes / languageTotal) * 100) : 0,
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
                owner: detail.owner?.login || null,
                name: detail.name,
                private: detail.private,
                defaultBranch: detail.default_branch,
                createdAt: detail.created_at,
                updatedAt: detail.updated_at,
                pushedAt: detail.pushed_at || null,
                stargazersCount: detail.stargazers_count ?? 0,
                forksCount: detail.forks_count ?? 0,
                watchersCount: detail.watchers_count ?? 0,
                openIssuesCount: detail.open_issues_count ?? 0,
                language: detail.language || null,
                license: detail.license?.spdx_id || detail.license?.name || null,
                topics: Array.isArray(detail.topics) ? detail.topics : [],
                description: detail.description || null,
                htmlUrl: detail.html_url,
                archived: !!detail.archived,
                fork: !!detail.fork,
                size: detail.size ?? null,
              }
            : null,
          latestCommit: latestCommitInfo,
          commits: formattedCommits,
          contributors: formattedContributors,
          pullRequests: {
            open: openPRs.length,
            merged: mergedPRs.length,
            closed: closedPRs.length,
            recent: formattedPRs,
          },
          branches: formattedBranches,
          issues: formattedIssues,
          languages: formattedLanguages,
          activity: {
            commitsLast7d,
            contributorCount: formattedContributors.length,
            openPullRequests: openPRs.length,
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
