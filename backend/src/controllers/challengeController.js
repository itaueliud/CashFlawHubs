const { Challenge, ChallengeCompletion } = require('../models/Challenge');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const logger = require('../utils/logger');

// @GET /api/challenges/daily
exports.getDailyChallenges = async (req, res) => {
  try {
    const now = new Date();
    const challenges = await Challenge.find({
      isActive: true,
      expiresAt: { $gt: now },
    });

    // Get user's progress for each challenge
    const completions = await ChallengeCompletion.find({
      userId: req.user.id,
      challengeId: { $in: challenges.map(c => c._id) },
    });

    const completionMap = {};
    completions.forEach(c => { completionMap[c.challengeId.toString()] = c; });

    const result = challenges.map(c => ({
      ...c.toObject(),
      progress: completionMap[c._id.toString()]?.progress || 0,
      completed: completionMap[c._id.toString()]?.completed || false,
      rewardClaimed: completionMap[c._id.toString()]?.rewardClaimed || false,
    }));

    res.json({ success: true, challenges: result });
  } catch (error) {
    logger.error(`getDailyChallenges error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/challenges/:id/claim
exports.claimChallengeReward = async (req, res) => {
  try {
    const completion = await ChallengeCompletion.findOne({
      userId: req.user.id,
      challengeId: req.params.id,
      completed: true,
      rewardClaimed: false,
    });

    if (!completion) {
      return res.status(400).json({ success: false, message: 'Challenge not completed or reward already claimed' });
    }

    const challenge = await Challenge.findById(req.params.id);

    // Credit wallet
    const wallet = await Wallet.findOne({ userId: req.user.id });
    await wallet.credit(challenge.rewardUSD, 'challenge');

    // Log transaction
    await Transaction.create({
      userId: req.user.id,
      type: 'challenge',
      amountLocal: challenge.rewardUSD,
      amountUSD: challenge.rewardUSD,
      currency: 'USD',
      country: req.user.country,
      provider: 'internal',
      direction: 'credit',
      status: 'successful',
      processedAt: new Date(),
    });

    // Award XP
    await User.findByIdAndUpdate(req.user.id, {
      $inc: { xpPoints: challenge.xpReward },
    });

    completion.rewardClaimed = true;
    await completion.save();

    res.json({
      success: true,
      message: `Claimed $${challenge.rewardUSD} + ${challenge.xpReward} XP!`,
      rewardUSD: challenge.rewardUSD,
    });
  } catch (error) {
    logger.error(`claimChallengeReward error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Internal: update challenge progress when user completes a task/survey
exports.updateChallengeProgress = async (userId, activityType) => {
  try {
    const challenges = await Challenge.find({
      type: activityType,
      isActive: true,
      expiresAt: { $gt: new Date() },
    });

    for (const challenge of challenges) {
      const completion = await ChallengeCompletion.findOneAndUpdate(
        { userId, challengeId: challenge._id },
        { $inc: { progress: 1 } },
        { upsert: true, new: true }
      );

      if (!completion.completed && completion.progress >= challenge.targetCount) {
        await ChallengeCompletion.findByIdAndUpdate(completion._id, {
          completed: true,
          completedAt: new Date(),
        });
      }
    }
  } catch (error) {
    logger.error(`updateChallengeProgress error: ${error.message}`);
  }
};
