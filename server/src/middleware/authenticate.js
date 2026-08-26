const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token =
    (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null) ||
    req.query.access_token ||
    null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      userId: decoded.userId,
      activeOrganizationId: decoded.activeOrganizationId || null,
      role: decoded.role || null,
      email: decoded.email || null,
    };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Authentication required' });
  }
};

module.exports = authenticate;