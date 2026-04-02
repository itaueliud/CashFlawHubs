const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

router.get('/stats', protect, adminOnly, async (req, res) => {
  const [totalUsers, activeUsers, totalTransactions] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ activationStatus: true }),
    Transaction.countDocuments({ status: 'successful' }),
  ]);
  res.json({ success: true, stats: { totalUsers, activeUsers, totalTransactions } });
});

router.get('/users', protect, adminOnly, async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const users = await User.find().sort({ createdAt: -1 }).skip((page-1)*limit).limit(Number(limit));
  res.json({ success: true, users });
});

router.put('/users/:id/ban', protect, adminOnly, async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { isBanned: true, banReason: req.body.reason }, { new: true });
  res.json({ success: true, user });
});

router.get('/tasks', protect, adminOnly, async (req, res) => {
  const tasks = await require('../models/Challenge').Challenge.find().sort({ createdAt: -1 });
  res.json({ success: true, tasks });
});

module.exports = router;
