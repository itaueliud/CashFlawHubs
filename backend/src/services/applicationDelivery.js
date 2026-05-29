const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');
const Delivery = require('../models/Delivery');
const { sendgridClient } = require('./notificationService');
// Note: avoid circular require by loading queueWorker lazily when re-queueing

const MAX_ATTEMPTS = Number(process.env.WEBHOOK_MAX_ATTEMPTS || 5);
const BASE_DELAY_SECONDS = Number(process.env.WEBHOOK_BASE_DELAY_SECONDS || 10);
const MAX_DELAY_SECONDS = Number(process.env.WEBHOOK_MAX_DELAY_SECONDS || 3600);
const SIGNING_SECRET = process.env.WEBHOOK_SIGNING_SECRET || process.env.APP_SECRET || 'default-secret';

const signPayload = (payload) => {
  try {
    const body = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', SIGNING_SECRET).update(body).digest('hex');
    return hmac;
  } catch (err) {
    logger.warn(`Failed to sign payload: ${err.message}`);
    return null;
  }
};

const attemptDelivery = async (delivery) => {
  if (!delivery) throw new Error('Invalid delivery');

  const payload = delivery.payload || {};

  try {
    if (delivery.deliveryType === 'email' && delivery.emailAddress) {
      // Send email via sendgridClient
      const to = delivery.emailAddress;
      const subject = payload.subject || `New application for ${payload.jobTitle || 'your job'}`;
      const cover = payload.coverLetter ? String(payload.coverLetter).replace(/\n/g, '<br/>') : 'No cover letter provided.';
      const applicant = payload.applicant || {};
      const html = `
        <p>Hello,</p>
        <p>You have received a new application for <strong>${payload.jobTitle || ''}</strong> at <strong>${payload.company || ''}</strong>.</p>
        <p><strong>Applicant:</strong> ${applicant.name || 'Applicant'}</p>
        <p><strong>Email:</strong> ${applicant.email || 'N/A'}</p>
        <p><strong>Phone:</strong> ${applicant.phone || 'N/A'}</p>
        <p><strong>Cover Letter:</strong></p>
        <p>${cover}</p>
        <p>Original job listing: <a href="${payload.applicationUrl || ''}">${payload.applicationUrl || ''}</a></p>
      `;

      await sendgridClient.sendEmail({ to, subject, html, replyTo: applicant.email });
      delivery.attempts = (delivery.attempts || 0) + 1;
      delivery.status = 'delivered';
      delivery.lastError = null;
      await delivery.save();
      logger.info(`Email delivery ${delivery._id} succeeded to ${to}`);
      return true;
    }

    // Default: webhook delivery
    if (!delivery.webhookUrl) throw new Error('Missing webhookUrl');
    const signature = signPayload(payload);
    const resp = await axios.post(delivery.webhookUrl, payload, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-Cashflaw-Signature': signature || '',
        'User-Agent': 'CashFlowHubs-Webhook/1.0',
      },
      validateStatus: () => true,
    });

    delivery.attempts = (delivery.attempts || 0) + 1;
    delivery.responseStatus = resp.status;
    delivery.responseBody = typeof resp.data === 'object' ? resp.data : { body: String(resp.data) };

    if (resp.status >= 200 && resp.status < 300) {
      delivery.status = 'delivered';
      delivery.lastError = null;
      await delivery.save();
      logger.info(`Delivery ${delivery._id} succeeded (${resp.status})`);
      return true;
    }

    // Non-2xx: treat as failure but retryable
    delivery.status = 'pending';
    delivery.lastError = `HTTP ${resp.status}`;
    await delivery.save();
    throw new Error(`Non-success status ${resp.status}`);
  } catch (err) {
    delivery.attempts = (delivery.attempts || 0) + 1;
    delivery.lastError = String(err.message || err);
    if (delivery.attempts >= MAX_ATTEMPTS) {
      delivery.status = 'failed';
      await delivery.save();
      logger.error(`Delivery ${delivery._id} failed: ${delivery.lastError}`);
      return false;
    }

    // schedule next attempt with exponential backoff
    const delay = Math.min(MAX_DELAY_SECONDS, BASE_DELAY_SECONDS * Math.pow(2, delivery.attempts - 1));
    delivery.nextAttemptAt = new Date(Date.now() + delay * 1000);
    delivery.status = 'pending';
    await delivery.save();

    // Requeue via publishToQueue after delay (best-effort, works when single instance)
    setTimeout(() => {
      try {
        const { publishToQueue, QUEUES } = require('./queueWorker');
        publishToQueue(QUEUES.JOB_APPLICATION_DELIVERY, { deliveryId: delivery._id.toString() });
      } catch (pubErr) {
        logger.error(`Failed to re-publish delivery ${delivery._id}: ${pubErr.message}`);
      }
    }, delay * 1000);

    logger.warn(`Delivery ${delivery._id} attempt ${delivery.attempts} failed, scheduled retry in ${delay}s`);
    return false;
  }
};

const processDeliveryMessage = async (data) => {
  if (!data || !data.deliveryId) throw new Error('deliveryId required');
  const delivery = await Delivery.findById(data.deliveryId);
  if (!delivery) throw new Error('Delivery not found');
  if (delivery.status === 'delivered') return;
  if (delivery.status === 'failed') return;

  // mark processing
  delivery.status = 'processing';
  await delivery.save();

  await attemptDelivery(delivery);
};

module.exports = { processDeliveryMessage, attemptDelivery };
