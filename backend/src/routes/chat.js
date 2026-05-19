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
} = require('../controllers/chatController');

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

module.exports = router;
