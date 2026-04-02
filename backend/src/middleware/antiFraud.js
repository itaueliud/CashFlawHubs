const { getRedis } = require('../config/redis');
const logger = require('../utils/logger');

// Track suspicious IPs
exports.ipMonitor = async (req, res, next) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;
    const redis = getRedis();

    const key = `ip:accounts:${ip}`;
    const count = await redis.incr(key);
    await redis.expire(key, 86400); // 24h window

    if (count > 5) {
      logger.warn(`Suspicious IP: ${ip} created ${count} accounts in 24h`);
      if (count > 10) {
        return res.status(429).json({
          success: false,
          message: 'Too many accounts from this IP. Contact support.',
        });
      }
    }

    req.clientIp = ip;
    next();
  } catch (error) {
    next(); // Don't block on redis errors
  }
};

// Store device fingerprint
exports.deviceFingerprint = async (req, res, next) => {
  try {
    const fingerprint = req.headers['x-device-fingerprint'];
    if (!fingerprint) return next();

    const redis = getRedis();
    const key = `device:${fingerprint}`;
    const userId = await redis.get(key);

    if (userId && userId !== req.user?.id?.toString()) {
      logger.warn(`Device fingerprint conflict: ${fingerprint} used by ${userId} and ${req.user?.id}`);
      // Flag for review but don't block yet
      req.suspiciousDevice = true;
    }

    if (req.user) {
      await redis.setex(key, 86400 * 30, req.user.id.toString());
    }

    next();
  } catch (error) {
    next();
  }
};

// Rate limit survey/task completions
exports.completionRateLimit = async (req, res, next) => {
  try {
    const redis = getRedis();
    const key = `completion:rate:${req.user.id}:${Math.floor(Date.now() / 300000)}`; // 5 min window
    const count = await redis.incr(key);
    await redis.expire(key, 300);

    if (count > 20) {
      logger.warn(`Abnormal completion rate for user ${req.user.id}: ${count} in 5 min`);
      return res.status(429).json({
        success: false,
        message: 'Slow down! Unusual activity detected.',
      });
    }
    next();
  } catch (error) {
    next();
  }
};
