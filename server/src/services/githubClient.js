'use strict';
const { decrypt } = require('../utils/crypto');

const GITHUB_API = 'https://api.github.com';

/**
 * Shared GitHub API client.
 *
 * Calls the GitHub REST API with the requesting organization's stored
 * (encrypted) access token. This is the single GitHub client in the codebase —
 * it is reused by the GitHub integration routes and the repository
 * intelligence dashboard endpoint, so there is exactly one implementation of
 * the auth/header wiring.
 *
 * @param {string} path        - API path, e.g. '/repos/owner/name/commits'.
 * @param {object} integration - Integration doc (provider github) with
 *                               accessToken (encrypted at rest).
 * @param {object} [options]   - fetch options (method, body, headers, ...).
 * @returns {Promise<Response>}
 */
async function githubRequest(path, integration, options = {}) {
  const token = decrypt(integration.accessToken);
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  return res;
}

module.exports = { githubRequest, GITHUB_API };