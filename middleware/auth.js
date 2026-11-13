// Session & Role Authorization Middleware

const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please sign in to continue.'
    });
  }
  next();
};

const requireRole = (roles) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }
    if (!allowedRoles.includes(req.session.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Requires one of the following roles: ${allowedRoles.join(', ')}.`
      });
    }
    next();
  };
};

const optionalAuth = (req, res, next) => {
  req.user = req.session && req.session.user ? req.session.user : null;
  next();
};

module.exports = {
  requireAuth,
  requireRole,
  optionalAuth
};
