const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const User = require('../models/User');
const { protect, ledgerOnly } = require('../middleware/auth');

router.post('/2fa/setup', protect, ledgerOnly, async (req, res) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `CashFlowHubs Ledger (${req.user.email || req.user.phone})`,
      length: 20,
    });

    const tempToken = jwt.sign(
      { userId: req.user._id, tempSecret: secret.base32, stage: 'setup-2fa' },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    const qrImageBase64 = await qrcode.toDataURL(secret.otpauth_url);

    res.json({ success: true, qrImage: qrImageBase64, manualKey: secret.base32, tempToken });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/2fa/verify-setup', protect, ledgerOnly, async (req, res) => {
  try {
    const { token, tempToken } = req.body;
    if (!token || !tempToken) return res.status(400).json({ success: false, message: 'token and tempToken required' });

    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ success: false, message: 'Setup session expired. Start over.' });
    }

    if (String(decoded.userId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Token mismatch' });
    }

    const valid = speakeasy.totp.verify({
      secret: decoded.tempSecret,
      encoding: 'base32',
      token: String(token),
      window: 1,
    });

    if (!valid) return res.status(400).json({ success: false, message: 'Invalid code. Try again.' });

    const plainCodes = Array.from({ length: 10 }, () =>
      Math.random().toString(36).slice(-8).toUpperCase()
    );
    const hashedCodes = await Promise.all(plainCodes.map((c) => bcrypt.hash(c, 10)));

    await User.findByIdAndUpdate(req.user._id, {
      twoFactorSecret: decoded.tempSecret,
      twoFactorEnabled: true,
      twoFactorBackupCodes: hashedCodes,
      twoFaFailedAttempts: 0,
      twoFaLockedUntil: null,
      twoFactorEnabledAt: new Date(),
    });

    res.json({ success: true, message: '2FA enabled', backupCodes: plainCodes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ success: false, message: 'identifier and password required' });

    const user = await User.findOne({
      $or: [{ email: identifier.toLowerCase() }, { phone: identifier }],
      role: 'ledger',
    }).select('+passwordHash +twoFactorSecret +twoFactorEnabled +twoFaFailedAttempts +twoFaLockedUntil');

    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    if (!user.isActive || user.isBanned) return res.status(403).json({ success: false, message: 'Account inactive' });

    const validPassword = await user.comparePassword(password);
    if (!validPassword) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    if (!user.twoFactorEnabled) {
      const token = jwt.sign({ id: user._id, portal: 'ledger' }, process.env.JWT_SECRET, { expiresIn: '8h' });
      return res.json({ success: true, requiresSetup2FA: true, token, user: { _id: user._id, name: user.name, role: user.role } });
    }

    const tempToken = jwt.sign({ userId: user._id, stage: 'pre-2fa', portal: 'ledger' }, process.env.JWT_SECRET, { expiresIn: '5m' });
    res.json({ success: true, requires2FA: true, challengeId: tempToken, userId: user._id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/login/2fa', async (req, res) => {
  try {
    const { token: totpToken, tempToken } = req.body;
    if (!totpToken || !tempToken) return res.status(400).json({ success: false, message: 'token and tempToken required' });

    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: '2FA session expired. Log in again.' });
    }

    if (decoded.stage !== 'pre-2fa') return res.status(401).json({ success: false, message: 'Invalid token stage' });

    const user = await User.findById(decoded.userId).select('+twoFactorSecret +twoFaFailedAttempts +twoFaLockedUntil +twoFactorBackupCodes');
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    if (user.twoFaLockedUntil && user.twoFaLockedUntil > new Date()) {
      return res.status(403).json({ success: false, message: '2FA temporarily locked. Try again later.' });
    }

    let backupUsed = false;
    let valid = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: 'base32', token: String(totpToken), window: 1 });
    if (!valid && user.twoFactorBackupCodes?.length) {
      for (const codeHash of user.twoFactorBackupCodes) {
        if (await bcrypt.compare(totpToken, codeHash)) {
          valid = true;
          backupUsed = true;
          break;
        }
      }
    }

    if (!valid) {
      user.twoFaFailedAttempts += 1;
      if (user.twoFaFailedAttempts >= 5) {
        user.twoFaLockedUntil = new Date(Date.now() + 30 * 60000);
        user.twoFaFailedAttempts = 0;
      }
      await user.save();
      return res.status(401).json({ success: false, message: 'Invalid 2FA code' });
    }

    user.twoFaFailedAttempts = 0;
    user.twoFaLockedUntil = null;
    if (backupUsed && Array.isArray(user.twoFactorBackupCodes)) {
      const updatedCodes = [];
      for (const codeHash of user.twoFactorBackupCodes) {
        const isMatch = await bcrypt.compare(totpToken, codeHash);
        if (!isMatch) updatedCodes.push(codeHash);
      }
      user.twoFactorBackupCodes = updatedCodes;
    }
    await user.save();

    const sessionToken = jwt.sign({ id: user._id, portal: 'ledger' }, process.env.JWT_SECRET, { expiresIn: '8h' });

    res.json({ success: true, token: sessionToken, usedBackupCode: backupUsed, user: { _id: user._id, name: user.name, role: user.role, email: user.email } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/2fa/disable', protect, ledgerOnly, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      twoFactorSecret: null,
      twoFactorEnabled: false,
      twoFactorBackupCodes: [],
    });
    res.json({ success: true, message: '2FA disabled' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
