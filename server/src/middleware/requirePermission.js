const { hasPermission } = require('../config/permissions');

/**
 * requirePermission(permission) — higher-order authorization middleware.
 * Expected to run after `authenticate` + `verifyTenantAccess`, which set
 * `req.userRole` from the active workspace membership.
 * Returns HTTP 403 when the authenticated user's role lacks the permission.
 */
const requirePermission = (permission) => (req, res, next) => {
  if (!req.userRole || !hasPermission(req.userRole, permission)) {
    return res.status(403).json({ message: 'Forbidden. Insufficient permissions.' });
  }
  next();
};

module.exports = requirePermission;
