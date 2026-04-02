const axios = require('axios');
const { getRedis } = require('../config/redis');
const logger = require('../utils/logger');

// Fallback static rates (updated periodically)
const FALLBACK_RATES = {
  KES: 129.5,
  UGX: 3730,
  TZS: 2580,
  ETB: 56.5,
  GHS: 15.2,
  NGN: 1580,
  USD: 1,
};

const getCurrencyRate = async (currency) => {
  if (currency === 'USD') return 1;
  try {
    const redis = getRedis();
    const cached = await redis.get(`rate:${currency}`);
    if (cached) return parseFloat(cached);

    // Fetch live rate
    const res = await axios.get(
      `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY}/pair/USD/${currency}`,
      { timeout: 5000 }
    );
    const rate = res.data.conversion_rate;
    await redis.setex(`rate:${currency}`, 3600, rate.toString()); // Cache 1 hour
    return rate;
  } catch (err) {
    logger.warn(`Using fallback rate for ${currency}: ${err.message}`);
    return FALLBACK_RATES[currency] || 1;
  }
};

const refreshExchangeRates = async () => {
  const currencies = ['KES', 'UGX', 'TZS', 'ETB', 'GHS', 'NGN'];
  for (const currency of currencies) {
    try {
      const redis = getRedis();
      const res = await axios.get(
        `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY}/pair/USD/${currency}`,
        { timeout: 5000 }
      );
      const rate = res.data.conversion_rate;
      await redis.setex(`rate:${currency}`, 3600, rate.toString());
      logger.info(`Updated rate: 1 USD = ${rate} ${currency}`);
    } catch (err) {
      logger.warn(`Failed to update rate for ${currency}: ${err.message}`);
    }
  }
};

module.exports = { getCurrencyRate, refreshExchangeRates };
