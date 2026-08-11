/**
 * Centralized permission definitions for PulseOps RBAC.
 *
 * Roles are resolved by `verifyTenantAccess` (from the active workspace
 * OrganizationMember) and exposed on `req.userRole`. Route guards should use
 * the `requirePermission` middleware (see ../middleware/requirePermission.js)
 * instead of hard-coded role comparisons:
 *
 *   router.get('/x', authenticate, verifyTenantAccess, requirePermission('view_projects'), handler)
 *
 * The `owner` role is the workspace-owner super-role created during onboarding;
 * it is retained here so the existing owner/admin gating keeps working. The
 * four assignable team roles are: admin, maintainer, developer, viewer.
 */

const PERMISSIONS = [
  'manage_workspace',
  'manage_members',
  'invite_members',
  'manage_projects',
  'manage_repositories',
  'manage_integrations',
  'view_projects',
  'view_reports',
  'generate_reports',
];

const ROLE_PERMISSIONS = {
  // Workspace owner — full access (workspace creator / super-admin).
  owner: [
    'manage_workspace',
    'manage_members',
    'invite_members',
    'manage_projects',
    'manage_repositories',
    'manage_integrations',
    'view_projects',
    'view_reports',
    'generate_reports',
  ],
  // Full workspace administration (no ownership/settings ownership edge).
  admin: [
    'manage_workspace',
    'invite_members',
    'manage_members',
    'manage_projects',
    'manage_repositories',
    'manage_integrations',
    'view_projects',
    'view_reports',
    'generate_reports',
  ],
  // High-level workspace/project management.
  maintainer: [
    'manage_members',
    'invite_members',
    'manage_projects',
    'manage_repositories',
    'manage_integrations',
    'view_projects',
    'view_reports',
    'generate_reports',
  ],
  // Development / work execution.
  developer: [
    'manage_projects',
    'manage_repositories',
    'view_projects',
    'view_reports',
    'generate_reports',
  ],
  // Read-only.
  viewer: ['view_projects', 'view_reports'],
};

/**
 * Returns true when the given role is granted `permission`.
 * Unknown roles and unknown permissions return false (fail closed).
 */
const hasPermission = (role, permission) => {
  const perms = ROLE_PERMISSIONS[role];
  return Array.isArray(perms) && perms.includes(permission);
};

module.exports = { PERMISSIONS, ROLE_PERMISSIONS, hasPermission };
