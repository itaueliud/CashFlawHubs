const mongoose = require('mongoose');

const chatSessionSchema = new mongoose.Schema({
  sessionType: {
    type: String,
    enum: ['job', 'creator_hub'],
    default: 'job',
    index: true,
  },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', default: null, index: true },
  uploadId: { type: mongoose.Schema.Types.ObjectId, ref: 'CreatorUpload', default: null, index: true },
  posterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  applicantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, default: '' },
  status: { type: String, enum: ['open', 'in_progress', 'closed'], default: 'open' },
  moderationStatus: { type: String, enum: ['active', 'flagged', 'under_review', 'resolved'], default: 'active' },
  isFrozen: { type: Boolean, default: false },
  flaggedAt: { type: Date, default: null },
  flaggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  flaggedReason: { type: String, default: '' },
  adminJoinedAt: { type: Date, default: null },
  adminJoinedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolvedAt: { type: Date, default: null },
  lastMessagePreview: { type: String, default: '' },
  aiEnabled: { type: Boolean, default: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  lastMessageAt: { type: Date, default: Date.now },
}, { timestamps: true });

chatSessionSchema.index(
  { jobId: 1, posterId: 1, applicantId: 1 },
  { unique: true, partialFilterExpression: { sessionType: 'job' } }
);

chatSessionSchema.index(
  { uploadId: 1, applicantId: 1 },
  { unique: true, partialFilterExpression: { sessionType: 'creator_hub' } }
);

module.exports = mongoose.model('ChatSession', chatSessionSchema);
