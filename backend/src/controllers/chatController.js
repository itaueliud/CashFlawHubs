const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const Job = require('../models/Job');
const JobApplication = require('../models/JobApplication');
const User = require('../models/User');
const { generateReply } = require('../services/aiService');
const { retrieveRelevantContext } = require('../services/vectorStore');

const asObjectIdString = (value) => String(value || '');

const determineRole = (session, userId) => {
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

exports.initiateJobChat = async (req, res) => {
  try {
    const { jobId } = req.params;
    const targetApplicantId = req.body?.applicantId;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const requesterId = req.user._id || req.user.id;
    const requesterIsPoster = asObjectIdString(job.postedBy) === asObjectIdString(requesterId);

    let posterId = job.postedBy;
    let applicantId = targetApplicantId || requesterId;

    if (posterId && requesterIsPoster) {
      if (!targetApplicantId) {
        return res.status(400).json({ success: false, message: 'Applicant id is required when initiating as poster' });
      }

      const applied = await JobApplication.findOne({ jobId, userId: targetApplicantId });
      if (!applied) {
        return res.status(400).json({ success: false, message: 'Applicant has not applied for this job' });
      }
    } else if (posterId) {
      const applied = await JobApplication.findOne({ jobId, userId: requesterId });
      if (!applied) {
        return res.status(403).json({ success: false, message: 'Apply to the job first to open chat' });
      }
      applicantId = requesterId;
    } else {
      applicantId = requesterId;
    }

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

exports.listMyChatSessions = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const query = isAdminUser(req.user)
      ? {}
      : { $or: [{ posterId: userId }, { applicantId: userId }] };

    const sessions = await ChatSession.find(query)
      .sort({ lastMessageAt: -1 })
      .populate('jobId', 'title company location')
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

    const message = await ChatMessage.create({
      sessionId: session._id,
      jobId: session.jobId,
      senderId: userId,
      role,
      messageType: req.body?.messageType || 'text',
      content: String(content).trim(),
      attachments: Array.isArray(req.body?.attachments) ? req.body.attachments : [],
      readBy: [{ userId, readAt: new Date() }],
      metadata: req.body?.metadata || {},
    });

    session.lastMessageAt = new Date();
    session.lastMessagePreview = String(content).slice(0, 140);
    await session.save();
    const io = req.app.get('io');
    if (io) {
      io.to(`chat:${session._id}`).emit('chat:message', { sessionId: session._id, message });
    }

    let aiMessage = null;
    if (includeAi && session.aiEnabled) {
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
            prompt: String(content),
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
        jobId: session.jobId,
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
      jobId: session.jobId,
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
      jobId: session.jobId,
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
      jobId: session.jobId,
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
