const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  type: {
    type: String,
    enum: [
      'survey',
      'task',
      'referral',
      'login',
      'mixed',
      'offerwall',
      'job',
      'profile',
      'wallet',
      'chat',
      'withdrawal',
      'earnings',
    ],
    required: true,
  },
  eventType: {
    type: String,
    enum: [
      'survey',
      'survey_complete',
      'survey_complete_3',
      'offerwall_complete',
      'task',
      'task_complete',
      'task_complete_3',
      'task_complete_5',
      'referral',
      'referral_3',
      'share_referral',
      'login',
      'daily_login_streak_3',
      'daily_login_streak_7',
      'login_streak_14',
      'login_streak_30',
      'job_apply',
      'job_post',
      'profile_complete',
      'wallet_connect',
      'first_withdrawal',
      'chat_message',
      'deposit',
      'earning_milestone_1usd',
      'earning_milestone_5usd',
    ],
    default: function defaultEventType() {
      return this.type || 'mixed';
    },
  },
  targetCount: { type: Number, required: true },
  rewardUSD: { type: Number, required: true },
  xpReward: { type: Number, default: 50 },
  sortOrder: { type: Number, default: 0 },
  isDaily: { type: Boolean, default: true },
  resetDaily: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true },
  expiresAt: { type: Date, default: null },
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
challengeCompletionSchema.index({ userId: 1, completed: 1, rewardClaimed: 1 });

const Challenge = mongoose.model('Challenge', challengeSchema);
const ChallengeCompletion = mongoose.model('ChallengeCompletion', challengeCompletionSchema);

module.exports = { Challenge, ChallengeCompletion };
