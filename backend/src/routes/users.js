const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const { initiateEmailChange, confirmEmailChange } = require('../services/emailChangeService');
const registrationUpload = require('../middleware/registrationUpload');
const { trackEvent } = require('../services/eventTracker');
const SUPPORTED_LANGUAGES = new Set(['en', 'sw', 'fr']);

const PROFILE_COMPLETENESS_FIELDS = ['name', 'email', 'phone', 'country', 'bio', 'avatar', 'userLanguage', 'timezone'];

const isAdminOrSuperadmin = (user = {}) => ['admin', 'superadmin'].includes(String(user?.role || '').toLowerCase());

const calculateProfileCompleteness = (user = {}) => {
  const filled = PROFILE_COMPLETENESS_FIELDS.filter((field) => {
    const value = user[field];
    return value !== undefined && value !== null && String(value).trim() !== '';
  }).length;
  return Math.round((filled / PROFILE_COMPLETENESS_FIELDS.length) * 100);
};

router.get('/profile', protect, async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({ success: true, user });
});

const updateUserProfile = async (req, res, { adminOnly = false } = {}) => {
  if (adminOnly && !isAdminOrSuperadmin(req.user)) {
    return res.status(403).json({ success: false, message: 'Only admin and superadmin accounts can use this profile editor' });
  }

  const { name, bio, avatar, phone, userLanguage, browserLanguage, timezone } = req.body;
  const currentUser = await User.findById(req.user.id).select('phone phoneVerified');
  if (!currentUser) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  const updates = {};

  if (name !== undefined) updates.name = name;
  if (bio !== undefined) updates.bio = bio;
  if (avatar !== undefined) updates.avatar = avatar;
  if (phone !== undefined) {
    const normalizedPhone = String(phone).trim();
    if (!normalizedPhone) {
      return res.status(400).json({ success: false, message: 'Phone number cannot be empty' });
    }
    const existingPhone = await User.findOne({ phone: normalizedPhone, _id: { $ne: req.user.id } });
    if (existingPhone) {
      return res.status(409).json({ success: false, message: 'Phone number already in use' });
    }
    updates.phone = normalizedPhone;
    updates.phoneVerified = normalizedPhone === currentUser.phone ? currentUser.phoneVerified : false;
  }
  if (userLanguage) {
    const normalizedLanguage = String(userLanguage).toLowerCase().slice(0, 2);
    updates.userLanguage = SUPPORTED_LANGUAGES.has(normalizedLanguage) ? normalizedLanguage : 'en';
  }
  if (browserLanguage) updates.browserLanguage = String(browserLanguage).toLowerCase().slice(0, 20);
  if (timezone) updates.timezone = String(timezone).slice(0, 64);
  const beforeUser = await User.findById(req.user.id);
  const beforeCompleteness = calculateProfileCompleteness(beforeUser || {});
  const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true });
  const afterCompleteness = calculateProfileCompleteness(user || {});

  if (afterCompleteness === 100 && beforeCompleteness < 100) {
    await trackEvent(req.user.id, 'profile_complete');
  }

  return res.json({ success: true, user });
};

router.put('/profile/admin', protect, async (req, res) => {
  await updateUserProfile(req, res, { adminOnly: true });
});

router.put('/profile', protect, async (req, res) => {
  await updateUserProfile(req, res);
});

router.patch('/:id/language', protect, async (req, res) => {
  const targetId = String(req.params.id || '').trim();
  if (!targetId) {
    return res.status(400).json({ success: false, message: 'User id is required' });
  }
  if (String(req.user.id) !== targetId && !['admin', 'superadmin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Not authorized to update language' });
  }

  const normalizedLanguage = String(req.body?.language || '').trim().toLowerCase().slice(0, 2);
  const language = SUPPORTED_LANGUAGES.has(normalizedLanguage) ? normalizedLanguage : 'en';
  const user = await User.findByIdAndUpdate(targetId, { userLanguage: language }, { new: true });
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  res.json({ success: true, user });
});

