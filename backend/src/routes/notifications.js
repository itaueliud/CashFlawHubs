const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  listNotifications,
  readNotification,
  readAllNotifications,
} = require('../controllers/notificationController');

router.get('/', protect, listNotifications);
router.patch('/read-all', protect, readAllNotifications);
router.patch('/:id/read', protect, readNotification);

module.exports = router;
