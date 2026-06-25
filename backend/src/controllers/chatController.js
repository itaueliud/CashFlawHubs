const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const CreatorUpload = require('../models/CreatorUpload');
const FraudAlert = require('../models/FraudAlert');
const Job = require('../models/Job');
const JobApplication = require('../models/JobApplication');
const User = require('../models/User');
const { generateReply } = require('../services/aiService');
const { retrieveRelevantContext } = require('../services/vectorStore');
const { trackEvent } = require('../services/eventTracker');

const asObjectIdString = (value) => String(value || '');

const determineRole = (session, userId) => {
  if (session.sessionType === 'creator_hub') {
    if (session.posterId && asObjectIdString(session.posterId) === asObjectIdString(userId)) return 'poster';
    if (asObjectIdString(session.applicantId) === asObjectIdString(userId)) return 'applicant';
    return null;
  }

  if (session.posterId && asObjectIdString(session.posterId) === asObjectIdString(userId)) return 'poster';
  if (asObjectIdString(session.applicantId) === asObjectIdString(userId)) return 'applicant';
  return null;
};

const isAdminUser = (user) => ['admin', 'superadmin'].includes(String(user?.role || ''));

const canAccessSession = (session, user) => {
  if (isAdminUser(user)) return 'admin';
  const userId = user?._id || user?.id;
  if (session.posterId && asObjectIdString(session.posterId) === asObjectIdString(userId)) return 'poster';
  if (asObjectIdString(session.applicantId) === asObjectIdString(userId)) return 'applicant';
  return null;
};

const requireSessionMembership = async (sessionId, user) => {
  const session = await ChatSession.findById(sessionId);
  if (!session) {
    const error = new Error('Chat session not found');
    error.statusCode = 404;
    throw error;
  }

  const role = canAccessSession(session, user);
  if (!role) {
    const error = new Error('You are not allowed to access this chat');
    error.statusCode = 403;
    throw error;
  }

  return { session, role };
};
const FRAUD_SEVERITY_RANK = { low: 1, medium: 2, high: 3, critical: 4 };

const CHAT_FRAUD_RULES = [
  {
    severity: 'critical',
    action: 'block',
    description: 'Potential request for OTP, PIN, password, or verification code',
    patterns: [
      /\b(?:otp|one[-\s]*time\s*password|verification\s*code|security\s*code|passcode|pin|password)\b/i,
      /\b(?:share|send|tell|provide)\s+(?:me\s+)?(?:your\s+)?(?:otp|pin|password|verification\s*code|security\s*code|passcode)\b/i,
    ],
  },
  {
    severity: 'high',
    action: 'flag',
    description: 'Off-platform payment or contact attempt',
    patterns: [
      /\b(?:pay|payment|send money|transfer money|advance fee|upfront fee|deposit)\b/i,
      /\b(?:whatsapp|telegram|signal|crypto|bitcoin|usdt|binance|western union|moneygram)\b/i,
      /\b(?:outside|off[-\s]*platform)\b/i,
    ],
  },
  {
    severity: 'medium',
    action: 'flag',
    description: 'Suspicious scam or urgency language',
    patterns: [
      /\b(?:scam|fraud|fake\s+payment|urgent|urgently|kindly)\b/i,
    ],
  },
];

const detectChatFraud = (content) => {
  const text = String(content || '').replace(/\s+/g, ' ').trim();
  if (!text) return null;

  const matches = [];
  for (const rule of CHAT_FRAUD_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      matches.push(rule);
    }
  }

  if (!matches.length) return null;

  const strongest = matches.reduce((best, current) => {
    if (!best) return current;
    return FRAUD_SEVERITY_RANK[current.severity] > FRAUD_SEVERITY_RANK[best.severity] ? current : best;
  }, null);

  return {
    action: strongest.action,
    severity: strongest.severity,
    description: strongest.description,
    matchedReasons: matches.map((match) => match.description),
  };
};

