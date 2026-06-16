const { Challenge, ChallengeCompletion } = require('../models/Challenge');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const logger = require('../utils/logger');
const { trackEvent } = require('../services/eventTracker');

const DAILY_CHALLENGE_TEMPLATES = [
  {
    title: 'Daily Login',
    description: 'Log in 3 times today (at least 4 hours apart) to complete this challenge.',
    type: 'login',
    eventType: 'login',
    targetCount: 3,
    rewardUSD: 0,
    xpReward: 10,
    isDaily: true,
    resetDaily: true,
  },
  {
    title: 'Survey Starter',
    description: 'Complete 1 survey today.',
    type: 'survey',
    eventType: 'survey_complete',
    targetCount: 1,
    rewardUSD: 0,
    xpReward: 20,
    isDaily: true,
    resetDaily: true,
  },
  {
    title: 'Survey Sprint',
    description: 'Complete 3 surveys today.',
    type: 'survey',
    eventType: 'survey_complete_3',
    targetCount: 3,
    rewardUSD: 0,
    xpReward: 60,
    isDaily: true,
    resetDaily: true,
  },
  {
    title: 'Task Starter',
    description: 'Complete 1 microtask today.',
    type: 'task',
    eventType: 'task_complete',
    targetCount: 1,
    rewardUSD: 0,
    xpReward: 30,
    isDaily: true,
    resetDaily: true,
  },
  {
    title: 'Task Master',
    description: 'Complete 3 microtasks today.',
    type: 'task',
    eventType: 'task_complete_3',
    targetCount: 3,
    rewardUSD: 0,
    xpReward: 60,
    isDaily: true,
    resetDaily: true,
  },
  {
    title: 'Referral Starter',
    description: 'Refer 1 friend today.',
    type: 'referral',
    eventType: 'referral',
    targetCount: 1,
    rewardUSD: 0,
    xpReward: 100,
    isDaily: true,
    resetDaily: true,
  },
  {
    title: 'Referral Champion',
    description: 'Refer 2 friends today.',
    type: 'referral',
    eventType: 'referral_3',
    targetCount: 2,
    rewardUSD: 0,
    xpReward: 180,
    isDaily: true,
    resetDaily: true,
  },
  {
    title: 'Activity Mix',
    description: 'Complete 4 earning actions today.',
    type: 'mixed',
    eventType: 'task_complete',
    targetCount: 4,
    rewardUSD: 0,
    xpReward: 65,
    isDaily: true,
    resetDaily: true,
  },
  {
    title: 'Daily Hustler',
    description: 'Complete 5 earning actions today.',
    type: 'mixed',
    eventType: 'task_complete',
    targetCount: 5,
    rewardUSD: 0,
    xpReward: 60,
    isDaily: true,
    resetDaily: true,
  },
];

const LIFETIME_CHALLENGE_TEMPLATES = [
  {
    title: 'Invite 10 Friends',
    description: 'Invite 10 friends who register using your referral code.',
    type: 'referral',
    eventType: 'referral',
    targetCount: 10,
    rewardUSD: 0,
    xpReward: 150,
    isDaily: false,
    resetDaily: false,
  },
];

const getTomorrowUtcMidnight = () => {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return tomorrow;
};

const isChallengeExpired = (challenge, now = new Date()) => Boolean(challenge?.expiresAt && new Date(challenge.expiresAt) <= now);

const ensureDailyChallenges = async () => {
  const now = new Date();
  const existing = await Challenge.find({
    isDaily: true,
    isActive: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  });

  const tomorrow = getTomorrowUtcMidnight();
  const existingTitles = new Set(existing.map((item) => item.title));
  const missingDailyTemplates = DAILY_CHALLENGE_TEMPLATES.filter((template) => !existingTitles.has(template.title));
  if (missingDailyTemplates.length > 0) {
    await Challenge.insertMany(
      missingDailyTemplates.map((template) => ({
        ...template,
        isActive: true,
        isDaily: true,
        resetDaily: true,
        expiresAt: tomorrow,
      }))
    );
  }

  for (const template of LIFETIME_CHALLENGE_TEMPLATES) {
    const exists = await Challenge.findOne({ title: template.title, isDaily: false });
    if (!exists) {
      await Challenge.create({ ...template, isActive: true });
    }
  }
};

const normalizeResponseChallenge = (challenge, completion) => ({
  ...challenge.toObject(),
  resetDaily: Boolean(challenge.resetDaily ?? challenge.isDaily),
  eventType: challenge.eventType || challenge.type || 'mixed',
  rewardUSD: Boolean(challenge.resetDaily ?? challenge.isDaily) ? 0 : Number(challenge.rewardUSD || 0),
  progress: completion?.progress || 0,
  completed: completion?.completed || false,
  rewardClaimed: completion?.rewardClaimed || false,
});

// @GET /api/challenges/daily
exports.getDailyChallenges = async (req, res) => {
  try {
    await ensureDailyChallenges();

    const now = new Date();
    const challenges = await Challenge.find({
      isActive: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    }).sort({ resetDaily: -1, sortOrder: 1, createdAt: 1 });

    const completions = await ChallengeCompletion.find({
      userId: req.user.id,
      challengeId: { $in: challenges.map((challenge) => challenge._id) },
    });

    const completionMap = new Map(completions.map((item) => [item.challengeId.toString(), item]));
    const result = challenges.map((challenge) => normalizeResponseChallenge(challenge, completionMap.get(challenge._id.toString())));

    res.json({ success: true, challenges: result });
  } catch (error) {
    logger.error(`getDailyChallenges error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/challenges/:id/claim
exports.claimChallengeReward = async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge || !challenge.isActive || isChallengeExpired(challenge)) {
      return res.status(404).json({ success: false, message: 'Challenge not found or expired' });
    }

    const claimedCompletion = await ChallengeCompletion.findOneAndUpdate(
      {
        userId: req.user.id,
        challengeId: req.params.id,
        completed: true,
        rewardClaimed: false,
        progress: { $gte: challenge.targetCount },
      },
      { $set: { rewardClaimed: true, claimedAt: new Date() } },
      { new: true }
    );

    if (!claimedCompletion) {
      return res.status(400).json({ success: false, message: 'Challenge not completed or reward already claimed' });
    }

    const rewardUSD = challenge.resetDaily ? 0 : Number(challenge.rewardUSD || 0);

    if (rewardUSD > 0) {
      let wallet = await Wallet.findOne({ userId: req.user.id });
      if (!wallet) {
        wallet = await Wallet.create({ userId: req.user.id });
      }
      await wallet.credit(rewardUSD, 'challenge');

      await Transaction.create({
        userId: req.user.id,
        type: 'challenge',
        amountLocal: rewardUSD,
        amountUSD: rewardUSD,
        currency: 'USD',
        country: req.user.country,
        provider: 'internal',
        direction: 'credit',
        status: 'successful',
        processedAt: new Date(),
      });
    }

    await User.findByIdAndUpdate(req.user.id, {
      $inc: { xpPoints: challenge.xpReward },
    });

    res.json({
      success: true,
      message: rewardUSD > 0 ? `Claimed $${rewardUSD} + ${challenge.xpReward} XP!` : `Claimed +${challenge.xpReward} XP!`,
      rewardUSD,
    });
  } catch (error) {
    logger.error(`claimChallengeReward error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Internal: update challenge progress when user completes a task/survey/login/etc
exports.updateChallengeProgress = async (userId, activityType) => {
  try {
    await trackEvent(userId, activityType);
  } catch (error) {
    logger.error(`updateChallengeProgress error: ${error.message}`);
  }
};
