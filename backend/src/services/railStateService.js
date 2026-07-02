const PaymentRailState = require('../models/PaymentRailState');
const { getRedis, isRedisReady } = require('../config/redis');
const logger = require('../utils/logger');

exports.isRailEnabled = async (strategyId, country) => {
  if (strategyId.includes('flutterwave') || strategyId.includes('jenga')) return false;
  
  try {
    let state = null;
    if (isRedisReady()) {
      const redis = getRedis();
      const cached = await redis.get(`rail_state:${strategyId}`);
      if (cached) state = JSON.parse(cached);
    }
    
    if (!state) {
      state = await PaymentRailState.findOne({ strategyId }).lean();
      if (!state) {
        state = { strategyId, isEnabled: true };
      }
      if (isRedisReady()) {
        const redis = getRedis();
        await redis.set(`rail_state:${strategyId}`, JSON.stringify(state), 'EX', 300);
      }
    }
    return state.isEnabled;
  } catch (error) {
    logger.error(`isRailEnabled error: ${error.message}`);
    return true;
  }
};

exports.setRailState = async (strategyId, isEnabled, reason, userId) => {
  const state = await PaymentRailState.findOneAndUpdate(
    { strategyId },
    { 
      isEnabled, 
      disabledReason: isEnabled ? null : reason,
      lastToggledAt: new Date(),
      lastToggledBy: userId
    },
    { upsert: true, new: true }
  );

  if (isRedisReady()) {
    const redis = getRedis();
    await redis.set(`rail_state:${strategyId}`, JSON.stringify(state), 'EX', 300);
  }
  return state;
};

exports.getAllRailStates = async () => {
  const states = await PaymentRailState.find({}).lean();
  return states;
};
