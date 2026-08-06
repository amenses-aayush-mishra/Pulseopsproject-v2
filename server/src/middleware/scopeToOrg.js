const scopeToOrg = (req, res, next) => {
  req.organizationId = req.user?.organizationId || null;
  next();
};

module.exports = scopeToOrg;
