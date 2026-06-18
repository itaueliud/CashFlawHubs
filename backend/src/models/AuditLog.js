const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  actorRole: { type: String, required: true },
  action: { type: String, required: true },
  module: { type: String, required: true },
  targetType: { type: String, default: null },
  targetId: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  ipAddress: { type: String, default: null },
  userAgent: { type: String, default: null },
}, { timestamps: true });

auditLogSchema.index({ module: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
