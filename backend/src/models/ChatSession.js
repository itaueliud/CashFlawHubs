const mongoose = require('mongoose');

const chatSessionSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  posterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  applicantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, default: '' },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  aiEnabled: { type: Boolean, default: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  lastMessageAt: { type: Date, default: Date.now },
}, { timestamps: true });

chatSessionSchema.index({ jobId: 1, posterId: 1, applicantId: 1 }, { unique: true });

module.exports = mongoose.model('ChatSession', chatSessionSchema);
