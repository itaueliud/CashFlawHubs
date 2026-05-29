const { URL } = require('url');
const Job = require('../models/Job');
const JobApplication = require('../models/JobApplication');
const JobOutreachLog = require('../models/JobOutreachLog');
const { sendgridClient } = require('./notificationService');
const logger = require('../utils/logger');

const KNOWN_BOARD_HOSTS = new Set([
  'remoteok.com',
  'www.remoteok.com',
  'remotive.com',
  'www.remotive.com',
  'jobicy.com',
  'www.jobicy.com',
  'weworkremotely.com',
  'www.weworkremotely.com',
  'adzuna.com',
  'www.adzuna.com',
  'careerjet.com',
  'www.careerjet.com',
  'jooble.org',
  'www.jooble.org',
  'arbeitnow.com',
  'www.arbeitnow.com',
  'themuse.com',
  'www.themuse.com',
  'jsearch.p.rapidapi.com',
]);

const COMMON_ALIASES = (process.env.OUTREACH_GUESS_ALIASES || 'jobs,careers,hr,recruiting,talent')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const normalizeHost = (value) => String(value || '').trim().toLowerCase().replace(/^www\./, '');

const getHostFromApplicationUrl = (applicationUrl) => {
  try {
    const parsed = new URL(applicationUrl);
    return normalizeHost(parsed.hostname);
  } catch (error) {
    return null;
  }
};

const guessRecipientEmail = (job) => {
  if (!job) return null;
  const directEmail = String(job.applicationContactEmail || '').trim().toLowerCase();
  if (directEmail) return directEmail;

  const host = getHostFromApplicationUrl(job.applicationUrl);
  if (!host) return null;
  if (KNOWN_BOARD_HOSTS.has(host)) return null;

  const alias = COMMON_ALIASES[0] || 'jobs';
  return `${alias}@${host}`;
};

const formatJobDigestList = (jobs, applicationCounts = new Map()) => {
  const lines = jobs
    .map((job) => {
      const count = applicationCounts.get(String(job._id)) || 0;
      const contactHint = job.applicationContactEmail ? `Contact: ${job.applicationContactEmail}` : 'Contact: guessed from job site';
      return `
        <li style="margin-bottom: 16px;">
          <strong>${job.title}</strong> at ${job.company}<br/>
          <span style="color:#64748b;">${job.location || 'Remote'} · ${job.source}</span><br/>
          <span style="color:#16a34a;">${count} collected application${count === 1 ? '' : 's'}</span><br/>
          <span style="color:#64748b;">${contactHint}</span>
        </li>
      `;
    })
    .join('');

  return `<ul style="padding-left: 18px;">${lines}</ul>`;
};

const buildOutreachHtml = ({ recipientEmail, jobs, applicationCounts, frontendUrl }) => {
  const totalApplications = jobs.reduce((sum, job) => sum + (applicationCounts.get(String(job._id)) || 0), 0);
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <p>Hello,</p>
      <p>CashFlawHubs collected <strong>${totalApplications}</strong> application${totalApplications === 1 ? '' : 's'} for your job posting${jobs.length === 1 ? '' : 's'}.</p>
      <p>If this is your job, please reply to this email or claim it here so we can keep sending applications directly to you:</p>
      <p><a href="${frontendUrl}" style="color:#16a34a;">Claim / verify your listing</a></p>
      ${formatJobDigestList(jobs, applicationCounts)}
      <p style="color:#64748b; font-size: 12px;">If you do not want further emails, please ignore this message. This digest is sent because your job was discovered publicly and applications were collected on CashFlawHubs.</p>
    </div>
  `;
};

const sendDailyJobOutreachDigest = async () => {
  const now = new Date();
  const digestDate = now.toISOString().slice(0, 10);
  const frontendUrl = (process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

  const jobs = await Job.find({
    isActive: true,
    source: { $ne: 'internal' },
    $or: [
      { collectOnly: true },
      { applicationContactEmail: { $eq: null } },
      { applicationContactEmail: { $exists: false } },
    ],
  })
    .select('_id title company location source applicationUrl applicationContactEmail collectOnly')
    .sort({ publishedAt: -1 })
    .lean();

  if (jobs.length === 0) {
    logger.info('Daily job outreach digest skipped: no collect-only jobs found');
    return { sent: 0, skipped: 0 };
  }

  const applicationCountsRaw = await JobApplication.aggregate([
    { $match: { jobId: { $in: jobs.map((job) => job._id) } } },
    { $group: { _id: '$jobId', count: { $sum: 1 } } },
  ]);
  const applicationCounts = new Map(applicationCountsRaw.map((row) => [String(row._id), row.count]));

  const grouped = new Map();
  for (const job of jobs) {
    const recipientEmail = guessRecipientEmail(job);
    if (!recipientEmail) continue;

    const recipientHost = recipientEmail.split('@')[1] || null;
    const existingGroup = grouped.get(recipientEmail) || { recipientEmail, recipientHost, jobs: [] };
    existingGroup.jobs.push(job);
    grouped.set(recipientEmail, existingGroup);
  }

  let sent = 0;
  let skipped = 0;

  for (const group of grouped.values()) {
    const jobsForRecipient = group.jobs.filter(Boolean);
    if (jobsForRecipient.length === 0) continue;

    const log = await JobOutreachLog.findOne({ recipientEmail: group.recipientEmail, digestDate });
    if (log?.status === 'sent') {
      skipped += 1;
      continue;
    }

    const subject = `New applications for ${jobsForRecipient.length} job${jobsForRecipient.length === 1 ? '' : 's'} on CashFlawHubs`;
    const html = buildOutreachHtml({
      recipientEmail: group.recipientEmail,
      jobs: jobsForRecipient,
      applicationCounts,
      frontendUrl,
    });

    try {
      await sendgridClient.sendEmail({
        to: group.recipientEmail,
        subject,
        html,
      });

      await JobOutreachLog.findOneAndUpdate(
        { recipientEmail: group.recipientEmail, digestDate },
        {
          recipientEmail: group.recipientEmail,
          recipientHost: group.recipientHost,
          digestDate,
          jobIds: jobsForRecipient.map((job) => job._id),
          jobCount: jobsForRecipient.length,
          status: 'sent',
          lastError: null,
        },
        { upsert: true, new: true }
      );
      sent += 1;
    } catch (error) {
      await JobOutreachLog.findOneAndUpdate(
        { recipientEmail: group.recipientEmail, digestDate },
        {
          recipientEmail: group.recipientEmail,
          recipientHost: group.recipientHost,
          digestDate,
          jobIds: jobsForRecipient.map((job) => job._id),
          jobCount: jobsForRecipient.length,
          status: 'failed',
          lastError: error.message,
        },
        { upsert: true, new: true }
      );
      logger.warn(`Daily outreach digest failed for ${group.recipientEmail}: ${error.message}`);
    }
  }

  return { sent, skipped };
};

module.exports = {
  sendDailyJobOutreachDigest,
  guessRecipientEmail,
};
