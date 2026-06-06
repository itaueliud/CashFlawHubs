const Job = require('../models/Job');
const Delivery = require('../models/Delivery');
const JobApplication = require('../models/JobApplication');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Notification = require('../models/Notification');
const logger = require('../utils/logger');
const { sendgridClient } = require('../services/notificationService');
const { createNotification } = require('../services/notificationCenter');
const { processDeliveryMessage } = require('../services/applicationDelivery');
const { trackEvent } = require('../services/eventTracker');
const { notifyOwnerOfNewApplication, notifyApplicantOfStatusChange } = require('../services/jobNotificationService');
const fs = require('fs');

const MAX_COVER_LETTER_LENGTH = 3000;
const MIN_COVER_LETTER_LENGTH = 1;
const INTERNAL_JOB_SOURCE = 'internal';
const JOB_APPLICATION_STATUS = ['submitted', 'reviewed', 'shortlisted', 'redirected', 'applied', 'interviewing', 'offered', 'rejected', 'withdrawn'];
const PUBLIC_JOB_APPLICATION_STATUS = ['redirected', 'applied', 'withdrawn'];
const STATUS_ALIASES = {
  submitted: 'redirected',
  reviewed: 'interviewing',
  shortlisted: 'offered',
};
const STATUS_NOTIFY_SET = new Set(['applied', 'interviewing', 'offered', 'rejected']);
const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const STATUS_LABELS = {
  submitted: 'Submitted',
  reviewed: 'Reviewed',
  shortlisted: 'Shortlisted',
  redirected: 'Redirected',
  applied: 'Applied',
  interviewing: 'Interviewing',
  offered: 'Offered',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};
