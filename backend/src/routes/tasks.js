const express = require('express');
const router = express.Router();
const { protect, requireActivation } = require('../middleware/auth');
const { Task, TaskCompletion } = require('../models/Task');
const TaskUnlock = require('../models/TaskUnlock');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { getRedis } = require('../config/redis');
const { updateChallengeProgress } = require('../controllers/challengeController');
const { spendTokens } = require('../services/tokenService');
const logger = require('../utils/logger');

const PREMIUM_TASK_TEMPLATES = [
  {
    externalId: 'premium-1',
    source: 'internal',
    title: 'Premium Data Review',
    description: 'Review a short data set and answer quality questions.',
    category: 'analysis',
    rewardUSD: 0.75,
    estimatedMinutes: 10,
    externalUrl: 'https://example.com/premium-task-1',
    isPremium: true,
    tokenCost: 5,
  },
  {
    externalId: 'premium-2',
    source: 'internal',
    title: 'High Value App Test',
    description: 'Test a demo app flow and submit feedback.',
    category: 'testing',
    rewardUSD: 1.25,
    estimatedMinutes: 15,
    externalUrl: 'https://example.com/premium-task-2',
    isPremium: true,
    tokenCost: 8,
  },
];

const ensurePremiumTasks = async () => {
  const count = await Task.countDocuments({ isPremium: true });
  if (count > 0) return;
  await Task.insertMany(PREMIUM_TASK_TEMPLATES);
};

// @GET /api/tasks
router.get('/', protect, requireActivation, async (req, res) => {
  try {
    await ensurePremiumTasks();
    const tasks = await Task.find({ isActive: true }).sort({ rewardUSD: -1 }).limit(50);
    const unlocked = await TaskUnlock.find({ userId: req.user.id, taskId: { $in: tasks.map((task) => task._id) } });
    const unlockMap = new Set(unlocked.map((item) => item.taskId.toString()));
    const result = tasks.map((task) => ({
      ...task.toObject(),
      unlocked: unlockMap.has(task._id.toString()),
    }));
    res.json({ success: true, tasks: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/tasks/:id/unlock
router.post('/:id/unlock', protect, requireActivation, async (req, res) => {
  try {
    await ensurePremiumTasks();

    const task = await Task.findById(req.params.id);
    if (!task || !task.isActive) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (!task.isPremium) {
      return res.status(400).json({ success: false, message: 'This task does not require token unlock' });
    }

    const existingUnlock = await TaskUnlock.findOne({ userId: req.user.id, taskId: task._id });
    if (existingUnlock) {
      return res.status(409).json({ success: false, message: 'Task already unlocked' });
    }

    const tokenCost = Math.max(Number(task.tokenCost || 0), 0);
    if (tokenCost > 0) {
      await spendTokens({
        userId: req.user.id,
        tokenAmount: tokenCost,
        action: 'premium_task_unlock',
        metadata: { taskId: task._id.toString(), taskTitle: task.title },
      });
    }

    const unlock = await TaskUnlock.create({
      userId: req.user.id,
      taskId: task._id,
      tokenCost,
    });

    return res.status(201).json({
      success: true,
      message: tokenCost > 0 ? `Unlocked using ${tokenCost} tokens` : 'Task unlocked',
      unlock,
    });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// @POST /api/tasks/:id/complete
router.post('/:id/complete', protect, requireActivation, async (req, res) => {
  try {
    await ensurePremiumTasks();
    const redis = getRedis();
    const dupKey = `task:completion:${req.user.id}:${req.params.id}`;
    if (await redis.get(dupKey)) {
      return res.status(409).json({ success: false, message: 'Task already submitted' });
    }

    const task = await Task.findById(req.params.id);
    if (!task || !task.isActive) return res.status(404).json({ success: false, message: 'Task not found' });

    if (task.isPremium) {
      const unlock = await TaskUnlock.findOne({ userId: req.user.id, taskId: task._id });
      if (!unlock) {
        return res.status(403).json({ success: false, message: 'Unlock this premium task with tokens first' });
      }
    }

    // Create completion record
    await TaskCompletion.create({
      taskId: task._id,
      userId: req.user.id,
      status: 'approved', // Auto-approve for external tasks
      rewardPaid: true,
    });

    // Credit wallet
    const wallet = await Wallet.findOne({ userId: req.user.id });
    await wallet.credit(task.rewardUSD, 'task');

    // Log transaction
    await Transaction.create({
      userId: req.user.id,
      type: 'task',
      amountLocal: task.rewardUSD,
      amountUSD: task.rewardUSD,
      currency: 'USD',
      country: req.user.country,
      provider: 'internal',
      direction: 'credit',
      status: 'successful',
      processedAt: new Date(),
      metadata: { taskId: task._id, source: task.source },
    });

    // XP reward
    await User.findByIdAndUpdate(req.user.id, { $inc: { xpPoints: 15, tasksCompleted: 1 } });
    await updateChallengeProgress(req.user.id, 'task');

    // Dedup for 7 days
    await redis.setex(dupKey, 86400 * 7, '1');

    logger.info(`Task completed: ${task.title} by user ${req.user.id} — $${task.rewardUSD}`);
    res.json({ success: true, message: `Earned $${task.rewardUSD}!`, rewardUSD: task.rewardUSD });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'Task already completed' });
    logger.error(`Task completion error: ${err.message}`);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
