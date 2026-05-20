const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/auth');
const { moderateChatPayload } = require('../middleware/chatModeration');
const {
  initiateJobChat,
  listMyChatSessions,
  getChatHistory,
  sendChatMessage,
  toggleAiForSession,
  setSessionStatus,
  flagChatMessage,
  createOfferMessage,
  respondToOfferMessage,
  uploadAttachment,
  adminModerateSession,
} = require('../controllers/chatController');
const chatUpload = require('../middleware/chatUpload');

router.use(protect);
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 120 : 40,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ success: false, message: 'Too many chat requests, slow down.' }),
});

router.use(chatLimiter);

router.post('/jobs/:jobId/initiate', initiateJobChat);
router.get('/sessions', listMyChatSessions);
router.get('/sessions/:sessionId/history', getChatHistory);
router.post('/sessions/:sessionId/messages', moderateChatPayload, sendChatMessage);
router.patch('/sessions/:sessionId/ai', toggleAiForSession);
router.patch('/sessions/:sessionId/status', setSessionStatus);
router.post('/sessions/:sessionId/attachments', chatUpload.single('file'), uploadAttachment);
router.patch('/sessions/:sessionId/messages/:messageId/flag', flagChatMessage);
router.post('/sessions/:sessionId/offers', createOfferMessage);
router.patch('/sessions/:sessionId/offers/:messageId/respond', respondToOfferMessage);
router.patch('/sessions/:sessionId/moderate', adminModerateSession);

module.exports = router;
