const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const User = require('../models/User');

const APP_NAME = process.env.APP_NAME || 'CashFlawHubs';
const TWO_FACTOR_TOTP_WINDOW = Number(process.env.TWO_FACTOR_TOTP_WINDOW || 2);

exports.setup2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.twoFactorEnabled) {
      return res.status(400).json({ success: false, message: '2FA is already enabled. Disable it first.' });
    }

    const secret = speakeasy.generateSecret({
      name: `${APP_NAME} (${user.email || user.phone || user.userId || user._id})`,
      issuer: APP_NAME,
      length: 32,
    });

    // Save secret temporarily
    user.twoFactorSecret = secret.base32;

    // Generate backup codes (8)
    const backupCodes = Array.from({ length: 8 }, () => crypto.randomBytes(4).toString('hex').toUpperCase());
    const hashedBackups = backupCodes.map((c) => crypto.createHash('sha256').update(c).digest('hex'));
    user.twoFactorBackupCodes = hashedBackups;

    await user.save();

    const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.json({ success: true, secret: secret.base32, qrCodeUrl: qrDataUrl, backupCodes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.verifySetup2FA = async (req, res) => {
  try {
    const { token, secret } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Token is required' });

    const user = await User.findById(req.user.id).select('+twoFactorSecret +twoFactorBackupCodes');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const setupSecret = String(user.twoFactorSecret || secret || '').trim();
    if (!setupSecret) return res.status(400).json({ success: false, message: 'Run setup first' });
    if (user.twoFactorEnabled) return res.status(400).json({ success: false, message: '2FA already active' });

    const valid = speakeasy.totp.verify({
      secret: setupSecret,
      encoding: 'base32',
      token: String(token).replace(/\s/g, ''),
      window: TWO_FACTOR_TOTP_WINDOW,
    });
    if (!valid) return res.status(400).json({ success: false, message: 'Invalid code. Check your authenticator app.' });

    user.twoFactorSecret = setupSecret;
    user.twoFactorEnabled = true;
    user.twoFactorEnabledAt = new Date();
    await user.save();

    res.json({ success: true, message: '2FA enabled successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.disable2FA = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ success: false, message: 'Token and password are required' });

    const user = await User.findById(req.user.id).select('+twoFactorSecret +passwordHash +twoFactorBackupCodes');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!user.twoFactorEnabled) return res.status(400).json({ success: false, message: '2FA is not enabled' });

    const passwordValid = await user.comparePassword(String(password));
    if (!passwordValid) return res.status(401).json({ success: false, message: 'Incorrect password' });

    const tokenValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: String(token).replace(/\s/g, ''),
      window: TWO_FACTOR_TOTP_WINDOW,
    });
    if (!tokenValid) return res.status(400).json({ success: false, message: 'Invalid authenticator code' });

    user.twoFactorSecret = null;
    user.twoFactorEnabled = false;
    user.twoFactorBackupCodes = [];
    user.twoFactorEnabledAt = null;
    await user.save();

    res.json({ success: true, message: '2FA disabled successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.get2FAStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('+twoFactorBackupCodes');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, enabled: !!user.twoFactorEnabled, enabledAt: user.twoFactorEnabledAt, backupCodesCount: (user.twoFactorBackupCodes || []).length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.verify2FALogin = async (req, res) => {
  try {
    const { userId, token } = req.body;
    if (!userId || !token) return res.status(400).json({ success: false, message: 'userId and token are required' });

    const user = await User.findById(userId).select('+twoFactorSecret +twoFactorBackupCodes');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!user.twoFactorEnabled) return res.status(400).json({ success: false, message: '2FA not enabled' });

    const cleanToken = String(token).replace(/\s/g, '');

    const totpValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: cleanToken,
      window: TWO_FACTOR_TOTP_WINDOW,
    });
    if (totpValid) return res.json({ success: true, message: '2FA verified' });

    const hashedAttempt = crypto.createHash('sha256').update(cleanToken.toUpperCase()).digest('hex');
    const backupIndex = (user.twoFactorBackupCodes || []).indexOf(hashedAttempt);
    if (backupIndex !== -1) {
      user.twoFactorBackupCodes.splice(backupIndex, 1);
      await user.save();
      return res.json({ success: true, message: 'Backup code accepted', backupCodesRemaining: user.twoFactorBackupCodes.length });
    }

    return res.status(401).json({ success: false, message: 'Invalid code' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
