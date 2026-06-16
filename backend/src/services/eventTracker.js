const { Challenge, ChallengeCompletion } = require('../models/Challenge');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const logger = require('../utils/logger');

const EVENT_ALIASES = {
  survey: ['survey', 'survey_complete'],
  survey_complete: ['survey_complete', 'survey'],
  survey_complete_3: ['survey_complete_3'],
  offerwall_complete: ['offerwall_complete'],
  task: ['task', 'task_complete'],
  task_complete: ['task_complete', 'task'],
  task_complete_3: ['task_complete_3'],
  task_complete_5: ['task_complete_5'],
  referral: ['referral'],
  referral_3: ['referral_3'],
  share_referral: ['share_referral'],
  login: ['login'],
  daily_login_streak_3: ['daily_login_streak_3'],
  daily_login_streak_7: ['daily_login_streak_7'],
  login_streak_14: ['login_streak_14'],
  login_streak_30: ['login_streak_30'],
  job_apply: ['job_apply'],
  job_post: ['job_post'],
  profile_complete: ['profile_complete'],
  wallet_connect: ['wallet_connect'],
  first_withdrawal: ['first_withdrawal'],
  chat_message: ['chat_message'],
  deposit: ['deposit'],
  earning_milestone_1usd: ['earning_milestone_1usd'],
  earning_milestone_5usd: ['earning_milestone_5usd'],
  ads_earning_2hr: ['ads_earning_2hr'],
};

const todayUTC = () => new Date().toISOString().split('T')[0];

const resolveEventCandidates = (eventType) => {
  const normalized = String(eventType || '').trim();
  if (!normalized) return [];
  return [...new Set([
    normalized,
    ...(EVENT_ALIASES[normalized] || []),
  ])];
};

async function trackEvent(userId, eventType, metadata = {}) {
  try {
    if (!userId || !eventType) return;

    const candidates = resolveEventCandidates(eventType);
    if (candidates.length === 0) return;

    const challenges = await Challenge.find({
      isActive: true,
      $or: [
        { eventType: { $in: candidates } },
        { type: { $in: candidates } },
        { type: 'mixed' },
      ],
    });

    if (!challenges.length) return;

    await Promise.all(challenges.map(async (challenge) => {
      const completion = await ChallengeCompletion.findOne({ userId, challengeId: challenge._id });
      if (completion?.completed) return;

      const updated = await ChallengeCompletion.findOneAndUpdate(
        { userId, challengeId: challenge._id },
        {
          $inc: { progress: 1 },
          $setOnInsert: {
            completed: false,
            rewardClaimed: false,
            completedAt: null,
            ...(metadata?.date ? { date: metadata.date } : {}),
          },
        },
        { upsert: true, new: true }
      );

      if (updated && !updated.completed && updated.progress >= challenge.targetCount) {
        updated.completed = true;
        updated.completedAt = new Date();
        await updated.save();
      }
    }));
  } catch (error) {
    logger.error(`[eventTracker] ${eventType} failed: ${error.message}`);
  }
}

async function checkEarningMilestones(userId) {
  try {
    const [user, wallet] = await Promise.all([
      User.findById(userId).select('milestone_1usd milestone_5usd'),
      Wallet.findOne({ userId }).select('balanceUSD'),
    ]);

    if (!user || !wallet) return;

    if (wallet.balanceUSD >= 1 && !user.milestone_1usd) {
      const updated = await User.findOneAndUpdate(
        { _id: userId, milestone_1usd: { $ne: true } },
        { $set: { milestone_1usd: true } },
        { new: true }
      );
      if (updated) await trackEvent(userId, 'earning_milestone_1usd');
    }

    if (wallet.balanceUSD >= 5 && !user.milestone_5usd) {
      const updated = await User.findOneAndUpdate(
        { _id: userId, milestone_5usd: { $ne: true } },
        { $set: { milestone_5usd: true } },
        { new: true }
      );
      if (updated) await trackEvent(userId, 'earning_milestone_5usd');
    }
  } catch (error) {
    logger.warn(`[eventTracker] milestone check failed: ${error.message}`);
  }
}

module.exports = {
  trackEvent,
  checkEarningMilestones,
  todayUTC,
};
