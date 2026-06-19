const Notification = require('../models/Notification');

const createNotification = async ({
  userId,
  type = 'system',
  title,
  message,
  metadata = {},
  channel = 'in_app',
  dedupeKey = null,
  scheduledFor = null,
}) => {
  if (!userId || !title || !message) return null;

  const update = {
    userId,
    type,
    title,
    message,
    metadata,
    channel,
    scheduledFor,
    sentAt: new Date(),
    readAt: null,
  };

  if (dedupeKey) {
    update.dedupeKey = dedupeKey;
    return Notification.findOneAndUpdate(
      { dedupeKey },
      { $setOnInsert: update },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  return Notification.create(update);
};

const getNotifications = async ({ userId, limit = 10 }) =>
  Notification.find({
    userId,
    $or: [
      { scheduledFor: null },
      { scheduledFor: { $lte: new Date() } },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || 10, 1), 50))
    .lean();

const getUnreadCount = async (userId) => Notification.countDocuments({ userId, readAt: null });

const markNotificationRead = async ({ notificationId, userId }) =>
  Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { $set: { readAt: new Date() } },
    { new: true }
  );

const markAllNotificationsRead = async (userId) =>
  Notification.updateMany({ userId, readAt: null }, { $set: { readAt: new Date() } });

module.exports = {
  createNotification,
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
};