const createChatFraudAlert = async ({ session, userId, content, detection, messageId = null }) => {
  const relatedUserIds = Array.from(new Set([
    session.posterId,
    session.applicantId,
    userId,
  ].filter(Boolean).map((value) => String(value))));

  return FraudAlert.create({
    alertType: 'chat_fraud',
    severity: detection.severity,
    relatedUserIds,
    description: `Chat fraud signal detected: ${detection.description}`,
    status: 'open',
    metadata: {
      sessionId: String(session._id),
      jobId: session.jobId ? String(session.jobId) : null,
      senderId: String(userId),
      messageId: messageId ? String(messageId) : null,
      messagePreview: String(content || '').slice(0, 280),
      matchedReasons: detection.matchedReasons,
      action: detection.action,
    },
  });
};

exports.initiateJobChat = async (req, res) => {
  try {
    const { jobId } = req.params;
    const targetApplicantId = req.body?.applicantId;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (String(job.source || '').trim().toLowerCase() !== 'internal') {
      return res.status(403).json({ success: false, message: 'Chat is only available for internal jobs' });
    }

    const requesterId = req.user._id || req.user.id;
    const requesterIsPoster = asObjectIdString(job.postedBy) === asObjectIdString(requesterId);

    if (!requesterIsPoster) {
      return res.status(403).json({ success: false, message: 'Only the job poster can initiate chat' });
    }

    if (!targetApplicantId) {
      return res.status(400).json({ success: false, message: 'Applicant id is required when initiating a chat' });
    }

    const applied = await JobApplication.findOne({ jobId, userId: targetApplicantId });
    if (!applied) {
      return res.status(400).json({ success: false, message: 'Applicant has not applied for this job' });
    }

    const posterId = job.postedBy;
    const applicantId = targetApplicantId;

    const title = `${job.title} - ${job.company}`;
    const session = await ChatSession.findOneAndUpdate(
      { jobId, posterId, applicantId },
      {
        $setOnInsert: {
          title,
          status: 'open',
          aiEnabled: true,
        },
      },
      { upsert: true, new: true }
    );

    return res.json({ success: true, session });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.initiateCreatorHubChat = async (req, res) => {
  try {
    const { uploadId } = req.params;
    const viewerId = req.user._id || req.user.id;

    const upload = await CreatorUpload.findById(uploadId).select('creatorId title status');
    if (!upload || upload.status !== 'published') {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    const creatorId = upload.creatorId;
    if (asObjectIdString(creatorId) === asObjectIdString(viewerId)) {
      return res.status(400).json({ success: false, message: 'You cannot chat with yourself' });
    }

    const title = `Re: ${upload.title}`;
    const session = await ChatSession.findOneAndUpdate(
      { sessionType: 'creator_hub', uploadId: upload._id, applicantId: viewerId },
      {
        $setOnInsert: {
          sessionType: 'creator_hub',
          uploadId: upload._id,
          posterId: creatorId,
          applicantId: viewerId,
          title,
          status: 'open',
          aiEnabled: false,
          metadata: { uploadId: String(upload._id), uploadTitle: upload.title },
        },
      },
      { upsert: true, new: true }
    );

    return res.json({ success: true, session });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.listMyChatSessions = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const query = isAdminUser(req.user)
      ? {}
      : { $or: [{ posterId: userId }, { applicantId: userId }] };

    const sessions = await ChatSession.find(query)
      .sort({ lastMessageAt: -1 })
      .populate('jobId', 'title company location')
      .populate('uploadId', 'title category')
      .populate('posterId', 'name userId role')
      .populate('applicantId', 'name userId role');

    const messageCounts = await Promise.all(
      sessions.map(async (session) => {
        const unreadCount = await ChatMessage.countDocuments({
          sessionId: session._id,
          senderId: { $ne: userId },
          ...(isAdminUser(req.user)
            ? {}
            : { 'readBy.userId': { $ne: userId } }),
        });
        return { sessionId: String(session._id), unreadCount };
      })
    );

    const unreadBySessionId = Object.fromEntries(messageCounts.map((item) => [item.sessionId, item.unreadCount]));
    const sessionsWithUnread = sessions.map((session) => ({
      ...session.toObject(),
      unreadCount: unreadBySessionId[String(session._id)] || 0,
    }));

    return res.json({ success: true, sessions: sessionsWithUnread });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getChatHistory = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id || req.user.id;
    const { session } = await requireSessionMembership(sessionId, req.user);

    const messages = await ChatMessage.find({ sessionId })
      .sort({ createdAt: 1 })
      .populate('senderId', 'name userId');

    await ChatMessage.updateMany(
      {
        sessionId,
        senderId: { $ne: userId },
        'readBy.userId': { $ne: userId },
      },
      {
        $push: { readBy: { userId, readAt: new Date() } },
      }
    );

    return res.json({ success: true, session, messages });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.sendChatMessage = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { content, includeAi = false } = req.body;
    const userId = req.user._id || req.user.id;

    if (!content || !String(content).trim()) {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }

    const { session, role } = await requireSessionMembership(sessionId, req.user);
    if (session.isFrozen && role !== 'admin') {
      return res.status(423).json({ success: false, message: 'Conversation is frozen by admin review' });
    }

    const normalizedContent = String(content).trim();
    const fraudSignal = detectChatFraud(normalizedContent);
    const io = req.app.get('io');

    if (fraudSignal?.action === 'block') {
      await createChatFraudAlert({
        session,
        userId,
        content: normalizedContent,
        detection: fraudSignal,
      });

      session.moderationStatus = 'flagged';
      session.flaggedAt = new Date();
      session.flaggedBy = userId;
      session.flaggedReason = fraudSignal.description;
      await session.save();

      if (io) {
        io.to(`chat:${session._id}`).emit('chat:session-updated', { sessionId: session._id, session });
      }

      return res.status(400).json({
        success: false,
        code: 'FRAUD_BLOCKED',
        message: 'This message was blocked by safety review.',
      });
    }

    const message = await ChatMessage.create({
      sessionId: session._id,
      jobId: session.jobId || null,
      senderId: userId,
      role,
      messageType: req.body?.messageType || 'text',
      content: normalizedContent,
      attachments: Array.isArray(req.body?.attachments) ? req.body.attachments : [],
      readBy: [{ userId, readAt: new Date() }],
      isFlagged: Boolean(fraudSignal),
      flaggedBy: fraudSignal ? userId : null,
      flaggedReason: fraudSignal ? fraudSignal.description : '',
      metadata: {
        ...(req.body?.metadata || {}),
        moderation: fraudSignal
          ? {
              autoFlagged: true,
              severity: fraudSignal.severity,
              matchedReasons: fraudSignal.matchedReasons,
            }
          : {},
      },
    });

    session.lastMessageAt = new Date();
    session.lastMessagePreview = normalizedContent.slice(0, 140);

    if (fraudSignal) {
      await createChatFraudAlert({
        session,
        userId,
        content: normalizedContent,
        detection: fraudSignal,
        messageId: message._id,
      });

      session.moderationStatus = 'under_review';
      session.flaggedAt = session.flaggedAt || new Date();
      session.flaggedBy = userId;
      session.flaggedReason = fraudSignal.description;
      await session.save();

      if (io) {
        io.to(`chat:${session._id}`).emit('chat:session-updated', { sessionId: session._id, session });
      }
    } else {
      await session.save();
    }

    await trackEvent(userId, 'chat_message');
    if (io) {
      io.to(`chat:${session._id}`).emit('chat:message', { sessionId: session._id, message });
    }

    let aiMessage = null;
    if (includeAi && session.aiEnabled && !fraudSignal) {
      const [history, job, applicant, poster] = await Promise.all([
        ChatMessage.find({ sessionId: session._id }).sort({ createdAt: 1 }).limit(20),
        Job.findById(session.jobId),
        User.findById(session.applicantId).select('name'),
        User.findById(session.posterId).select('name'),
      ]);

      const aiContent = await generateReply({
        history,
        senderRole: role,
        context: {
          jobTitle: job?.title,
          company: job?.company,
          applicantName: applicant?.name,
          posterName: poster?.name,
          ragSnippets: await retrieveRelevantContext({
            sessionId: session._id,
            prompt: normalizedContent,
            limit: 5,
          }),
        },
      });

      if (io) {
        const chunks = aiContent.match(/.{1,80}/g) || [];
        for (const chunk of chunks) {
          io.to(`chat:${session._id}`).emit('ai-delta', { sessionId: session._id, delta: chunk });
        }
      }

      aiMessage = await ChatMessage.create({
        sessionId: session._id,
        jobId: session.jobId || null,
        senderId: userId,
        role: 'assistant',
        content: aiContent,
        metadata: { generated: true },
      });

      session.lastMessageAt = new Date();
      await session.save();
      if (io) {
        io.to(`chat:${session._id}`).emit('chat:message', { sessionId: session._id, message: aiMessage });
        io.to(`chat:${session._id}`).emit('ai-done', { sessionId: session._id });
      }
    }

    return res.json({ success: true, message, aiMessage });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.toggleAiForSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id || req.user.id;
    const { session, role } = await requireSessionMembership(sessionId, req.user);

    if (role !== 'poster') {
      return res.status(403).json({ success: false, message: 'Only the job poster can change AI settings' });
    }

    session.aiEnabled = Boolean(req.body?.aiEnabled);
    await session.save();

    return res.json({ success: true, session });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.setSessionStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { status } = req.body;
    const userId = req.user._id || req.user.id;
    const { session, role } = await requireSessionMembership(sessionId, req.user);

    if (!['poster', 'admin'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Only poster or admin can change status' });
    }
    if (!['open', 'in_progress', 'closed'].includes(String(status))) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    session.status = status;
    await session.save();
    const io = req.app.get('io');
    if (io) io.to(`chat:${session._id}`).emit('chat:session-updated', { sessionId: session._id, session });

    await ChatMessage.create({
      sessionId: session._id,
      jobId: session.jobId || null,
      senderId: userId,
      role: role === 'admin' ? 'admin' : 'system',
      messageType: 'admin_notice',
      content: `Chat status updated to ${status}`,
      readBy: [{ userId, readAt: new Date() }],
      metadata: { status },
    });
    return res.json({ success: true, session });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.flagChatMessage = async (req, res) => {
  try {
    const { sessionId, messageId } = req.params;
    const { reason = 'Suspicious activity reported' } = req.body || {};
    const userId = req.user._id || req.user.id;
    const { session } = await requireSessionMembership(sessionId, req.user);

    const message = await ChatMessage.findOne({ _id: messageId, sessionId });
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });

    message.isFlagged = true;
    message.flaggedBy = userId;
    message.flaggedReason = String(reason).slice(0, 500);
    await message.save();

    session.moderationStatus = 'flagged';
    session.flaggedAt = new Date();
    session.flaggedBy = userId;
    session.flaggedReason = String(reason).slice(0, 500);
    await session.save();

    const io = req.app.get('io');
    if (io) io.to(`chat:${session._id}`).emit('chat:session-updated', { sessionId: session._id, session });

    return res.json({ success: true, session, message });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.createOfferMessage = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { terms = '', amount = '', currency = 'USD' } = req.body || {};
    const userId = req.user._id || req.user.id;
    const { session, role } = await requireSessionMembership(sessionId, req.user);
    if (!['poster', 'applicant'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Only participants can create offers' });
    }

    const content = `Offer: ${terms}`;
    const message = await ChatMessage.create({
      sessionId: session._id,
      jobId: session.jobId || null,
      senderId: userId,
      role,
      messageType: 'offer',
      content,
      metadata: { offer: { terms, amount, currency, state: 'pending' } },
      readBy: [{ userId, readAt: new Date() }],
    });

    session.lastMessageAt = new Date();
    session.lastMessagePreview = content.slice(0, 140);
    await session.save();
    const io = req.app.get('io');
    if (io) io.to(`chat:${session._id}`).emit('chat:message', { sessionId: session._id, message });
    return res.json({ success: true, message });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.respondToOfferMessage = async (req, res) => {
  try {
    const { sessionId, messageId } = req.params;
    const { action } = req.body || {};
    const userId = req.user._id || req.user.id;
    const { session } = await requireSessionMembership(sessionId, req.user);
    const message = await ChatMessage.findOne({ _id: messageId, sessionId, messageType: 'offer' });
    if (!message) return res.status(404).json({ success: false, message: 'Offer not found' });
    if (!['accept', 'counter', 'reject'].includes(String(action))) {
      return res.status(400).json({ success: false, message: 'Invalid offer action' });
    }
    message.metadata = { ...(message.metadata || {}), offer: { ...(message.metadata?.offer || {}), state: action, respondedBy: userId, respondedAt: new Date() } };
    await message.save();
    const io = req.app.get('io');
    if (io) io.to(`chat:${session._id}`).emit('chat:message-updated', { sessionId: session._id, message });
    return res.json({ success: true, message });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.uploadAttachment = async (req, res) => {
  try {
    const { sessionId } = req.params;
    await requireSessionMembership(sessionId, req.user);
    if (!req.file) return res.status(400).json({ success: false, message: 'Attachment is required' });
    const relativePath = `/uploads/chat/${req.file.filename}`;
    return res.json({
      success: true,
      attachment: {
        name: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: relativePath,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.adminModerateSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { action, reason = '' } = req.body || {};
    if (!isAdminUser(req.user)) return res.status(403).json({ success: false, message: 'Admin access required' });

    const session = await ChatSession.findById(sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'Chat session not found' });

    const adminUserId = req.user._id || req.user.id;
    if (action === 'join') {
      session.moderationStatus = 'under_review';
      session.adminJoinedAt = new Date();
      session.adminJoinedBy = adminUserId;
    } else if (action === 'freeze') {
      session.isFrozen = true;
      session.moderationStatus = 'under_review';
    } else if (action === 'unfreeze') {
      session.isFrozen = false;
    } else if (action === 'resolve') {
      session.moderationStatus = 'resolved';
      session.resolvedAt = new Date();
      session.isFrozen = false;
    } else if (action === 'warn') {
      session.moderationStatus = 'under_review';
    } else if (action === 'suspend' || action === 'ban') {
      const targetId = req.body?.targetUserId;
      if (!targetId) return res.status(400).json({ success: false, message: 'targetUserId is required' });
      const targetUser = await User.findById(targetId);
      if (!targetUser) return res.status(404).json({ success: false, message: 'Target user not found' });
      targetUser.isActive = false;
      targetUser.isBanned = action === 'ban';
      targetUser.banReason = reason || `Chat moderation: ${action}`;
      await targetUser.save();
      session.moderationStatus = 'under_review';
    } else {
      return res.status(400).json({ success: false, message: 'Unsupported moderation action' });
    }

    await session.save();
    const content = action === 'join'
      ? `Admin ${req.user.name || 'staff'} has joined as mediator. Payments outside the platform violate terms.`
      : `Admin action: ${action}${reason ? ` (${reason})` : ''}`;
    const adminMsg = await ChatMessage.create({
      sessionId: session._id,
      jobId: session.jobId || null,
      senderId: adminUserId,
      role: 'admin',
      messageType: 'admin_notice',
      content,
      readBy: [{ userId: adminUserId, readAt: new Date() }],
      metadata: { action, reason },
    });
    const io = req.app.get('io');
    if (io) {
      io.to(`chat:${session._id}`).emit('chat:session-updated', { sessionId: session._id, session });
      io.to(`chat:${session._id}`).emit('chat:message', { sessionId: session._id, message: adminMsg });
    }
    return res.json({ success: true, session });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};
