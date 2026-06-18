const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const adminAuditTrailSchema = new mongoose.Schema({
  auditId: {
    type: String,
    unique: true,
    default: () => `CFH-AUDIT-${uuidv4().slice(0, 8).toUpperCase()}`,
  },
  adminId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  adminRole:        { type: String, required: true },
  actionType:       { type: String, required: true },
  targetUserId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  targetEntity:     { type: String, default: null },
  actionDescription:{ type: String, required: true },
  reasonEntered:    { type: String, required: true },
  beforeState:      { type: mongoose.Schema.Types.Mixed, default: null },
  afterState:       { type: mongoose.Schema.Types.Mixed, default: null },
  ipAddress:        { type: String, default: null },
  device:           { type: String, default: null },
  timestampEAT:     { type: Date, default: Date.now },
  reversed:         { type: Boolean, default: false },
  reversedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reversalReason:   { type: String, default: null },
  reversedAt:       { type: Date, default: null },
}, {
  timestamps: { createdAt: 'timestampEAT', updatedAt: false },
});

adminAuditTrailSchema.index({ adminId: 1, timestampEAT: -1 });
adminAuditTrailSchema.index({ targetUserId: 1, timestampEAT: -1 });
adminAuditTrailSchema.index({ actionType: 1 });

module.exports = mongoose.model('AdminAuditTrail', adminAuditTrailSchema);
