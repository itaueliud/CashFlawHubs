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

const fetchExchangeRates = async () => {
  try {
    const { data } = await axios.get(
      'https://api.frankfurter.app/latest?from=USD&to=KES,TZS,UGX,GHS,ETB,NGN,ZAR',
      { timeout: 10000 }
    );
    return data.rates || null;
  } catch (err) {
    logger.warn(`Exchange rate fetch failed: ${err.message} - using cached rates`);
    return null;
  }
};

const refreshExchangeRates = async () => {
  try {
    const rates = await fetchExchangeRates();
    
    if (isRedisReady() && rates) {
      const redis = getRedis();
      const targetCurrencies = Object.keys(FALLBACK_RATES).filter(c => c !== 'USD');
      for (const currency of targetCurrencies) {
        if (rates[currency]) {
          await redis.setex(`rate:${currency}`, getTTL(currency), rates[currency].toString());
        }
      }
    }
    logger.info('Updated exchange rates from Frankfurter.');
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
