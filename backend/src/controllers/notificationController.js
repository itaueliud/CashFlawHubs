const {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} = require('../services/notificationCenter');
const logger = require('../utils/logger');

exports.listNotifications = async (req, res) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      getNotifications({ userId: req.user.id, limit: req.query.limit || 10 }),
      getUnreadCount(req.user.id),
    ]);

    return res.json({ success: true, notifications, unreadCount });
  } catch (error) {
    logger.error(`listNotifications error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.readNotification = async (req, res) => {
  try {
    const notification = await markNotificationRead({ notificationId: req.params.id, userId: req.user.id });
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    return res.json({ success: true, notification });
  } catch (error) {
    logger.error(`readNotification error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.readAllNotifications = async (req, res) => {
  try {
    await markAllNotificationsRead(req.user.id);
    return res.json({ success: true });
  } catch (error) {
    logger.error(`readAllNotifications error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};
