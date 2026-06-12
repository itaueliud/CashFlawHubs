// Safaricom's official callback IP ranges (verify current list at developer.safaricom.co.ke)
const SAFARICOM_IPS = [
  '196.201.214.200',
  '196.201.214.206',
  '196.201.213.114',
  '196.201.214.207',
  '196.201.214.208',
  '196.201.213.44',
  '196.201.212.127',
  '196.201.212.138',
  '196.201.212.129',
  '196.201.212.136',
  '196.201.212.74',
  '196.201.212.69',
];

module.exports = (req, res, next) => {
  const env = String(process.env.DARAJA_ENV || 'sandbox').toLowerCase();
  if (env !== 'live' && env !== 'production') return next();

  const callbackKey = process.env.DARAJA_CALLBACK_KEY || process.env.MPESA_CALLBACK_KEY;
  if (callbackKey && String(req.query?.key || '') === callbackKey) {
    return next();
  }

  const enforceIpWhitelist = String(process.env.DARAJA_ENFORCE_IP_WHITELIST || 'false').toLowerCase() === 'true';
  if (!enforceIpWhitelist) return next();

  const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim();
  if (!ip || !SAFARICOM_IPS.includes(ip)) {
    return res.status(403).json({ received: false, reason: 'Unauthorized origin' });
  }
  next();
};
