const Redis = require('ioredis');
const logger = require('../utils/logger');

let redisClient;
let redisReady = false;
let redisReconnectAborted = false;

const connectRedis = () => {
  redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 8) {
        if (!redisReconnectAborted) {
          logger.warn('Redis reconnect limit reached. Stopping retries until backend restart.');
          redisReconnectAborted = true;
        }
        return null;
      }
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
  });

  redisClient.on('connect', () => {
    redisReconnectAborted = false;
    logger.info('Redis connected');
  });
  redisClient.on('ready', () => {
    redisReady = true;
  });
  redisClient.on('error', (err) => {
    const detail = err?.message || err?.toString?.() || 'Unknown Redis error';
    logger.error(`Redis error: ${detail}`);
  });
  redisClient.on('close', () => {
    redisReady = false;
    logger.warn('Redis connection closed');
  });

  return redisClient;
};

const getRedis = () => {
  if (!redisClient) throw new Error('Redis not initialized');
  return redisClient;
};

const isRedisReady = () => redisReady;

module.exports = connectRedis;
module.exports.getRedis = getRedis;
module.exports.isRedisReady = isRedisReady;
