const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');

router.get('/profile', protect, async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({ success: true, user });
});

router.put('/profile', protect, async (req, res) => {
  const { name, bio, avatar } = req.body;
  const user = await User.findByIdAndUpdate(req.user.id, { name, bio, avatar }, { new: true });
  res.json({ success: true, user });
});

module.exports = router;
