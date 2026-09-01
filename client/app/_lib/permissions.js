/**
 * Single source of truth permission helper for PulseOps Client (Frontend).
 * Kept in sync with server/src/config/permissions.js.
 */

export const ROLE_PERMISSIONS = {
  owner: [
    'manage_workspace',
    'manage_members',
    'invite_members',
    'view_team',
    'manage_integrations',
    'view_integrations',
    'view_developers',
    'manage_projects',
    'view_projects',
    'view_repositories',
    'view_communication',
    'generate_reports',
    'view_reports',
    'view_analytics',
    'manage_tasks',
    'view_tasks',
    'manage_tickets',
    'view_tickets',
  ],
  admin: [
    'manage_members',
    'invite_members',
    'view_team',
    'manage_integrations',
    'view_integrations',
    'view_developers',
    'manage_projects',
    'view_projects',
    'view_repositories',
    'view_communication',
    'generate_reports',
    'view_reports',
    'view_analytics',
    'manage_tasks',
    'view_tasks',
    'manage_tickets',
    'view_tickets',
  ],
  maintainer: [
    'manage_members',
    'invite_members',
    'view_team',
    'manage_integrations',
    'view_integrations',
    'view_developers',
    'manage_projects',
    'view_projects',
    'view_repositories',
    'view_communication',
    'generate_reports',
    'view_reports',
    'view_analytics',
    'manage_tasks',
    'view_tasks',
    'manage_tickets',
    'view_tickets',
  ],
  developer: [
    'manage_integrations',
    'view_integrations',
    'view_projects',
    'view_repositories',
    'view_communication',
    'view_reports',
    'view_analytics',
    'manage_tasks',
    'view_tasks',
    'manage_tickets',
    'view_tickets',
  ],
  viewer: [
    'view_repositories',
    'view_communication',
    'view_reports',
    'view_analytics',
    'view_tasks',
    'view_tickets',
  ],
};

export function hasPermission(role, permission) {
  if (!role || typeof role !== 'string') return false;
  const perms = ROLE_PERMISSIONS[role.toLowerCase()];
  return Array.isArray(perms) && perms.includes(permission);
}