const STATUS_DESCRIPTIONS = {
  redirected: 'External application tracked. Responses and recruiter feedback go to the email you entered.',
  applied: 'Applied on CashFlawHubs. The owner can move this application into interviewing, offered, or rejected.',
  interviewing: 'The owner has started a conversation with this applicant.',
  offered: 'The application passed interview and an offer was issued.',
  rejected: 'The application was not successful.',
  withdrawn: 'The applicant cancelled this application.',
};
const isExternalJob = (job = {}) => String(job?.source || '').trim() !== INTERNAL_JOB_SOURCE;
const isValidEmail = (value) => EMAIL_REGEX.test(String(value || '').trim().toLowerCase());
const getApplicantStatusDescription = ({ status, jobSource, trackingEmail }) => {
  const normalized = normalizeApplicationStatus(status);
  if (normalized === 'redirected' && String(jobSource || '').trim() !== INTERNAL_JOB_SOURCE) {
    return trackingEmail
      ? `External application tracked. We’ll email feedback to ${trackingEmail}.`
      : 'External application tracked. Responses and recruiter feedback go to the email you entered.';
  }
  return STATUS_DESCRIPTIONS[normalized] || 'Application status updated.';
};
const APPLY_XP_REWARD = 25;
const CONFIRM_XP_REWARD = 50;
const OFFER_XP_BONUS = 75;
const getCanonicalFrontendUrl = () =>
  (process.env.CANONICAL_FRONTEND_URL || 'https://cashflowhubs.com').replace(/\/+$/, '');

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const formatRegistrationSummary = (user = {}) => {
  const items = [
    ['Full name', user.name || [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || 'N/A'],
    ['First name', user.firstName || 'N/A'],
    ['Last name', user.lastName || 'N/A'],
    ['Email', user.email || 'N/A'],
    ['Phone', user.phone || 'N/A'],
    ['Country', user.country || 'N/A'],
    ['User ID', user.userId || 'N/A'],
    ['Referral code', user.referralCode || 'N/A'],
    ['Language', user.userLanguage || 'N/A'],
    ['Timezone', user.timezone || 'N/A'],
    ['Registered at', user.registrationContext?.registeredAt ? new Date(user.registrationContext.registeredAt).toLocaleString() : 'N/A'],
  ];

  const registrationContext = user.registrationContext || {};
  if (registrationContext.ipAddress || registrationContext.userAgent || registrationContext.cfIpCountry) {
    items.push(['Registration IP', registrationContext.ipAddress || 'N/A']);
    items.push(['Browser', registrationContext.userAgent || 'N/A']);
    items.push(['Browser language', registrationContext.browserLanguage || 'N/A']);
    items.push(['CF country', registrationContext.cfIpCountry || 'N/A']);
  }

  return items.map(([label, value]) => `<tr><td style="padding:6px 10px;border:1px solid #e5e7eb;"><strong>${escapeHtml(label)}</strong></td><td style="padding:6px 10px;border:1px solid #e5e7eb;">${escapeHtml(value)}</td></tr>`).join('');
};

const buildApplicantSubmissionEmail = ({ user, job, application, recruiterForwarded }) => {
  const coverLetterHtml = escapeHtml(application.coverLetter || '').replace(/\n/g, '<br/>');
  const cvHtml = application.cvUrl
    ? `<p><strong>CV:</strong> <a href="${escapeHtml(application.cvUrl)}">${escapeHtml(application.cvOriginalName || application.cvFileName || 'Download CV')}</a></p>`
    : '<p><strong>CV:</strong> Not provided</p>';
  const recruiterStatus = recruiterForwarded
    ? 'Your application has been submitted and forwarded to the recruiter.'
    : 'Your application has been submitted and saved in our system. The recruiter may review it from the platform or linked contact details.';
  const submittedAt = application.appliedAt ? new Date(application.appliedAt).toLocaleString() : new Date().toLocaleString();
  const applicantName = user.firstName || user.name || 'there';

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;background:#f8fafc;padding:24px;">
      <div style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
        <div style="background:linear-gradient(135deg,#0f172a,#14532d);color:#ffffff;padding:24px 28px;">
          <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.78;">CashFlawHubs</div>
          <h2 style="margin:8px 0 0;font-size:28px;line-height:1.2;">Application submitted</h2>
          <p style="margin:8px 0 0;opacity:.9;">${escapeHtml(job.title)} at ${escapeHtml(job.company)}</p>
        </div>

        <div style="padding:28px;">
          <p style="margin-top:0;">Hello ${escapeHtml(applicantName)},</p>
          <p>${escapeHtml(recruiterStatus)}</p>

          <div style="display:flex;gap:12px;flex-wrap:wrap;margin:20px 0;">
            <div style="flex:1;min-width:220px;padding:16px;border:1px solid #e5e7eb;border-radius:14px;background:#f8fafc;">
              <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;">Application status</div>
              <div style="font-size:18px;font-weight:700;color:#166534;margin-top:4px;">Submitted</div>
              <div style="font-size:12px;color:#64748b;margin-top:6px;">Submitted ${escapeHtml(submittedAt)}</div>
            </div>
            <div style="flex:1;min-width:220px;padding:16px;border:1px solid #e5e7eb;border-radius:14px;background:#f8fafc;">
              <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;">Recruiter delivery</div>
              <div style="font-size:18px;font-weight:700;color:#0f172a;margin-top:4px;">${recruiterForwarded ? 'Forwarded' : 'Saved'}</div>
              <div style="font-size:12px;color:#64748b;margin-top:6px;">You can track it from your account</div>
            </div>
          </div>

          <h3 style="margin:24px 0 12px;font-size:18px;">Your application summary</h3>
          <div style="padding:16px;border:1px solid #e5e7eb;border-radius:14px;background:#ffffff;">
            <p style="margin:0 0 8px;"><strong>Job:</strong> ${escapeHtml(job.title)} at ${escapeHtml(job.company)}</p>
            <p style="margin:0 0 8px;"><strong>Cover letter:</strong></p>
            <div style="padding:12px;border:1px solid #e5e7eb;border-radius:10px;background:#f8fafc;">${coverLetterHtml || 'No cover letter provided.'}</div>
            <div style="margin-top:12px;">${cvHtml}</div>
          </div>

          <h3 style="margin:24px 0 12px;font-size:18px;">Registration summary</h3>
          <p style="margin-top:0;color:#64748b;">This is the profile information saved when you registered on CashFlawHubs.</p>
          <div style="overflow:auto;border:1px solid #e5e7eb;border-radius:14px;">
            <table style="border-collapse:collapse;width:100%;min-width:520px;">${formatRegistrationSummary(user)}</table>
          </div>

          <div style="margin-top:24px;padding:16px;border-radius:14px;background:#ecfdf5;border:1px solid #bbf7d0;color:#166534;">
            Check your dashboard for updates. If the recruiter replies, they may contact you directly using the details above.
          </div>
        </div>
      </div>
    </div>
  `;
};

const cleanupUploadedCv = async (file) => {
  if (!file?.path) return;
  try {
    await fs.promises.unlink(file.path);
  } catch (error) {
    logger.warn(`Failed to remove uploaded CV ${file.path}: ${error.message}`);
  }
};

const normalizeApplicationStatus = (status) => {
  const normalized = String(status || '').trim().toLowerCase();
  if (!normalized) return 'redirected';
  return STATUS_ALIASES[normalized] || normalized;
};

const isTrackableApplicationStatus = (status) =>
  PUBLIC_JOB_APPLICATION_STATUS.includes(normalizeApplicationStatus(status));

const getStatusTimestampField = (status) => {
  switch (normalizeApplicationStatus(status)) {
    case 'redirected':
      return 'redirectedAt';
    case 'applied':
      return 'appliedConfirmedAt';
    case 'interviewing':
      return 'interviewingAt';
    case 'offered':
      return 'offeredAt';
    case 'rejected':
      return 'rejectedAt';
    case 'withdrawn':
      return 'withdrawnAt';
    default:
      return null;
  }
};

const statusToLabel = (status) => STATUS_LABELS[normalizeApplicationStatus(status)] || 'Application update';

const getApplicantDisplayName = (applicant = {}) =>
  applicant.firstName || applicant.name || [applicant.firstName, applicant.lastName].filter(Boolean).join(' ').trim() || 'there';

const buildApplicationReminderMessage = ({ jobTitle, company, delayLabel }) =>
  `You started an application for ${jobTitle} at ${company}. CashFlawHubs has kept your progress safe. ${delayLabel} reminder: open your dashboard to confirm, update, or withdraw it.`;

const bumpUserXp = async (userId, xpDelta = 0) => {
  const delta = Math.max(Number(xpDelta) || 0, 0);
  if (!delta) return null;

  const updatedUser = await User.findOneAndUpdate(
    { _id: userId },
    {
      $inc: { xpPoints: delta },
    },
    { new: true }
  ).select('xpPoints level');

  if (!updatedUser) return null;

  try {
    updatedUser.checkLevelUp();
    await updatedUser.save();
  } catch (error) {
    logger.warn(`Failed to persist level-up after XP award: ${error.message}`);
  }

  return updatedUser;
};

const sendApplicationConfirmationEmail = async ({ applicant, job, application }) => {
  if (!applicant?.email) return false;

  const applicantName = getApplicantDisplayName(applicant);
  const submittedAt = application.appliedAt ? new Date(application.appliedAt).toLocaleString() : new Date().toLocaleString();

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;background:#f8fafc;padding:24px;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#0f172a,#14532d);color:#ffffff;padding:24px 28px;">
          <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.8;">CashFlawHubs</div>
          <h2 style="margin:8px 0 0;font-size:28px;line-height:1.2;">Application confirmed</h2>
          <p style="margin:8px 0 0;opacity:.9;">${escapeHtml(job.title)} at ${escapeHtml(job.company)}</p>
        </div>
        <div style="padding:28px;">
          <p style="margin-top:0;">Hello ${escapeHtml(applicantName)},</p>
          <p>Your application has been confirmed in CashFlawHubs and your dashboard is now the source of truth for tracking it.</p>
          <div style="display:flex;gap:12px;flex-wrap:wrap;margin:20px 0;">
            <div style="flex:1;min-width:220px;padding:16px;border:1px solid #e5e7eb;border-radius:14px;background:#f8fafc;">
              <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;">Status</div>
              <div style="font-size:18px;font-weight:700;color:#166534;margin-top:4px;">Applied</div>
              <div style="font-size:12px;color:#64748b;margin-top:6px;">Confirmed ${escapeHtml(submittedAt)}</div>
            </div>
            <div style="flex:1;min-width:220px;padding:16px;border:1px solid #e5e7eb;border-radius:14px;background:#f8fafc;">
              <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;">XP reward</div>
              <div style="font-size:18px;font-weight:700;color:#0f172a;margin-top:4px;">+${CONFIRM_XP_REWARD} XP</div>
              <div style="font-size:12px;color:#64748b;margin-top:6px;">Keep updating the status as you hear back.</div>
            </div>
          </div>
          <p style="margin-bottom:0;">Open your dashboard to follow the next steps, and keep an eye out for replies from the employer.</p>
        </div>
      </div>
    </div>
  `;

  try {
    await sendgridClient.sendEmail({
      to: applicant.email,
      subject: `Application confirmed for ${job.title}`,
      html,
    });
    return true;
  } catch (error) {
    logger.warn(`Application confirmation email failed: ${error.message}`);
    return false;
  }
};

const sendApplicationStartedEmail = async ({ applicant, job, application }) => {
  if (!applicant?.email) return false;

  const appliedAt = application.appliedAt ? new Date(application.appliedAt).toLocaleString() : new Date().toLocaleString();
  const sourceLabel = job.source || 'CashFlawHubs';
  const viewApplicationsUrl = `${getCanonicalFrontendUrl()}/dashboard/jobs/applications`;
  const applicationKind = application.applicationKind || 'internal';
  const trackingEmail = application.trackingEmail || applicant.email || 'your email';
  const headline = applicationKind === 'external' ? 'External application tracked' : 'You applied successfully';
  const bodyIntro = applicationKind === 'external'
    ? `We saved this external job application for ${job.title} and will use ${trackingEmail} for feedback from the employer.`
    : 'We tracked your application and saved it on CashFlawHubs so you can confirm it, update it, and keep your job search organized.';
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;background:#f8fafc;padding:24px;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#0f172a,#14532d);color:#ffffff;padding:24px 28px;">
          <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.8;">CashFlawHubs</div>
          <h2 style="margin:8px 0 0;font-size:28px;line-height:1.2;">${escapeHtml(headline)}</h2>
          <p style="margin:8px 0 0;opacity:.9;">${escapeHtml(job.title)} at ${escapeHtml(job.company)}</p>
        </div>
        <div style="padding:28px;">
          <p style="margin-top:0;">Hi ${escapeHtml(getApplicantDisplayName(applicant))},</p>
          <p>${escapeHtml(bodyIntro)}</p>
          <div style="display:flex;gap:12px;flex-wrap:wrap;margin:20px 0;">
            <div style="flex:1;min-width:220px;padding:16px;border:1px solid #e5e7eb;border-radius:14px;background:#f8fafc;">
              <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;">Role</div>
              <div style="font-size:18px;font-weight:700;color:#0f172a;margin-top:4px;">${escapeHtml(job.title)}</div>
            </div>
            <div style="flex:1;min-width:220px;padding:16px;border:1px solid #e5e7eb;border-radius:14px;background:#f8fafc;">
              <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;">Company</div>
              <div style="font-size:18px;font-weight:700;color:#0f172a;margin-top:4px;">${escapeHtml(job.company)}</div>
            </div>
          </div>
          <div style="padding:16px;border:1px solid #e5e7eb;border-radius:14px;background:#ecfdf5;color:#166534;margin-top:8px;">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;">Source</div>
            <div style="font-size:18px;font-weight:700;margin-top:4px;">${escapeHtml(sourceLabel)}</div>
            <div style="font-size:12px;margin-top:6px;">Applied ${escapeHtml(appliedAt)}</div>
          </div>
          <div style="margin-top:22px;padding:16px;border-radius:14px;background:#f8fafc;border:1px solid #e5e7eb;">
            <p style="margin:0 0 10px;"><strong>What's next:</strong></p>
            <ul style="margin:0;padding-left:18px;color:#334155;">
              <li>Return to CashFlawHubs and confirm once you finish.</li>
              <li>Update the status as you hear back from the employer.</li>
              <li>Track every application from your My Applications dashboard.</li>
            </ul>
          </div>
          <div style="margin-top:22px;">
            <a href="${viewApplicationsUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:12px;">View My Applications</a>
          </div>
          <p style="margin-top:20px;margin-bottom:0;color:#475569;">Good luck,<br/>The CashFlawHubs Team</p>
        </div>
      </div>
    </div>
  `;

  try {
    await sendgridClient.sendEmail({
      to: applicant.email,
      subject: applicationKind === 'external'
        ? `External application tracked: ${job.title} at ${job.company}`
        : `✅ You applied to ${job.title} at ${job.company} via CashFlawHubs`,
      html,
    });
    return true;
  } catch (error) {
    logger.warn(`Application started email failed: ${error.message}`);
    return false;
  }
};

const sendApplicationReminderEmail = async ({ applicant, job, application, delayHours }) => {
  if (!applicant?.email) return false;

  const viewApplicationsUrl = `${getCanonicalFrontendUrl()}/dashboard/jobs/applications`;
  const is24h = Number(delayHours) === 24;
  const subject = is24h
    ? '⏰ Did you finish your application? — CashFlawHubs'
    : `📬 Any news from ${job.company}? Update your tracker`;
  const title = is24h ? 'Did you finish your application?' : `Any updates from ${job.company}?`;
  const body = is24h
    ? `You started an application yesterday for ${job.title} at ${job.company}. Did you complete it?`
    : `It's been 7 days since you applied to ${job.title} at ${job.company}. Update your application tracker so your board stays current.`;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;background:#f8fafc;padding:24px;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#0f172a,#14532d);color:#ffffff;padding:24px 28px;">
          <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.8;">CashFlawHubs</div>
          <h2 style="margin:8px 0 0;font-size:28px;line-height:1.2;">${escapeHtml(title)}</h2>
          <p style="margin:8px 0 0;opacity:.9;">${escapeHtml(job.title)} at ${escapeHtml(job.company)}</p>
        </div>
        <div style="padding:28px;">
          <p style="margin-top:0;">Hi ${escapeHtml(getApplicantDisplayName(applicant))},</p>
          <p>${escapeHtml(body)}</p>
          <div style="padding:16px;border:1px solid #e5e7eb;border-radius:14px;background:#f8fafc;">
            <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;">Application status</div>
            <div style="font-size:18px;font-weight:700;color:#0f172a;margin-top:4px;">${escapeHtml(statusToLabel(application.status))}</div>
            <div style="font-size:12px;color:#64748b;margin-top:6px;">Open your dashboard to keep it current.</div>
          </div>
          <div style="margin-top:22px;">
            <a href="${viewApplicationsUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:12px;">Update Status</a>
          </div>
        </div>
      </div>
    </div>
  `;

  try {
    await sendgridClient.sendEmail({
      to: applicant.email,
      subject,
      html,
    });
    return true;
  } catch (error) {
    logger.warn(`Application reminder email failed: ${error.message}`);
    return false;
  }
};

const createApplicationNotification = async ({ userId, type, title, message, dedupeKey, metadata = {} }) =>
  createNotification({
    userId,
    type,
    title,
    message,
    dedupeKey,
    metadata,
    channel: 'in_app',
  });

const buildTrackedApplicationResponse = (application) => ({
  _id: application._id,
  status: normalizeApplicationStatus(application.status),
  appliedAt: application.appliedAt,
  createdAt: application.createdAt,
  updatedAt: application.updatedAt,
  tokenCost: application.tokenCost || 0,
  applicantEmailSent: Boolean(application.applicantEmailSent),
  reminder24At: application.reminder24At,
  reminder7At: application.reminder7At,
});

exports.getJobApplicationsForManagement = async (req, res) => {
  try {
    const { id: jobId } = req.params;
    const pageNumber = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip = (pageNumber - 1) * pageSize;
    const status = String(req.query.status || '').trim().toLowerCase();
    const search = String(req.query.search || '').trim();

    const job = await Job.findById(jobId).select('_id postedBy title company');
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const canManage =
      ['admin', 'superadmin'].includes(String(req.user.role || '')) ||
      (job.postedBy && String(job.postedBy) === String(req.user.id));

    if (!canManage) {
      return res.status(403).json({ success: false, message: 'You are not allowed to view applications for this job' });
    }

    const query = { jobId: job._id };
    if (status) {
      const normalizedStatus = normalizeApplicationStatus(status);
      if (!JOB_APPLICATION_STATUS.includes(normalizedStatus)) {
        return res.status(400).json({ success: false, message: 'Invalid application status filter' });
      }
      query.status = normalizedStatus;
    }

    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const matchedUsers = await User.find({
        $or: [
          { name: searchRegex },
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { userId: searchRegex },
          { phone: searchRegex },
        ],
      })
        .select('_id')
        .lean();

      const matchedUserIds = matchedUsers.map((user) => user._id);
      if (matchedUserIds.length === 0) {
        return res.json({
          success: true,
          job: {
            _id: job._id,
            title: job.title,
            company: job.company,
          },
          applications: [],
          pagination: {
            total: 0,
            page: pageNumber,
            pages: 0,
          },
        });
      }

      query.userId = { $in: matchedUserIds };
    }

    const [applications, total] = await Promise.all([
      JobApplication.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .populate({
          path: 'userId',
          select: 'firstName lastName name email phone userId',
        })
        .select('status appliedAt createdAt updatedAt tokenCost coverLetter userId cvOriginalName cvFileName cvMimeType cvUrl applicantEmailSent reminder24At reminder7At'),
      JobApplication.countDocuments(query),
    ]);

    const applicationIds = applications.map((application) => application._id);
    const deliveries = applicationIds.length
      ? await Delivery.find({ jobApplicationId: { $in: applicationIds } })
          .sort({ createdAt: -1 })
          .select('jobApplicationId status deliveryType createdAt updatedAt')
          .lean()
      : [];

    const deliveryStatusByApplicationId = new Map();
    deliveries.forEach((delivery) => {
      const key = String(delivery.jobApplicationId);
      if (!deliveryStatusByApplicationId.has(key)) {
        deliveryStatusByApplicationId.set(key, delivery.status);
      }
    });

    const normalized = applications.map((application) => {
      const applicant = application.userId || {};
      return {
        _id: application._id,
        status: normalizeApplicationStatus(application.status),
        statusLabel: statusToLabel(application.status),
        coverLetter: application.coverLetter || '',
        cv: application.cvUrl ? {
          originalName: application.cvOriginalName,
          fileName: application.cvFileName,
          mimeType: application.cvMimeType,
          url: application.cvUrl,
        } : null,
        tokenCost: application.tokenCost || 0,
        appliedAt: application.appliedAt,
        createdAt: application.createdAt,
        updatedAt: application.updatedAt,
        reminder24At: application.reminder24At,
        reminder7At: application.reminder7At,
        employerDeliveryStatus: deliveryStatusByApplicationId.get(String(application._id)) || null,
        applicantEmailSent: Boolean(application.applicantEmailSent),
        applicant: {
          id: applicant._id,
          userId: applicant.userId,
          firstName: applicant.firstName,
          lastName: applicant.lastName,
          name: applicant.name,
          email: applicant.email,
          phone: applicant.phone,
        },
      };
    });

    return res.json({
      success: true,
      job: {
        _id: job._id,
        title: job.title,
        company: job.company,
      },
      applications: normalized,
      pagination: {
        total,
        page: pageNumber,
        pages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    logger.error(`getJobApplicationsForManagement error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const notifyJobApplicationStatusChange = async ({ applicant, status, jobTitle, company }) => {
  if (!applicant) return;
  const normalizedStatus = normalizeApplicationStatus(status);
  if (!STATUS_NOTIFY_SET.has(normalizedStatus)) return;

  try {
    await notifyApplicantOfStatusChange(
      { _id: applicant._id, userId: applicant.userId, email: applicant.email, name: applicant.name, firstName: applicant.firstName, lastName: applicant.lastName },
      normalizedStatus,
      jobTitle,
      company,
      sendgridClient,
      Notification
    );
  } catch (error) {
    logger.warn(`Job application notification failed: ${error.message}`);
  }
};

exports.getMyJobApplications = async (req, res) => {
  try {
    const pageNumber = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip = (pageNumber - 1) * pageSize;

    const [applications, total] = await Promise.all([
      JobApplication.find({ userId: req.user.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .populate({
          path: 'jobId',
          select: 'title company location category source isActive expiresAt publishedAt applicationUrl',
        })
        .select('status appliedAt createdAt updatedAt tokenCost coverLetter cvOriginalName cvFileName cvMimeType cvUrl applicantEmailSent reminder24At reminder7At trackingEmail')
        .lean(),
      JobApplication.countDocuments({ userId: req.user.id }),
    ]);

    const now = Date.now();
    const normalized = applications.map((application) => {
      const job = application.jobId;
      const jobAvailable = Boolean(
        job &&
        job.isActive &&
        (!job.expiresAt || new Date(job.expiresAt).getTime() > now)
      );

      return {
        _id: application._id,
        status: normalizeApplicationStatus(application.status),
        statusLabel: statusToLabel(application.status),
        statusDescription: getApplicantStatusDescription({
          status: application.status,
          jobSource: job?.source,
          trackingEmail: application.trackingEmail,
        }),
        coverLetter: application.coverLetter,
        cv: application.cvUrl ? {
          originalName: application.cvOriginalName,
          fileName: application.cvFileName,
          mimeType: application.cvMimeType,
          url: application.cvUrl,
        } : null,
        tokenCost: application.tokenCost || 0,
        applicantEmailSent: Boolean(application.applicantEmailSent),
        trackingEmail: application.trackingEmail || null,
        appliedAt: application.appliedAt,
        createdAt: application.createdAt,
        updatedAt: application.updatedAt,
        reminder24At: application.reminder24At,
        reminder7At: application.reminder7At,
        job: job
          ? {
              _id: job._id,
              title: job.title,
              company: job.company,
              location: job.location,
              category: job.category,
              source: job.source,
              publishedAt: job.publishedAt,
              expiresAt: job.expiresAt,
              applicationUrl: job.applicationUrl,
            }
          : null,
        jobAvailable,
      };
    });

    return res.json({
      success: true,
      applications: normalized,
      pagination: {
        total,
        page: pageNumber,
        pages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    logger.error(`getMyJobApplications error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.applyToJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job || !job.isActive) {
      await cleanupUploadedCv(req.file);
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (job.expiresAt && job.expiresAt <= new Date()) {
      await cleanupUploadedCv(req.file);
      return res.status(410).json({ success: false, message: 'This job is no longer accepting applications' });
    }

    if (job.postedBy && String(job.postedBy) === String(req.user.id)) {
      await cleanupUploadedCv(req.file);
      return res.status(400).json({ success: false, message: 'You cannot apply to your own job posting' });
    }

    const coverLetter = typeof req.body?.coverLetter === 'string' ? req.body.coverLetter.trim() : '';
    const trackingEmail = typeof req.body?.trackingEmail === 'string' ? req.body.trackingEmail.trim().toLowerCase() : '';
    const externalJob = isExternalJob(job);
    const cvFile = req.file || null;

    if (externalJob && !isValidEmail(trackingEmail)) {
      await cleanupUploadedCv(cvFile);
      return res.status(400).json({ success: false, message: 'A valid email address is required to track external applications' });
    }

    if (!externalJob && coverLetter.length < MIN_COVER_LETTER_LENGTH) {
      await cleanupUploadedCv(cvFile);
      return res.status(400).json({ success: false, message: `Cover letter is required and must be at least ${MIN_COVER_LETTER_LENGTH} characters` });
    }

    if (coverLetter.length > MAX_COVER_LETTER_LENGTH) {
      await cleanupUploadedCv(cvFile);
      return res.status(400).json({ success: false, message: `Cover letter is too long (max ${MAX_COVER_LETTER_LENGTH} characters)` });
    }

    const existingApplication = await JobApplication.findOne({ jobId: job._id, userId: req.user.id });
    if (existingApplication) {
      await cleanupUploadedCv(req.file);
      return res.status(409).json({ success: false, message: 'You already applied to this job' });
    }

    const tokenCost = Math.max(Number(job.applicationTokenCost || 0), 0);

    const application = await JobApplication.create({
      jobId: job._id,
      userId: req.user.id,
      coverLetter,
      applicationKind: externalJob ? 'external' : 'internal',
      trackingEmail: externalJob ? trackingEmail : null,
      cvOriginalName: cvFile?.originalname || null,
      cvFileName: cvFile?.filename || null,
      cvMimeType: cvFile?.mimetype || null,
      cvPath: cvFile?.path || null,
      cvUrl: cvFile ? `/uploads/job-applications/${cvFile.filename}` : null,
      tokenCost,
      status: externalJob ? 'redirected' : 'applied',
      redirectedAt: externalJob ? new Date() : null,
      appliedConfirmedAt: externalJob ? null : new Date(),
      reminder24At: new Date(Date.now() + 24 * 60 * 60 * 1000),
      reminder7At: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const applicantProfile = await User.findById(req.user.id).select('firstName lastName name email phone country userId referralCode userLanguage timezone registrationContext');
    let recruiterForwarded = false;
    let recruiterEmail = null;

    try {
      const populatedJob = await Job.findById(job._id).populate('postedBy', 'name firstName lastName email userId');
      await notifyOwnerOfNewApplication(populatedJob || job, applicantProfile, coverLetter, sendgridClient, Notification);
    } catch (error) {
      logger.warn(`Failed to notify owner about new application: ${error.message}`);
    }

        // If the job has webhook delivery configured, enqueue a delivery record
        try {
          if (job.applicationDelivery === 'webhook' && job.employerWebhookUrl) {
            const Delivery = require('../models/Delivery');
            const { publishToQueue, QUEUES } = require('../services/queueWorker');

            const applicantPayload = {
              applicationId: application._id.toString(),
              jobId: job._id.toString(),
              jobTitle: job.title,
              company: job.company,
              applicant: {
                id: req.user.id,
                userId: req.user.userId,
                name: req.user.name || `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
                email: req.user.email || null,
                phone: req.user.phone || null,
              },
              coverLetter: coverLetter || null,
              appliedAt: application.appliedAt || new Date(),
            };

            const delivery = await Delivery.create({
              jobApplicationId: application._id,
              jobId: job._id,
              webhookUrl: job.employerWebhookUrl,
              payload: applicantPayload,
              attempts: 0,
              status: 'pending',
              nextAttemptAt: new Date(),
            });

            // publish to queue
            publishToQueue(QUEUES.JOB_APPLICATION_DELIVERY, { deliveryId: delivery._id.toString() });
            recruiterForwarded = true;
            recruiterEmail = job.employerWebhookUrl;
          }
        } catch (err) {
          // do not fail the application if delivery setup has issues
          logger.error(`Failed to enqueue application delivery: ${err.message}`);
        }

    let tokenBalance = req.user.tokenBalance;
    if (tokenCost > 0) {
      const applicant = await User.findOneAndUpdate(
        { _id: req.user.id, tokenBalance: { $gte: tokenCost } },
        { $inc: { tokenBalance: -tokenCost, totalTokensSpent: tokenCost } },
        { new: true }
      );

      if (!applicant) {
        await JobApplication.deleteOne({ _id: application._id });
        await cleanupUploadedCv(cvFile);
        return res.status(400).json({
          success: false,
          message: `Applying for this job requires ${tokenCost} tokens`,
        });
      }

      tokenBalance = applicant.tokenBalance;

      await Transaction.create({
        userId: applicant._id,
        type: 'token_spend',
        amountLocal: tokenCost,
        amountUSD: 0,
        currency: 'TOKEN',
        country: applicant.country,
        provider: 'internal',
        direction: 'debit',
        status: 'successful',
        processedAt: new Date(),
        metadata: {
          action: 'job_application',
          tokenAmount: tokenCost,
          jobId: job._id.toString(),
          jobTitle: job.title,
        },
      });
    }

    // Attempt to forward application to external job owner if contact email is available
    try {
      const jobRef = await Job.findById(job._id).select('applicationUrl title company description applicationContactEmail applicationContactSource');
      if (jobRef) {
        // Prefer the stored contact email discovered during sync, then fall back to local discovery.
        let ownerEmail = String(jobRef.applicationContactEmail || '').trim() || null;
        const appUrl = String(jobRef.applicationUrl || '').trim();
        if (!ownerEmail) {
          const mailtoMatch = appUrl.match(/^mailto:([^?]+)/i);
          if (mailtoMatch) {
            ownerEmail = decodeURIComponent(mailtoMatch[1] || '').trim();
          }
        }

        if (!ownerEmail) {
          const hay = `${String(jobRef.description || '')} ${String(jobRef.company || '')} ${appUrl}`;
          const emailMatch = hay.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
          if (emailMatch) ownerEmail = String(emailMatch[0]).trim();
        }

        if (ownerEmail) {
          const subject = `New application for ${jobRef.title} at ${jobRef.company}`;
          const safeCover = coverLetter ? String(coverLetter).replace(/\n/g, '<br/>') : 'No cover letter provided.';
          const cvSection = application.cvUrl
            ? `<p><strong>CV:</strong> <a href="${application.cvUrl}">${application.cvOriginalName || application.cvFileName || 'Download CV'}</a></p>`
            : '<p><strong>CV:</strong> Not provided</p>';
          const deliveryPayload = {
            subject,
            jobTitle: jobRef.title,
            company: jobRef.company,
            applicationUrl: jobRef.applicationUrl,
            coverLetter: coverLetter || null,
            applicant: {
              id: req.user.id,
              userId: req.user.userId,
              name: applicantProfile?.name || [applicantProfile?.firstName, applicantProfile?.lastName].filter(Boolean).join(' ').trim() || applicantProfile?.email || 'Applicant',
              email: applicantProfile?.email || null,
              phone: applicantProfile?.phone || null,
            },
          };

          const delivery = await Delivery.create({
            jobApplicationId: application._id,
            jobId: jobRef._id,
            deliveryType: 'email',
            emailAddress: ownerEmail,
            payload: deliveryPayload,
            attempts: 0,
            status: 'pending',
            nextAttemptAt: new Date(),
          });

          const delivered = await processDeliveryMessage({ deliveryId: delivery._id.toString() });
          const html = `
            <p>Hello,</p>
            <p>You have received a new application for <strong>${jobRef.title}</strong> at <strong>${jobRef.company}</strong>.</p>
            <p><strong>Applicant:</strong> ${escapeHtml(applicantProfile?.name || [applicantProfile?.firstName, applicantProfile?.lastName].filter(Boolean).join(' ').trim() || applicantProfile?.email || 'Applicant')}</p>
            <p><strong>Email:</strong> ${escapeHtml(applicantProfile?.email || 'N/A')}</p>
            <p><strong>Phone:</strong> ${escapeHtml(applicantProfile?.phone || 'N/A')}</p>
            <p><strong>Cover Letter:</strong></p>
            <p>${safeCover}</p>
            ${cvSection}
            <p>Original job listing: <a href="${jobRef.applicationUrl}">${jobRef.applicationUrl}</a></p>
            <p>To reply directly to the applicant, reply to this email.</p>
          `;
          if (delivered) {
            recruiterForwarded = true;
            recruiterEmail = ownerEmail;
            logger.info(`Forwarded application ${application._id} to owner ${ownerEmail}`);
          } else {
            logger.warn(`Failed to forward application ${application._id} to owner ${ownerEmail}`);
          }
        }
      }
    } catch (err) {
      logger.warn(`Owner forward attempt failed: ${err.message}`);
    }

    const xpAwarded = APPLY_XP_REWARD;
    const updatedUser = await bumpUserXp(req.user.id, xpAwarded);
    const emailSent = await sendApplicationStartedEmail({ applicant: applicantProfile, job, application });

    try {
      await JobApplication.findByIdAndUpdate(application._id, {
        applicantEmailSent: false,
      }).exec();
    } catch (err) {
      logger.warn(`Failed to persist applicantEmailSent for ${application._id}: ${err.message}`);
    }

    try {
      await createApplicationNotification({
        userId: req.user.id,
        type: 'job_application',
        title: externalJob ? 'External application tracked' : 'Application submitted',
        message: externalJob
          ? `We saved your external application for "${job.title}" at ${job.company}. Feedback will go to ${trackingEmail}.`
          : `You applied to "${job.title}" at ${job.company} on CashFlawHubs.`,
        dedupeKey: `job-application:${application._id}:${externalJob ? 'redirected' : 'applied'}`,
        metadata: {
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          status: externalJob ? 'redirected' : 'applied',
          applicationUrl: job.applicationUrl || null,
          trackingEmail: externalJob ? trackingEmail : null,
        },
      });
    } catch (error) {
      logger.warn(`Failed to create application notification: ${error.message}`);
    }

    await trackEvent(req.user.id, 'job_apply');

    res.status(201).json({
      success: true,
      message: externalJob
        ? tokenCost > 0
          ? `External application tracked successfully using ${tokenCost} tokens`
          : 'External application tracked successfully'
        : tokenCost > 0
          ? `Application started successfully using ${tokenCost} tokens`
          : 'Application started successfully',
      tokenCost,
      tokenBalance,
      xpEarned: xpAwarded,
      xpPoints: updatedUser?.xpPoints ?? req.user.xpPoints ?? null,
      emailSent,
      redirectUrl: externalJob ? job.applicationUrl || null : null,
      application: {
        ...application.toObject(),
        status: externalJob ? 'redirected' : 'applied',
        redirectedAt: application.redirectedAt,
        appliedConfirmedAt: application.appliedConfirmedAt,
        reminder24At: application.reminder24At,
        reminder7At: application.reminder7At,
      },
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: 'You already applied to this job' });
    }
    if (req.file) {
      await cleanupUploadedCv(req.file);
    }
    logger.error(`applyToJob error: ${error.message}`);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

const persistApplicationStatusUpdate = async ({ application, job, nextStatus, triggerEmailConfirmation = false }) => {
  const normalizedNextStatus = normalizeApplicationStatus(nextStatus);
  if (!JOB_APPLICATION_STATUS.includes(normalizedNextStatus)) {
    const error = new Error('Invalid application status');
    error.status = 400;
    throw error;
  }

  const previousStatus = normalizeApplicationStatus(application.status);
  if (previousStatus === normalizedNextStatus) {
    return {
      application,
      message: 'Status unchanged',
      xpEarned: 0,
      emailSent: false,
    };
  }

  application.status = normalizedNextStatus;

  const timestampField = getStatusTimestampField(normalizedNextStatus);
  if (timestampField && !application[timestampField]) {
    application[timestampField] = new Date();
  }

  if (normalizedNextStatus === 'applied') {
    application.applicantEmailSent = false;
  }

  await application.save();

  const applicant = await User.findById(application.userId).select('firstName lastName name email phone');
  let xpEarned = 0;
  let emailSent = false;

  if (normalizedNextStatus === 'applied' && previousStatus === 'redirected') {
    xpEarned = CONFIRM_XP_REWARD;
    const updatedUser = await bumpUserXp(application.userId, xpEarned);
    emailSent = await sendApplicationConfirmationEmail({ applicant, job, application });
    if (emailSent) {
      await JobApplication.findByIdAndUpdate(application._id, { applicantEmailSent: true }).exec();
    }
    await createApplicationNotification({
      userId: application.userId,
      type: 'job_status',
      title: 'Application confirmed',
      message: `Your application for ${job.title} at ${job.company} is confirmed. Keep tracking the employer response from your dashboard.`,
      dedupeKey: `job-application-status:${application._id}:applied`,
      metadata: {
        jobTitle: job.title,
        company: job.company,
        status: normalizedNextStatus,
        applicationId: application._id.toString(),
      },
    });
    return {
      application: await JobApplication.findById(application._id).lean(),
      message: `Application confirmed! +${CONFIRM_XP_REWARD} XP earned`,
      xpEarned,
      xpPoints: updatedUser?.xpPoints ?? null,
      emailSent,
    };
  }

  if (normalizedNextStatus === 'offered') {
    xpEarned = OFFER_XP_BONUS;
    const updatedUser = await bumpUserXp(application.userId, xpEarned);
    await createApplicationNotification({
      userId: application.userId,
      type: 'job_status',
      title: 'Application offered',
      message: `Great news, your application for ${job.title} at ${job.company} has been marked offered. You earned ${OFFER_XP_BONUS} XP.`,
      dedupeKey: `job-application-status:${application._id}:offered`,
      metadata: {
        jobTitle: job.title,
        company: job.company,
        status: normalizedNextStatus,
        applicationId: application._id.toString(),
      },
    });
    return {
      application: await JobApplication.findById(application._id).lean(),
      message: `Application marked offered! +${OFFER_XP_BONUS} XP earned`,
      xpEarned,
      xpPoints: updatedUser?.xpPoints ?? null,
      emailSent: false,
    };
  }

  if (STATUS_NOTIFY_SET.has(normalizedNextStatus)) {
    await notifyJobApplicationStatusChange({
      applicant,
      status: normalizedNextStatus,
      jobTitle: job.title,
      company: job.company,
    });
  }

  return {
    application: await JobApplication.findById(application._id).lean(),
    message: `Application status updated from ${previousStatus} to ${normalizedNextStatus}`,
    xpEarned,
    emailSent,
  };
};

exports.updateJobApplicationStatus = async (req, res) => {
  try {
    const { id: jobId, applicationId } = req.params;
    const nextStatus = req.body?.status;

    const [job, application] = await Promise.all([
      Job.findById(jobId).select('_id postedBy title company'),
      JobApplication.findById(applicationId),
    ]);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (!application || String(application.jobId) !== String(job._id)) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const canManage =
      ['admin', 'superadmin'].includes(String(req.user.role || '')) ||
      (job.postedBy && String(job.postedBy) === String(req.user.id));

    if (!canManage) {
      return res.status(403).json({ success: false, message: 'You are not allowed to update this application' });
    }

    const result = await persistApplicationStatusUpdate({
      application,
      job,
      nextStatus,
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error(`updateJobApplicationStatus error: ${error.message}`);
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

exports.updateMyJobApplicationStatus = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const nextStatus = req.body?.status;
    const normalizedNextStatus = normalizeApplicationStatus(nextStatus);

    if (!PUBLIC_JOB_APPLICATION_STATUS.includes(normalizedNextStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid application status' });
    }

    const application = await JobApplication.findOne({
      _id: applicationId,
      userId: req.user.id,
    });

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const job = await Job.findById(application.jobId).select('_id title company applicationUrl');
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const currentStatus = normalizeApplicationStatus(application.status);
    if (normalizedNextStatus !== 'withdrawn') {
      return res.status(403).json({ success: false, message: 'Applicants can only withdraw their own applications' });
    }

    if (!['redirected', 'applied'].includes(currentStatus)) {
      return res.status(400).json({ success: false, message: 'This application can no longer be withdrawn from the tracker' });
    }

    const result = await persistApplicationStatusUpdate({
      application,
      job,
      nextStatus: normalizedNextStatus,
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error(`updateMyJobApplicationStatus error: ${error.message}`);
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

exports.processJobApplicationReminders = async () => {
  const now = new Date();
  const dueApplications = await JobApplication.find({
    $or: [
      { reminder24At: { $ne: null, $lte: now }, reminder24SentAt: null },
      { reminder7At: { $ne: null, $lte: now }, reminder7SentAt: null },
    ],
  })
    .populate({ path: 'userId', select: 'firstName lastName name email phone' })
    .populate({ path: 'jobId', select: 'title company applicationUrl' });

  for (const application of dueApplications) {
    const job = application.jobId;
    const applicant = application.userId;
    if (!job || !applicant) continue;

    const normalizedStatus = normalizeApplicationStatus(application.status);
    if (!['redirected', 'applied'].includes(normalizedStatus)) {
      continue;
    }

    if (normalizedStatus === 'redirected' && application.reminder24At && !application.reminder24SentAt && application.reminder24At <= now) {
      await createApplicationNotification({
        userId: applicant._id,
        type: 'job_reminder',
        title: 'Did you finish your application?',
        message: `You started applying to "${job.title}" at ${job.company} yesterday. Mark it as done to keep your tracker accurate.`,
        dedupeKey: `job-application-reminder:${application._id}:24h`,
        metadata: {
          applicationId: application._id.toString(),
          jobId: job._id.toString(),
          delayHours: 24,
          status: normalizedStatus,
        },
      });
      await sendApplicationReminderEmail({
        applicant,
        job,
        application,
        delayHours: 24,
      });
      application.reminder24SentAt = new Date();
    }

    if (['redirected', 'applied'].includes(normalizedStatus) && application.reminder7At && !application.reminder7SentAt && application.reminder7At <= now) {
      await createApplicationNotification({
        userId: applicant._id,
        type: 'job_reminder',
        title: `Any updates from ${job.company}?`,
        message: `It's been a week since you applied to "${job.title}" at ${job.company}. Update your tracker so your board stays current.`,
        dedupeKey: `job-application-reminder:${application._id}:7d`,
        metadata: {
          applicationId: application._id.toString(),
          jobId: job._id.toString(),
          delayDays: 7,
          status: normalizedStatus,
        },
      });
      await sendApplicationReminderEmail({
        applicant,
        job,
        application,
        delayHours: 7 * 24,
      });
      application.reminder7SentAt = new Date();
    }

    await application.save();
  }

  return { checked: dueApplications.length };
};

exports.getJobApplicants = async (req, res) => {
  try {
    const jobId = req.params.id;
    const job = await Job.findById(jobId).select('_id postedBy title company');
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

    const canManage =
      ['admin', 'superadmin'].includes(String(req.user.role || '')) ||
      (job.postedBy && String(job.postedBy) === String(req.user.id));

    if (!canManage) return res.status(403).json({ success: false, message: 'Not allowed' });

    const pageNumber = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip = (pageNumber - 1) * pageSize;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const status = typeof req.query.status === 'string' && req.query.status ? req.query.status : null;

    const baseQuery = { jobId: job._id };
    if (status) baseQuery.status = status;

    const [applications, totalRaw] = await Promise.all([
      JobApplication.find(baseQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .populate({ path: 'userId', select: 'firstName lastName name email phone userId' })
        .lean(),
      JobApplication.countDocuments(baseQuery),
    ]);

    let normalized = applications.map((application) => {
      const applicant = application.userId || {};
      const fullName = [applicant.firstName, applicant.lastName].filter(Boolean).join(' ').trim();
      return {
        _id: application._id,
        status: application.status,
        appliedAt: application.appliedAt,
        createdAt: application.createdAt,
        updatedAt: application.updatedAt,
        tokenCost: application.tokenCost || 0,
        coverLetter: application.coverLetter || '',
        applicant: {
          id: applicant._id,
          userId: applicant.userId,
          firstName: applicant.firstName,
          lastName: applicant.lastName,
          name: applicant.name || fullName,
          email: applicant.email,
          phone: applicant.phone,
        },
      };
    });

    if (q) {
      const qLower = q.toLowerCase();
      normalized = normalized.filter((a) => {
        const name = (a.applicant?.name || '').toLowerCase();
        const email = (a.applicant?.email || '').toLowerCase();
        return name.includes(qLower) || email.includes(qLower) || String(a._id).includes(qLower);
      });
    }

    const total = normalized.length < pageSize ? normalized.length + skip : totalRaw;

    return res.json({
      success: true,
      job: { _id: job._id, title: job.title, company: job.company },
      applications: normalized,
      pagination: { total, page: pageNumber, pages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    logger.error(`getJobApplicants error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};
