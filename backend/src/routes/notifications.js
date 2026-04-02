const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

router.get('/', protect, async (req, res) => {
  res.json({ success: true, notifications: [] }); // Placeholder — extend with push notifications
});

module.exports = router;
