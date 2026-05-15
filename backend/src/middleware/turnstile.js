const axios = require('axios');
const logger = require('../utils/logger');

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const hasTurnstileSecret = () => Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.TURNSTILE_SECRET_KEY.trim());

const getTurnstileToken = (req) =>
  req.body?.turnstileToken ||
  req.body?.cfTurnstileResponse ||
  req.body?.['cf-turnstile-response'] ||
  req.headers['cf-turnstile-response'];

const verifyTurnstile = async (req, res, next) => {
  if (!hasTurnstileSecret()) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('TURNSTILE_SECRET_KEY is not configured');
      return res.status(500).json({ success: false, message: 'Security verification is not configured' });
    }

    return next();
  }

  const token = getTurnstileToken(req);
  if (!token) {
    return res.status(400).json({ success: false, message: 'Complete the security check and try again' });
  }

  try {
    const params = new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: token,
    });

    if (req.ip) {
      params.append('remoteip', req.ip);
    }

    const { data } = await axios.post(TURNSTILE_VERIFY_URL, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 8000,
    });

    if (!data?.success) {
      logger.warn(`Turnstile verification failed for ${req.method} ${req.originalUrl}: ${JSON.stringify(data?.['error-codes'] || [])}`);
      return res.status(403).json({ success: false, message: 'Security verification failed' });
    }

    return next();
  } catch (error) {
    logger.error(`Turnstile verification error for ${req.method} ${req.originalUrl}: ${error.message}`);
    return res.status(502).json({ success: false, message: 'Security verification service unavailable' });
  }
};

module.exports = { verifyTurnstile };