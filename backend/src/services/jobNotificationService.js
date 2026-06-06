const Notification = require('../models/Notification');

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getDisplayName = (person = {}) =>
  person.name ||
  [person.firstName, person.lastName].filter(Boolean).join(' ').trim() ||
  person.email ||
  'Applicant';

const getMailer = (sendEmail) => {
  if (!sendEmail) return null;
  if (typeof sendEmail === 'function') return sendEmail;
  if (typeof sendEmail.sendEmail === 'function') return sendEmail.sendEmail.bind(sendEmail);
  return null;
};

const getAppUrl = () =>
  (process.env.CANONICAL_FRONTEND_URL || process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

const getOwner = (job = {}) => {
  const owner = job.postedBy || null;
  if (!owner) return { ownerId: null, ownerEmail: null, ownerName: null };

  return {
    ownerId: owner._id || owner,
    ownerEmail: owner.email || owner.emailAddress || null,
    ownerName: getDisplayName(owner),
  };
};

async function notifyOwnerOfNewApplication(job, applicant, coverLetter, sendEmail, NotificationModel = Notification) {
  if (!job) return null;

  const { ownerId, ownerEmail, ownerName } = getOwner(job);
  const mailer = getMailer(sendEmail);
  const applicantName = getDisplayName(applicant);
  const applicantsUrl = `${getAppUrl()}/dashboard/jobs/${job._id}/applicants`;

  if (ownerEmail && mailer) {
    await mailer({
      to: ownerEmail,
      subject: `New application for ${job.title}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;">
          <h2>New Application Received</h2>
          <p><strong>Job:</strong> ${escapeHtml(job.title)}</p>
          <p><strong>Applicant:</strong> ${escapeHtml(applicantName)}</p>
          <p><strong>Owner:</strong> ${escapeHtml(ownerName || 'N/A')}</p>
          <p><strong>Email:</strong> ${escapeHtml(applicant?.email || 'N/A')}</p>
          <p><strong>Cover Letter:</strong></p>
          <div style="padding:12px;border:1px solid #e5e7eb;border-radius:10px;background:#f8fafc;">${escapeHtml(coverLetter || 'No cover letter provided').replace(/\n/g, '<br/>')}</div>
          <p style="margin-top:16px;"><a href="${applicantsUrl}">View applicants</a></p>
        </div>
      `,
    });
  }

  if (NotificationModel && ownerId) {
    await NotificationModel.create({
      userId: ownerId,
      type: 'new_application',
      title: 'New job application',
      message: `${applicantName} applied for "${job.title}"`,
      channel: 'in_app',
      metadata: {
        jobId: job._id?.toString?.() || String(job._id || ''),
        applicationUrl: applicantsUrl,
        applicantName,
        applicantEmail: applicant?.email || null,
      },
      dedupeKey: `new-application:${job._id}:${applicant?.email || applicantName}`,
    });
  }

  return true;
}

async function notifyApplicantOfStatusChange(application, newStatus, jobTitle, company, sendEmail, NotificationModel = Notification) {
  if (!application) return null;

  const normalizedStatus = String(newStatus || '').trim().toLowerCase();
  const applicant = application.userId && typeof application.userId === 'object' ? application.userId : application;
  const applicantName = getDisplayName(applicant);
  const safeJobTitle = jobTitle || 'the role';
  const safeCompany = company || 'the company';
  const mailer = getMailer(sendEmail);

  const messages = {
    interviewing: `You've been moved to interviewing for ${safeJobTitle} at ${safeCompany}.`,
    offered: `Great news ${applicantName}, your application for ${safeJobTitle} at ${safeCompany} was marked as offered.`,
    rejected: `Your application for ${safeJobTitle} at ${safeCompany} was marked rejected.`,
    applied: `Your application for ${safeJobTitle} at ${safeCompany} is confirmed and saved in CashFlawHubs.`,
  };

  const body = messages[normalizedStatus] || `Your application for ${safeJobTitle} at ${safeCompany} has been updated to ${normalizedStatus}.`;
  const title =
    normalizedStatus === 'applied'
      ? 'Application confirmed'
      : `Application ${normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1)}`;

  if (applicant?.email && mailer) {
    await mailer({
      to: applicant.email,
      subject: `Application Update: ${safeJobTitle}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;">
          <h2>Application Update</h2>
          <p>${escapeHtml(body)}</p>
        </div>
      `,
    });
  }

  if (NotificationModel && applicant?._id) {
    await NotificationModel.create({
      userId: applicant._id,
      type: 'job_status',
      title,
      message: body,
      channel: 'in_app',
      metadata: {
        jobTitle: safeJobTitle,
        company: safeCompany,
        status: normalizedStatus,
        applicationId: application._id?.toString?.() || String(application._id || ''),
      },
      dedupeKey: `job-status:${application._id}:${normalizedStatus}`,
    });
  }

  return true;
}

module.exports = {
  notifyOwnerOfNewApplication,
  notifyApplicantOfStatusChange,
};
