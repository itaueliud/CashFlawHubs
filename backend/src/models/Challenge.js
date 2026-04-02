const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  type: { type: String, enum: ['survey', 'task', 'referral', 'login', 'mixed'], required: true },
  targetCount: { type: Number, required: true },
  rewardUSD: { type: Number, required: true },
  xpReward: { type: Number, default: 50 },
  isDaily: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

const challengeCompletionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  challengeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Challenge', required: true },
  progress: { type: Number, default: 0 },
  completed: { type: Boolean, default: false },
  rewardClaimed: { type: Boolean, default: false },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

challengeCompletionSchema.index({ userId: 1, challengeId: 1 }, { unique: true });

const Challenge = mongoose.model('Challenge', challengeSchema);
const ChallengeCompletion = mongoose.model('ChallengeCompletion', challengeCompletionSchema);

module.exports = { Challenge, ChallengeCompletion };
