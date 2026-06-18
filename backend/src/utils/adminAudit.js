const AdminAuditTrail = require('../models/AdminAuditTrail');

const logAdminAction = async ({
  req,
  admin,
  actionType,
  targetUserId = null,
  targetEntity = null,
  actionDescription,
  reasonEntered,
  beforeState = null,
  afterState = null,
}) => {
  try {
    await AdminAuditTrail.create({
      adminId:           admin._id || admin.id,
      adminRole:         admin.role || 'unknown',
      actionType,
      targetUserId:      targetUserId || null,
      targetEntity:      targetEntity || null,
      actionDescription,
      reasonEntered,
      beforeState,
      afterState,
      ipAddress:         req?.ip || null,
      device:            req?.headers?.['user-agent'] || null,
    });
  } catch (err) {
    console.error('AdminAuditTrail write failed:', err.message);
  }
};

module.exports = { logAdminAction };
