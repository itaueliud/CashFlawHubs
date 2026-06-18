const AuditLog = require('../models/AuditLog');

const logAudit = async ({ req, actor, module, action, targetType = null, targetId = null, metadata = {} }) => {
  try {
    await AuditLog.create({
      actorId: actor?._id || actor?.id || null,
      actorRole: actor?.role || 'anonymous',
      module,
      action,
      targetType,
      targetId: targetId ? String(targetId) : null,
      metadata,
      ipAddress: req.ip || null,
      userAgent: req.headers['user-agent'] || null,
    });
  } catch (_) {
    // Best-effort logging; never block primary workflow.
  }
};

module.exports = { logAudit };
