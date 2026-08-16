'use strict';
const { decrypt, encrypt } = require('../utils/crypto');

const ATLASSIAN_TOKEN_URL = 'https://auth.atlassian.com/oauth/token';

/**
 * Transparently refreshes the Jira access token if expired or about to expire.
 * @param {object} integration - Mongoose document for Jira Integration.
 * @returns {Promise<string>} - Decrypted valid access token.
 */
async function getOrRefreshAccessToken(integration) {
  if (!integration) {
    throw new Error('Integration document is required');
  }

  const now = Date.now();
  const expiresAt = integration.metadata?.expiresAt || 0;
  const isExpired = now >= expiresAt - 60000; // 60s buffer

  let accessToken = integration.accessToken ? decrypt(integration.accessToken) : null;
  let refreshToken = integration.refreshToken ? decrypt(integration.refreshToken) : null;

  if (!isExpired && accessToken) {
    return accessToken;
  }

  if (!refreshToken) {
    if (accessToken) return accessToken;
    throw new Error('No refresh token available for Jira integration');
  }

  const clientId = process.env.JIRA_INTEGRATION_CLIENT_ID;
  const clientSecret = process.env.JIRA_INTEGRATION_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Jira integration OAuth credentials are not configured');
  }

  const res = await fetch(ATLASSIAN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    console.error('[jiraClient] Token refresh failed with status:', res.status);
    throw new Error('Failed to refresh Jira access token');
  }

  integration.accessToken = encrypt(data.access_token);
  if (data.refresh_token) {
    integration.refreshToken = encrypt(data.refresh_token);
  }
  integration.metadata = {
    ...(integration.metadata || {}),
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
  await integration.save();

  return data.access_token;
}

/**
 * Centralized Jira API client.
 * Calls Jira Cloud REST API using the stored cloudId and encrypted access token.
 *
 * @param {string} path - API endpoint path, e.g. '/rest/api/3/project/search'.
 * @param {object} integration - Jira Integration document.
 * @param {object} [options] - Standard fetch options.
 * @returns {Promise<Response>}
 */
async function jiraRequest(path, integration, options = {}) {
  const cloudId = integration?.metadata?.cloudId;
  if (!cloudId) {
    throw new Error('Jira Cloud site ID (cloudId) not found in integration metadata');
  }

  let token = await getOrRefreshAccessToken(integration);
  const baseUrl = `https://api.atlassian.com/ex/jira/${cloudId}`;
  const url = `${baseUrl}${path.startsWith('/') ? path : '/' + path}`;

  let res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  // Handle rare edge-case where token expired server-side before expiresAt
  if (res.status === 401 && integration.refreshToken) {
    try {
      // Force refresh by resetting expiresAt buffer
      integration.metadata = { ...(integration.metadata || {}), expiresAt: 0 };
      token = await getOrRefreshAccessToken(integration);

      res = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });
    } catch (err) {
      console.error('[jiraClient] Retry after 401 failed:', err.message);
    }
  }

  return res;
}

module.exports = { jiraRequest, getOrRefreshAccessToken };
