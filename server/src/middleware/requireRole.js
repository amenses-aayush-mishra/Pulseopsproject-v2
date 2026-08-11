const requireRole = (allowedRoles = []) => (req, res, next) => {
  if (!req.userRole || !allowedRoles.includes(req.userRole)) {
    return res.status(403).json({ message: 'Forbidden. Insufficient permissions.' });
  }
  next();
};

module.exports = requireRole;