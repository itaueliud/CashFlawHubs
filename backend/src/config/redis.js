const Redis = require('ioredis');
const logger = require('../utils/logger');

let redisClient;
let redisReady = false;
let redisReconnectAborted = false;
let lastRedisErrorLogAt = 0;

const REDIS_MAX_RETRY_LIMIT = Number(process.env.REDIS_MAX_RETRY_LIMIT || 0); // 0 = unlimited
const REDIS_RETRY_MAX_DELAY_MS = Number(process.env.REDIS_RETRY_MAX_DELAY_MS || 5000);
const REDIS_CONNECT_TIMEOUT_MS = Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 10000);

const connectRedis = () => {
  redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
    retryStrategy: (times) => {
      if (REDIS_MAX_RETRY_LIMIT > 0 && times > REDIS_MAX_RETRY_LIMIT) {
        if (!redisReconnectAborted) {
          logger.warn('Redis reconnect limit reached. Stopping retries until backend restart.');
          redisReconnectAborted = true;
        }
        return null;
      }
      redisReconnectAborted = false;
      return Math.min(times * 250, REDIS_RETRY_MAX_DELAY_MS);
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
    const now = Date.now();
    if (now - lastRedisErrorLogAt < 3000) return;
    lastRedisErrorLogAt = now;

    const detail = err?.message || err?.toString?.() || 'Unknown Redis error';
    if (err?.name === 'AggregateError' && Array.isArray(err.errors)) {
      const root = err.errors.map((e) => e?.message || String(e)).join(' | ');
      logger.error(`Redis error: AggregateError (${root})`);
      return;
    }
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
