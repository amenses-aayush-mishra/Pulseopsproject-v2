const OrganizationMember = require('../models/OrganizationMember');

const verifyTenantAccess = async (req, res, next) => {
  const targetOrgId =
    (req.params && req.params.organizationId) ||
    req.headers['x-organization-id'] ||
    (req.user && req.user.activeOrganizationId) ||
    null;

  if (!targetOrgId) {
    return res.status(400).json({ message: 'Missing organization context.' });
  }

  if (!req.user || !req.user.userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const membership = await OrganizationMember.findOne({
      organizationId: targetOrgId,
      userId: req.user.userId,
      status: 'active',
    });

    if (!membership) {
      return res
        .status(403)
        .json({ message: 'Forbidden. No active membership in this workspace.' });
    }

    req.organizationId = targetOrgId;
    req.userRole = membership.role;
    next();
  } catch (err) {
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = verifyTenantAccess;