const Redis = require('ioredis');
const logger = require('../utils/logger');

let redisClient;
let redisReady = false;

const connectRedis = () => {
  redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 50, 2000),
    lazyConnect: true,
  });

  redisClient.on('connect', () => logger.info('Redis connected'));
  redisClient.on('ready', () => {
    redisReady = true;
  });
  redisClient.on('error', (err) => logger.error(`Redis error: ${err.message}`));
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
