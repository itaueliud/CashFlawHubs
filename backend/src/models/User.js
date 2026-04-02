const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    unique: true,
    default: () => `USR-${uuidv4().slice(0, 8).toUpperCase()}`,
  },
  name: { type: String, required: true, trim: true },
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  passwordHash: { type: String, required: true, select: false },
  country: {
    type: String,
    required: true,
    enum: ['KE', 'UG', 'TZ', 'ET', 'GH', 'NG'],
  },
  referralCode: {
    type: String,
    unique: true,
    default: () => `REF-${uuidv4().slice(0, 8).toUpperCase()}`,
  },
  referredBy: { type: String, default: null }, // referralCode of referrer
  activationStatus: { type: Boolean, default: false },
  emailVerified: { type: Boolean, default: false },
  phoneVerified: { type: Boolean, default: false },

  // Gamification
  level: { type: Number, default: 1 },
  xpPoints: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  lastActiveDate: { type: Date, default: null },
  badges: [{ type: String }],

  // Stats
  totalEarned: { type: Number, default: 0 }, // in USD
  surveysCompleted: { type: Number, default: 0 },
  tasksCompleted: { type: Number, default: 0 },
  totalReferrals: { type: Number, default: 0 },

  // Security
  isActive: { type: Boolean, default: true },
  isBanned: { type: Boolean, default: false },
  banReason: { type: String, default: null },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },

  role: { type: String, enum: ['user', 'admin'], default: 'user' },

  // Profile
  avatar: { type: String, default: null },
  bio: { type: String, default: null },
}, {
  timestamps: true,
});

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

// Update streak
userSchema.methods.updateStreak = function () {
  const today = new Date().toDateString();
  const lastActive = this.lastActiveDate ? new Date(this.lastActiveDate).toDateString() : null;
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  if (lastActive === today) return;
  if (lastActive === yesterday) {
    this.streak += 1;
  } else {
    this.streak = 1;
  }
  this.lastActiveDate = new Date();
};

// Level up based on XP
userSchema.methods.checkLevelUp = function () {
  const levels = [0, 100, 300, 600, 1000, 1500, 2200, 3000];
  for (let i = levels.length - 1; i >= 0; i--) {
    if (this.xpPoints >= levels[i]) {
      this.level = i + 1;
      break;
    }
  }
};

userSchema.index({ phone: 1 });
userSchema.index({ referralCode: 1 });
userSchema.index({ country: 1 });
userSchema.index({ createdAt: -1 });

module.exports = mongoose.model('User', userSchema);
