const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const devAuthStore = require('../services/devAuthStore');
const { isUserActivated } = require('../utils/activationWindow');
const logger = require('../utils/logger');
const { getRedis } = require('../config/redis');

const getCookieValue = (cookieHeader = '', name) => {
  const pattern = new RegExp(`(?:^|;\\s*)${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`);
  const match = String(cookieHeader || '').match(pattern);
  return match ? decodeURIComponent(match[1]) : null;
};

const getAuthTokenFromRequest = (req) => {
  const bearerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.split(' ')[1]
    : null;
  if (bearerToken) return bearerToken;

  return req.cookies?.token || getCookieValue(req.headers.cookie, 'token');
};

exports.protect = async (req, res, next) => {
  try {
    const token = getAuthTokenFromRequest(req);
    if (!token) return res.status(401).json({ success: false, message: 'Not authorized' });

    // Check token blacklist (revoked on logout)
    try {
      const redis = getRedis();
      const blacklisted = await redis.get(`blacklist:token:${token}`);
      if (blacklisted) {
        return res.status(401).json({ success: false, message: 'Token revoked' });
      }
    } catch (e) {
      // Best effort; if redis is down we continue and rely on token verification
      logger.warn(`Redis blacklist check failed: ${e.message}`);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = mongoose.connection.readyState === 1
      ? await User.findById(decoded.id)
      : (process.env.NODE_ENV === 'production'
          ? null
          : devAuthStore.findById(decoded.id));
    if (!user || !user.isActive || user.isBanned) {
      return res.status(401).json({ success: false, message: 'User not found or suspended' });
    }

    // Validate portal claim inside JWT matches actual user role
    try {
      const portalClaim = String(decoded.portal || '').toLowerCase();
      if (portalClaim) {
        const PORTAL_ROLES = {
          admin: ['admin', 'superadmin'],
          ledger: ['ledger'],
          superadmin: ['superadmin'],
          '': ['user'],
        };
        const allowed = PORTAL_ROLES[portalClaim] || [];
        if (!allowed.includes(String(user.role || 'user').toLowerCase())) {
          const idForLog = user.email || user.phone || user.userId || user._id;
          const redacted = String(idForLog || '').replace(/.(?=.{2})/g, '*');
          logger.warn(`JWT portal claim mismatch: portal=${portalClaim} userRole=${user.role} identifier=${redacted} ip=${req.ip || req.socket?.remoteAddress}`);
          return res.status(401).json({ success: false, message: 'Token invalid or expired' });
        }
      }
    } catch (e) {
      // If anything goes wrong validating portal claim, fail closed
      logger.warn(`Error validating portal claim: ${e.message}`);
      return res.status(401).json({ success: false, message: 'Token invalid or expired' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

exports.adminOnly = (req, res, next) => {
  if (!['admin', 'superadmin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

exports.superadminOnly = (req, res, next) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ success: false, message: 'Superadmin access required' });
  }
  next();
};

exports.ledgerOnly = (req, res, next) => {
  if (req.user.role !== 'ledger') {
    return res.status(403).json({ success: false, message: 'Ledger access required' });
  }
  next();
};

exports.ledgerOrSuperadminOnly = (req, res, next) => {
  if (!['ledger', 'superadmin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Ledger or superadmin access required' });
  }
  next();
};

exports.staffOnly = (req, res, next) => {
  if (!['admin', 'superadmin', 'ledger'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Staff access required' });
  }
  next();
};

exports.requireActivation = (req, res, next) => {
  if (!isUserActivated(req.user)) {
    return res.status(403).json({ success: false, message: 'Account activation required' });
  }
  next();
};

exports.requireTestUserModuleAccess = (moduleLabel = 'this module') => (req, res, next) => {
  if (req.user.role === 'user') {
    req.moduleAccessType = String(req.user.userAccessType || 'real');
  }
  return next();
};

exports.requireTestUserActionAccess = (moduleLabel = 'this module') => (req, res, next) => {
  if (req.user.role !== 'user') return next();
  if (String(req.user.userAccessType || 'real') === 'test') return next();
  return res.status(403).json({
    success: false,
    code: 'MODULE_PREVIEW_ONLY',
    message: `${moduleLabel} is preview-only for real users.`,
    description: `You can browse ${moduleLabel.toLowerCase()} options, but actions stay locked until rollout completes.`,
  });
};

exports.getAuthTokenFromRequest = getAuthTokenFromRequest;
