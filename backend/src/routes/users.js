const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const { initiateEmailChange, confirmEmailChange } = require('../services/emailChangeService');

router.get('/profile', protect, async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({ success: true, user });
});

router.put('/profile', protect, async (req, res) => {
  const { name, bio, avatar, userLanguage, browserLanguage, timezone } = req.body;
  const updates = { name, bio, avatar };
  if (userLanguage) updates.userLanguage = String(userLanguage).toLowerCase().slice(0, 10);
  if (browserLanguage) updates.browserLanguage = String(browserLanguage).toLowerCase().slice(0, 20);
  if (timezone) updates.timezone = String(timezone).slice(0, 64);
  const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true });
  res.json({ success: true, user });
});

router.put('/profile/password', protect, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Current and new password are required' });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
  }

  const user = await User.findById(req.user.id).select('+passwordHash');
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const valid = await user.comparePassword(String(currentPassword));
  if (!valid) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect' });
  }

  user.passwordHash = String(newPassword);
  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  await user.save();
  res.json({ success: true, message: 'Password updated successfully' });
});

router.post('/me/email', protect, async (req, res) => {
  try {
    const { newEmail } = req.body;
    const result = await initiateEmailChange(req.user.id, newEmail);
    res.json({
      success: true,
      message: 'Verification link sent to new email',
      expiresAt: result.expiresAt,
      ...(process.env.NODE_ENV === 'development' ? { verifyLink: result.verifyLink } : {}),
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    await confirmEmailChange(token);
    res.json({ success: true, message: 'Email verified and updated successfully' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

module.exports = router;
