const mongoose = require('mongoose');

const moderationRecordSchema = new mongoose.Schema({
  entityType: { type: String, enum: ['task', 'job', 'challenge', 'gig'], required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  action: { type: String, enum: ['approved', 'rejected', 'flagged'], required: true },
  reason: { type: String, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

moderationRecordSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

module.exports = mongoose.model('ModerationRecord', moderationRecordSchema);