router.put('/profile/password', protect, async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Notification preferences
router.put('/profile/notifications', protect, async (req, res) => {
  try {
    const { earnings, tasks, updates, referrals, weeklyReport } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (!user.notificationPrefs) user.notificationPrefs = {};
    if (earnings !== undefined) user.notificationPrefs.earnings = Boolean(earnings);
    if (tasks !== undefined) user.notificationPrefs.tasks = Boolean(tasks);
    if (updates !== undefined) user.notificationPrefs.updates = Boolean(updates);
    if (referrals !== undefined) user.notificationPrefs.referrals = Boolean(referrals);
    if (weeklyReport !== undefined) user.notificationPrefs.weeklyReport = Boolean(weeklyReport);

    user.markModified('notificationPrefs');
    await user.save();
    res.json({ success: true, message: 'Notification preferences saved', notificationPrefs: user.notificationPrefs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Toggle or set Two-Factor Authentication (simple toggle)
router.put('/profile/2fa', protect, async (req, res) => {
  try {
    const { enabled } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.twoFactorEnabled = Boolean(enabled);
    await user.save();
    res.json({ success: true, twoFactorEnabled: user.twoFactorEnabled });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Submit identity (KYC) data (expects image URLs or base64-encoded data already uploaded elsewhere)
router.post('/profile/identity', protect, async (req, res) => {
  try {
    const { idNumber, idDocumentImage, faceVerificationImage } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (idNumber) user.idNumber = String(idNumber).trim();
    if (idDocumentImage) user.idDocumentImage = idDocumentImage;
    if (faceVerificationImage) user.faceVerificationImage = faceVerificationImage;
    user.identityVerificationStatus = 'submitted';
    await user.save();
    res.json({ success: true, message: 'Identity submitted', identityVerificationStatus: user.identityVerificationStatus });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

const requestEmailChangeForUser = async (req, res, { adminOnly = false } = {}) => {
  try {
    if (adminOnly && !isAdminOrSuperadmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Only admin and superadmin accounts can use this profile editor' });
    }

    const { newEmail } = req.body;
    const result = await initiateEmailChange(req.user.id, newEmail);
    return res.json({
      success: true,
      message: 'Verification link sent to new email',
      expiresAt: result.expiresAt,
      ...(process.env.NODE_ENV === 'development' ? { verifyLink: result.verifyLink } : {}),
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

router.post('/me/email/admin', protect, async (req, res) => {
  await requestEmailChangeForUser(req, res, { adminOnly: true });
});

router.post('/me/email', protect, async (req, res) => {
  await requestEmailChangeForUser(req, res);
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

// KYC submit (file upload)
router.post('/kyc/submit', protect, registrationUpload.fields([
  { name: 'idDocumentImage', maxCount: 1 },
  { name: 'faceVerificationImage', maxCount: 1 },
]), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.identityVerificationStatus === 'verified') {
      return res.status(400).json({ success: false, message: 'Identity already verified' });
    }

    const { idNumber } = req.body;
    const updates = { identityVerificationStatus: 'submitted' };

    if (idNumber) {
      const normalized = String(idNumber).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const existing = await User.findOne({ idNumber: normalized, _id: { $ne: req.user.id } });
      if (existing) return res.status(409).json({ success: false, message: 'ID number already in use' });
      updates.idNumber = normalized;
    }

    if (req.files?.idDocumentImage?.[0]) updates.idDocumentImage = req.files.idDocumentImage[0].filename;
    if (req.files?.faceVerificationImage?.[0]) updates.faceVerificationImage = req.files.faceVerificationImage[0].filename;

    if (!updates.idDocumentImage && !user.idDocumentImage) {
      return res.status(400).json({ success: false, message: 'ID document image is required' });
    }
    if (!updates.faceVerificationImage && !user.faceVerificationImage) {
      return res.status(400).json({ success: false, message: 'Selfie/face image is required' });
    }

    await User.findByIdAndUpdate(req.user.id, updates, { new: true });
    res.json({ success: true, message: 'KYC submitted for review. We will verify within 24–48 hours.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/kyc/status', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('identityVerificationStatus idNumber idDocumentImage faceVerificationImage');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, status: user.identityVerificationStatus, idNumber: user.idNumber || null, hasIdDocument: !!user.idDocumentImage, hasSelfie: !!user.faceVerificationImage });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

