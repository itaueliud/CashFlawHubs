const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatSession', required: true, index: true },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', default: null, index: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String, enum: ['poster', 'applicant', 'assistant', 'system', 'admin'], required: true },
  messageType: { type: String, enum: ['text', 'offer', 'admin_notice'], default: 'text' },
  content: { type: String, required: true, trim: true },
  attachments: [{
    name: { type: String, default: '' },
    mimeType: { type: String, default: '' },
    size: { type: Number, default: 0 },
    url: { type: String, default: '' },
  }],
  isFlagged: { type: Boolean, default: false },
  flaggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  flaggedReason: { type: String, default: '' },
  readBy: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    readAt: { type: Date, default: Date.now },
  }],
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

chatMessageSchema.index({ sessionId: 1, createdAt: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
