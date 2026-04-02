const express = require('express');
const router = express.Router();
const { protect, requireActivation } = require('../middleware/auth');
const { Task, TaskCompletion } = require('../models/Task');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { getRedis } = require('../config/redis');
const logger = require('../utils/logger');

// @GET /api/tasks
router.get('/', protect, requireActivation, async (req, res) => {
  try {
    const tasks = await Task.find({ isActive: true }).sort({ rewardUSD: -1 }).limit(50);
    res.json({ success: true, tasks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/tasks/:id/complete
router.post('/:id/complete', protect, requireActivation, async (req, res) => {
  try {
    const redis = getRedis();
    const dupKey = `task:completion:${req.user.id}:${req.params.id}`;
    if (await redis.get(dupKey)) {
      return res.status(409).json({ success: false, message: 'Task already submitted' });
    }

    const task = await Task.findById(req.params.id);
    if (!task || !task.isActive) return res.status(404).json({ success: false, message: 'Task not found' });

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
