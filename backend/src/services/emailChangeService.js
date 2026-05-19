const crypto = require('crypto');
const User = require('../models/User');
const { sendgridClient } = require('./notificationService');

const getApiBaseUrl = () =>
  (process.env.API_BASE_URL || process.env.BACKEND_URL || process.env.FRONTEND_URL || 'http://localhost:5000').replace(/\/+$/, '');

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());

const initiateEmailChange = async (userId, newEmail) => {
  const normalized = String(newEmail || '').trim().toLowerCase();
  if (!isValidEmail(normalized)) {
    const error = new Error('Valid email required');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  if (user.email === normalized) {
    const error = new Error('New email must be different from current email');
    error.statusCode = 400;
    throw error;
  }

  const existing = await User.findOne({ email: normalized, _id: { $ne: user._id } });
  if (existing) {
    const error = new Error('Email already in use');
    error.statusCode = 409;
    throw error;
  }

  const token = crypto.randomBytes(32).toString('hex');
  user.pending_email = normalized;
  user.email_change_token = token;
  user.email_change_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();

  const verifyLink = `${getApiBaseUrl()}/api/v1/users/verify-email?token=${token}`;

  await sendgridClient.sendEmail({
    to: normalized,
    subject: 'Verify your new CashFlawHubs email',
    html: `<p>Hello ${user.name || 'there'},</p><p>Click below to confirm your new email address:</p><p><a href="${verifyLink}">${verifyLink}</a></p><p>This link expires in 24 hours.</p>`,
  });

  return { verifyLink, expiresAt: user.email_change_expires_at };
};

const confirmEmailChange = async (token) => {
  const rawToken = String(token || '').trim();
  if (!rawToken) {
    const error = new Error('Verification token is required');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findOne({ email_change_token: rawToken });
  if (!user || !user.pending_email || !user.email_change_expires_at) {
    const error = new Error('Invalid or expired verification token');
    error.statusCode = 400;
    throw error;
  }

  if (new Date(user.email_change_expires_at).getTime() < Date.now()) {
    user.pending_email = null;
    user.email_change_token = null;
    user.email_change_expires_at = null;
    await user.save();
    const error = new Error('Verification token expired');
    error.statusCode = 400;
    throw error;
  }

  const existing = await User.findOne({ email: user.pending_email, _id: { $ne: user._id } });
  if (existing) {
    const error = new Error('Pending email is already used by another account');
    error.statusCode = 409;
    throw error;
  }

  user.email = user.pending_email;
  user.pending_email = null;
  user.email_change_token = null;
  user.email_change_expires_at = null;
  user.emailVerified = true;
  await user.save();

  return user;
};

module.exports = { initiateEmailChange, confirmEmailChange };
