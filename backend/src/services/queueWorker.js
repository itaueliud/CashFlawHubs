const logger = require('../utils/logger');

let channel = null;
let useRedisQueue = false;
const { getRedis, isRedisReady } = require('../config/redis');

const QUEUES = {
  PAYMENT_ACTIVATION: 'payment.activation',
  WITHDRAWAL_PROCESS: 'withdrawal.process',
  NOTIFICATION_ACTIVATION: 'notification.activation',
  NOTIFICATION_REFERRAL: 'notification.referral',
};

// Initialize queue — tries RabbitMQ first, falls back to Redis list queue
const startQueueWorker = async () => {
  try {
    const amqplib = require('amqplib');
    const connection = await amqplib.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    channel = await connection.createChannel();

    // Declare queues
    for (const queue of Object.values(QUEUES)) {
      await channel.assertQueue(queue, { durable: true });
    }

    // Consume payment activation
    channel.consume(QUEUES.PAYMENT_ACTIVATION, async (msg) => {
      if (!msg) return;
      try {
        const data = JSON.parse(msg.content.toString());
        const { processActivationPayment } = require('../controllers/paymentController');
        await processActivationPayment(data);
        channel.ack(msg);
      } catch (err) {
        logger.error(`Queue worker error (payment.activation): ${err.message}`);
        channel.nack(msg, false, false); // Dead-letter
      }
    });

    // Consume withdrawal process
    channel.consume(QUEUES.WITHDRAWAL_PROCESS, async (msg) => {
      if (!msg) return;
      try {
        const data = JSON.parse(msg.content.toString());
        const { processWithdrawal } = require('../controllers/withdrawalController');
        await processWithdrawal(data);
        channel.ack(msg);
      } catch (err) {
        logger.error(`Queue worker error (withdrawal.process): ${err.message}`);
        channel.nack(msg, false, false);
      }
    });

    // Consume notifications
    channel.consume(QUEUES.NOTIFICATION_ACTIVATION, async (msg) => {
      if (!msg) return;
      try {
        const data = JSON.parse(msg.content.toString());
        const { sendActivationNotification } = require('./notificationService');
        await sendActivationNotification(data);
        channel.ack(msg);
      } catch (err) {
        logger.error(`Queue worker error (notification): ${err.message}`);
        channel.ack(msg); // Don't retry notifications
      }
    });

    logger.info('RabbitMQ queue worker started');
  } catch (error) {
    if (isRedisReady()) {
      logger.warn(`RabbitMQ unavailable, falling back to Redis queue: ${error.message}`);
      useRedisQueue = true;
      startRedisQueuePoller();
      return;
    }

    logger.warn(`RabbitMQ unavailable and Redis is not ready; background queue disabled: ${error.message}`);
  }
};

// Redis-based fallback queue (simple list-based)
const startRedisQueuePoller = async () => {
  if (!isRedisReady()) {
    logger.warn('Redis queue poller skipped because Redis is not ready');
    return;
  }

  const redis = getRedis();
  logger.info('Redis queue poller started');

  const pollQueue = async () => {
    try {
      const queues = Object.values(QUEUES);
      for (const queue of queues) {
        const raw = await redis.lpop(`queue:${queue}`);
        if (raw) {
          const data = JSON.parse(raw);
          await processQueueMessage(queue, data);
        }
      }
    } catch (err) {
      logger.error(`Redis queue poll error: ${err.message}`);
    }
    setTimeout(pollQueue, 1000); // Poll every second
  };

  pollQueue();
};

const processQueueMessage = async (queue, data) => {
  switch (queue) {
    case QUEUES.PAYMENT_ACTIVATION: {
      const { processActivationPayment } = require('../controllers/paymentController');
      await processActivationPayment(data);
      break;
    }
    case QUEUES.WITHDRAWAL_PROCESS: {
      const { processWithdrawal } = require('../controllers/withdrawalController');
      await processWithdrawal(data);
      break;
    }
    case QUEUES.NOTIFICATION_ACTIVATION: {
      const { sendActivationNotification } = require('./notificationService');
      await sendActivationNotification(data);
      break;
    }
  }
};

// Publish message to queue
const publishToQueue = async (queueName, data) => {
  try {
    if (channel && !useRedisQueue) {
      channel.sendToQueue(queueName, Buffer.from(JSON.stringify(data)), { persistent: true });
    } else if (useRedisQueue && isRedisReady()) {
      const redis = getRedis();
      await redis.rpush(`queue:${queueName}`, JSON.stringify(data));
    } else {
      await processQueueMessage(queueName, data);
      logger.info(`Processed ${queueName} synchronously`);
      return;
    }
    logger.info(`Published to ${queueName}: ${JSON.stringify(data)}`);
  } catch (error) {
    logger.error(`publishToQueue error: ${error.message}`);
    // Last resort: process synchronously
    await processQueueMessage(queueName, data);
  }
};

module.exports = { startQueueWorker, publishToQueue, QUEUES };
