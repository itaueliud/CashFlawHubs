const mongoose = require('mongoose');

const PortalAuditSchema = new mongoose.Schema({
  type: { type: String, required: true }, // e.g. 'portal_mismatch'
  portalAttempted: { type: String },
  userRole: { type: String },
  identifierRedacted: { type: String },
  ipAddress: { type: String },
  userAgent: { type: String },
  meta: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('PortalAudit', PortalAuditSchema);
