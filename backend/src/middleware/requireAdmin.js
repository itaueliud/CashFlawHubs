module.exports = function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  if (!['admin', 'superadmin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

module.exports.requireSuperadmin = function requireSuperadmin(req, res, next) {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ message: 'Superadmin access required' });
  }
  next();
};

module.exports.requireLedger = function requireLedger(req, res, next) {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  if (!['ledger', 'superadmin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Ledger access required' });
  }
  next();
};
