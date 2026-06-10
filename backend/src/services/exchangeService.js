const axios = require('axios');
const { getRedis, isRedisReady } = require('../config/redis');
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

const getTTL = (currency) => {
  if (currency === 'KES') return 25 * 60; // 25 minutes
  return 60 * 60; // 60 minutes
};

const refreshExchangeRates = async () => {
  try {
    const res = await axios.get(
      `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY}/latest/USD`,
      { timeout: 5000 }
    );
    const rates = res.data.conversion_rates;
    
    if (isRedisReady() && rates) {
      const redis = getRedis();
      const targetCurrencies = Object.keys(FALLBACK_RATES).filter(c => c !== 'USD');
      for (const currency of targetCurrencies) {
        if (rates[currency]) {
          await redis.setex(`rate:${currency}`, getTTL(currency), rates[currency].toString());
        }
      }
    }
    logger.info('Updated exchange rates from bulk endpoint.');
  } catch (err) {
    logger.warn(`Failed to update exchange rates: ${err.message}`);
  }
};

const getCurrencyRate = async (currency) => {
  if (currency === 'USD') return 1;
  try {
    if (isRedisReady()) {
      const redis = getRedis();
      const cached = await redis.get(`rate:${currency}`);
      if (cached) return parseFloat(cached);
    }

    // Try to refresh all rates if cache miss
    await refreshExchangeRates();
    
    if (isRedisReady()) {
      const redis = getRedis();
      const cached = await redis.get(`rate:${currency}`);
      if (cached) return parseFloat(cached);
    }

    return FALLBACK_RATES[currency] || 1;
  } catch (err) {
    logger.warn(`Using fallback rate for ${currency}: ${err.message}`);
    return FALLBACK_RATES[currency] || 1;
  }
};

module.exports = { getCurrencyRate, refreshExchangeRates };
