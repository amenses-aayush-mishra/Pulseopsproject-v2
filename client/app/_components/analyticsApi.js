/**
 * analyticsApi.js — client helpers for the analytics endpoints.
 * Same conventions as aiSummaryApi.js (plain CJS so Node tests can require it).
 */
const API_BASE = process.env.NEXT_PUBLIC_EXPRESS_API_URL || 'http://localhost:5000';

const DASHBOARD_ENDPOINT = `${API_BASE}/api/analytics/dashboard`;
const DEVELOPERS_ENDPOINT = `${API_BASE}/api/analytics/developers`;

function buildHeaders(token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${String(token).trim()}`;
  return headers;
}

/** Org health score, KPI cards w/ trends, team health list, risks & alerts. */
async function fetchDashboard(orgId, days = 7, token = null) {
  const res = await fetch(`${DASHBOARD_ENDPOINT}?days=${days}`, {
    headers: { ...buildHeaders(token), 'x-organization-id': orgId },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.message || `Failed to load dashboard analytics (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return json?.data || null;
}

/** Per-developer stats table for the Developers page. */
async function fetchDevelopers(orgId, days = 30, token = null) {
  const res = await fetch(`${DEVELOPERS_ENDPOINT}?days=${days}`, {
    headers: { ...buildHeaders(token), 'x-organization-id': orgId },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.message || `Failed to load developers (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return json?.data || [];
}

module.exports = { API_BASE, fetchDashboard, fetchDevelopers };