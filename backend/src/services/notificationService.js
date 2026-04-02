const logger = require('../utils/logger');

// SMS via Twilio
const sendSMS = async (phone, message) => {
  try {
    if (process.env.NODE_ENV === 'development') {
      logger.info(`[DEV SMS] To: ${phone} | Message: ${message}`);
      return;
    }
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    });
    logger.info(`SMS sent to ${phone}`);
  } catch (error) {
    logger.error(`SMS send failed to ${phone}: ${error.message}`);
    throw error;
  }
};

// Email via Nodemailer
const sendEmail = async (to, subject, html) => {
  try {
    if (process.env.NODE_ENV === 'development') {
      logger.info(`[DEV EMAIL] To: ${to} | Subject: ${subject}`);
      return;
    }
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({ from: `CashflowConnect <${process.env.SMTP_USER}>`, to, subject, html });
    logger.info(`Email sent to ${to}`);
  } catch (error) {
    logger.error(`Email send failed to ${to}: ${error.message}`);
  }
};

// Activation notification
const sendActivationNotification = async ({ userId, referredBy }) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(userId);
    if (!user) return;

    await sendSMS(user.phone,
      `🎉 Welcome to CashflowConnect! Your account is now active. Start earning from surveys, tasks, and remote jobs. Earn 200 KES per referral: ${process.env.FRONTEND_URL}/signup?ref=${user.referralCode}`
    );

    if (referredBy) {
      const referrer = await User.findOne({ referralCode: referredBy });
      if (referrer) {
        await sendSMS(referrer.phone,
          `💰 Great news! Your referral has activated their CashflowConnect account. You've earned a reward! Check your wallet.`
        );
      }
    }
  } catch (error) {
    logger.error(`sendActivationNotification error: ${error.message}`);
  }
};

module.exports = { sendSMS, sendEmail, sendActivationNotification };
