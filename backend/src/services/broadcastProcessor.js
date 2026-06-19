const User = require('../models/User');
const Notification = require('../models/Notification');
const BroadcastCampaign = require('../models/BroadcastCampaign');
const { createNotification, sendgridClient } = require('./notificationService');
const logger = require('../utils/logger');

const normalizeAudience = (campaign) => ({
  scope: campaign?.target?.scope || 'all',
  countries: Array.isArray(campaign?.target?.countries) ? campaign.target.countries.filter(Boolean) : [],
  minBalance: campaign?.target?.minBalance != null ? Number(campaign.target.minBalance) : null,
  activatedOnly: Boolean(campaign?.target?.activatedOnly),
  userIds: Array.isArray(campaign?.target?.userIds) ? campaign.target.userIds : [],
  userSearch: String(campaign?.target?.userSearch || '').trim(),
});

const buildAudienceQuery = (target) => {
  const query = { isBanned: false };
  if (target.scope === 'country' && target.countries.length > 0) {
    query.country = { $in: target.countries };
  }
  if (target.scope === 'activated' || target.activatedOnly) {
    query.activationStatus = true;
  }
  if (target.scope === 'balance' || target.minBalance != null) {
    query.balanceUSD = { $gte: Number(target.minBalance || 0) };
  }
  if (target.scope === 'manual' && target.userIds.length > 0) {
    query._id = { $in: target.userIds };
  }
  return query;
};

const resolveAudience = async (campaign) => {
  const target = normalizeAudience(campaign);
  const query = buildAudienceQuery(target);
  const users = await User.find(query).select('_id email phone name country balanceUSD activationStatus').sort({ createdAt: 1 });
  return users;
};

const campaignPayloadToHtml = (title, message, metadata = {}) => {
  const lines = String(message || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const body = lines.map((line) => `<p style="margin:0 0 12px">${line}</p>`).join('');
  const footer = metadata.footer ? `<p style="margin-top:20px;color:#94a3b8;font-size:12px">${metadata.footer}</p>` : '';
  return `
    <div style="font-family:Arial,sans-serif;background:#0f172a;color:#e2e8f0;padding:24px;border-radius:16px">
      <h2 style="margin:0 0 16px;color:#fff">${title}</h2>
      ${body}
      ${footer}
    </div>
  `;
};

const sendCampaign = async (campaignId) => {
  const campaign = await BroadcastCampaign.findById(campaignId);
  if (!campaign || campaign.status === 'sent') return campaign;
  if (campaign.status === 'scheduled' && campaign.scheduledFor && new Date(campaign.scheduledFor) > new Date()) return campaign;

  campaign.status = 'sending';
  campaign.lastError = '';
  await campaign.save();

  try {
    const users = await resolveAudience(campaign);
    const targetCount = users.length;
    const html = campaign.htmlMessage || campaignPayloadToHtml(campaign.title, campaign.message, campaign.metadata || {});
    const sendInApp = ['in_app', 'both'].includes(campaign.channel);
    const sendEmail = ['email', 'both'].includes(campaign.channel);

    const results = await Promise.allSettled(users.map(async (user) => {
      if (sendInApp) {
        await createNotification({
          userId: user._id,
          type: 'system',
          title: campaign.title,
          message: campaign.message,
          channel: 'in_app',
          scheduledFor: campaign.scheduledFor || null,
          metadata: {
            ...(campaign.metadata || {}),
            broadcastId: campaign._id,
            scope: 'broadcast',
          },
        });
      }

      if (sendEmail && user.email) {
        await sendgridClient.sendEmail({
          to: user.email,
          subject: campaign.title,
          html,
        });
      }
    }));

    const sent = results.filter((item) => item.status === 'fulfilled').length;
    const failed = results.length - sent;
    const read = await Notification.countDocuments({
      userId: { $in: users.map((user) => user._id) },
      'metadata.broadcastId': campaign._id,
      readAt: { $ne: null },
    });

    campaign.status = 'sent';
    campaign.stats = {
      targeted: targetCount,
      sent,
      failed,
      read,
    };
    campaign.sentAt = new Date();
    await campaign.save();
    return campaign;
  } catch (error) {
    campaign.status = 'failed';
    campaign.lastError = error.message;
    await campaign.save();
    logger.error(`Broadcast campaign ${campaignId} failed: ${error.message}`);
    return campaign;
  }
};

const processDueBroadcasts = async () => {
  const now = new Date();
  const due = await BroadcastCampaign.find({
    status: { $in: ['scheduled', 'draft'] },
    scheduledFor: { $ne: null, $lte: now },
  }).sort({ scheduledFor: 1 });

  for (const campaign of due) {
    await sendCampaign(campaign._id);
  }
};

module.exports = {
  processDueBroadcasts,
  sendCampaign,
  resolveAudience,
  buildAudienceQuery,
};
