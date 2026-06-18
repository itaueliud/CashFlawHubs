const IpLog = require('../models/IpLog');

let geoip = null;
try {
  geoip = require('geoip-lite');
} catch (_) {
  geoip = null;
}

const captureIp = async (req, res, next) => {
  const captureOnFinish = async () => {
    if (!req.user) return;
    try {
      const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
        || req.socket?.remoteAddress
        || req.ip
        || 'unknown';

      const geo = geoip ? geoip.lookup(ip) : null;

      await IpLog.findOneAndUpdate(
        { ip, userId: req.user._id },
        {
          $set: {
            lastSeen: new Date(),
            userAgent: req.headers['user-agent'] || null,
            country: geo?.country || null,
            region: geo?.region || null,
            city: geo?.city || null,
          },
          $inc: { loginCount: 1 },
          $setOnInsert: { firstSeen: new Date() },
        },
        { upsert: true, new: true }
      );
    } catch (_) {
      // best effort logging only
    }
  };

  res.on('finish', captureOnFinish);
  return next();
};

module.exports = captureIp;
