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

const requireSessionMembership = async (sessionId, userId) => {
  const session = await ChatSession.findById(sessionId);
  if (!session) {
    const error = new Error('Chat session not found');
    error.statusCode = 404;
    throw error;
  }

  const role = determineRole(session, userId);
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
    const sessions = await ChatSession.find({
      $or: [{ posterId: userId }, { applicantId: userId }],
    })
      .sort({ lastMessageAt: -1 })
      .populate('jobId', 'title company location')
      .populate('posterId', 'name userId')
      .populate('applicantId', 'name userId');

    return res.json({ success: true, sessions });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getChatHistory = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id || req.user.id;
    await requireSessionMembership(sessionId, userId);

    const messages = await ChatMessage.find({ sessionId })
      .sort({ createdAt: 1 })
      .populate('senderId', 'name userId');

    return res.json({ success: true, messages });
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

    const { session, role } = await requireSessionMembership(sessionId, userId);

    const message = await ChatMessage.create({
      sessionId: session._id,
      jobId: session.jobId,
      senderId: userId,
      role,
      content: String(content).trim(),
      metadata: req.body?.metadata || {},
    });

    session.lastMessageAt = new Date();
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
    const { session, role } = await requireSessionMembership(sessionId, userId);

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
