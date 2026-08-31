/**
 * sidebarRbacConfig.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralized role-based access control (RBAC) configuration for the
 * workspace sidebar. This is the single source of truth for which sidebar
 * sections are visible to each role.
 *
 * VALID ROLES (5 total):
 *   - 'owner'       — Default role for the workspace creator
 *   - 'admin'       — Full administrative access
 *   - 'maintainer'  — Can manage repos, reports, analytics, developers, tasks
 *   - 'developer'   — Can view repos, communication, tasks; limited access
 *   - 'viewer'      — Read-only access (Overview only)
 *
 * VALID SECTION KEYS:
 *   - 'overview'        — Dashboard overview
 *   - 'workspace'       — Workspace/projects management
 *   - 'repositories'    — Repository management
 *   - 'communication'   — Communication hub
 *   - 'reports'         — Engineering health reports
 *   - 'analytics'       — Workspace analytics
 *   - 'developers'      — Developer stats
 *   - 'tasks'           — Task management
 *   - 'integrations'    — Third-party integrations
 *   - 'team'            — Team management & invitations
 *
 * VISIBILITY MATRIX:
 *   Section         | Owner | Admin | Maintainer | Developer | Viewer
 *   ────────────────┼───────┼───────┼────────────┼───────────┼───────
 *   Overview        |  ✅   |  ✅   |     ✅     |    ✅     |  ✅
 *   Workspace       |  ✅   |  ✅   |     ❌     |    ❌     |  ❌
 *   Repositories    |  ✅   |  ✅   |     ✅     |    ✅     |  ❌
 *   Communication   |  ✅   |  ✅   |     ✅     |    ✅     |  ❌
 *   Reports         |  ✅   |  ✅   |     ✅     |    ❌     |  ❌
 *   Analytics       |  ✅   |  ✅   |     ✅     |    ❌     |  ❌
 *   Developers      |  ✅   |  ✅   |     ✅     |    ❌     |  ❌
 *   Tasks           |  ✅   |  ✅   |     ✅     |    ✅     |  ❌
 *   Integrations    |  ✅   |  ✅   |     ❌     |    ❌     |  ❌
 *   Team            |  ✅   |  ✅   |     ❌     |    ❌     |  ❌
 *
 * TO ADD A NEW ROLE OR SECTION:
 *   1. Add the role/section key to VALID_ROLES or VALID_SECTIONS.
 *   2. Update the SECTION_ACCESS map below.
 *   3. No rendering logic changes needed — the sidebar reads this config.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** @type {string[]} All recognized role strings (lowercase). */
export const VALID_ROLES = ['owner', 'admin', 'maintainer', 'developer', 'viewer'];

/** @type {string[]} All recognized sidebar section keys (lowercase). */
export const VALID_SECTIONS = [
  'overview',
  'workspace',
  'repositories',
  'communication',
  'reports',
  'analytics',
  'developers',
  'tasks',
  'integrations',
  'team',
];

/**
 * @type {Record<string, string[]>}
 * Maps each section key to the list of roles that may see it.
 * A role not listed for a section cannot see that section.
 */
export const SECTION_ACCESS = {
  overview:      ['owner', 'admin', 'maintainer', 'developer', 'viewer'],
  workspace:     ['owner', 'admin'],
  repositories:  ['owner', 'admin', 'maintainer', 'developer'],
  communication: ['owner', 'admin', 'maintainer', 'developer'],
  reports:       ['owner', 'admin', 'maintainer'],
  analytics:     ['owner', 'admin', 'maintainer'],
  developers:    ['owner', 'admin', 'maintainer'],
  tasks:         ['owner', 'admin', 'maintainer', 'developer'],
  integrations:  ['owner', 'admin'],
  team:          ['owner', 'admin'],
};

/**
 * Check whether a given role is allowed to see a sidebar section.
 *
 * @param {string|null|undefined} role   — The user's workspace role (case-insensitive).
 * @param {string}                sectionKey — One of the VALID_SECTIONS keys.
 * @returns {boolean} True if the section should be rendered.
 *
 * SAFE DEFAULTS:
 *   - If `role` is null, undefined, empty, or not in VALID_ROLES, the user is
 *     treated as a Viewer (Overview-only access). This prevents data leaks from
 *     bad JWT payloads or future roles not yet added to this config.
 *   - If `sectionKey` is unknown, it is hidden (returns false).
 */
export function isSectionVisible(role, sectionKey) {
  const normalizedRole = (role || '').toLowerCase().trim();

  // Unknown/missing role → treat as Viewer (minimal access)
  if (!VALID_ROLES.includes(normalizedRole)) {
    return sectionKey === 'overview';
  }

  const allowedRoles = SECTION_ACCESS[sectionKey];
  if (!allowedRoles) {
    return false; // Unknown section → hide
  }

  return allowedRoles.includes(normalizedRole);
}
