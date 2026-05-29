const Job = require('../models/Job');
const Delivery = require('../models/Delivery');
const JobApplication = require('../models/JobApplication');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const logger = require('../utils/logger');
const { sendgridClient, sendSMS } = require('../services/notificationService');
const { processDeliveryMessage } = require('../services/applicationDelivery');
const fs = require('fs');

const MAX_COVER_LETTER_LENGTH = 3000;
const MIN_COVER_LETTER_LENGTH = 1;
const JOB_APPLICATION_STATUS = ['submitted', 'reviewed', 'shortlisted', 'rejected'];
const STATUS_NOTIFY_SET = new Set(['reviewed', 'shortlisted']);

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
      if (!JOB_APPLICATION_STATUS.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid application status filter' });
      }
      query.status = status;
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
            .select('status appliedAt createdAt updatedAt tokenCost coverLetter userId cvOriginalName cvFileName cvMimeType cvUrl'),
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
        status: application.status,
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
  if (!STATUS_NOTIFY_SET.has(status)) return;

  const safeName = applicant.firstName || applicant.name || 'there';
  const safeJobTitle = jobTitle || 'the role';
  const safeCompany = company || 'the company';
  const statusLabel = status === 'shortlisted' ? 'shortlisted' : 'reviewed';

  if (applicant.email) {
    try {
      await sendgridClient.sendEmail({
        to: applicant.email,
        subject: `Update on your application for ${safeJobTitle}`,
        html: `<p>Hello ${safeName},</p><p>Your application for <strong>${safeJobTitle}</strong> at <strong>${safeCompany}</strong> has been <strong>${statusLabel}</strong>.</p><p>Log in to CashFlawHubs to view details and next steps.</p>`,
      });
    } catch (error) {
      logger.warn(`Job application email notification failed: ${error.message}`);
    }
  }

  if (applicant.phone) {
    try {
      await sendSMS(applicant.phone, `CashFlawHubs update: your application for ${safeJobTitle} at ${safeCompany} has been ${statusLabel}.`);
    } catch (error) {
      logger.warn(`Job application SMS notification failed: ${error.message}`);
    }
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
        status: application.status,
        coverLetter: application.coverLetter,
        cv: application.cvUrl ? {
          originalName: application.cvOriginalName,
          fileName: application.cvFileName,
          mimeType: application.cvMimeType,
          url: application.cvUrl,
        } : null,
        tokenCost: application.tokenCost || 0,
        applicantEmailSent: Boolean(application.applicantEmailSent),
        appliedAt: application.appliedAt,
        createdAt: application.createdAt,
        updatedAt: application.updatedAt,
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
    const cvFile = req.file || null;

    if (coverLetter.length < MIN_COVER_LETTER_LENGTH) {
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
      cvOriginalName: cvFile?.originalname || null,
      cvFileName: cvFile?.filename || null,
      cvMimeType: cvFile?.mimetype || null,
      cvPath: cvFile?.path || null,
      cvUrl: cvFile ? `/uploads/job-applications/${cvFile.filename}` : null,
      tokenCost,
      status: 'submitted',
    });

    const applicantProfile = await User.findById(req.user.id).select('firstName lastName name email phone country userId referralCode userLanguage timezone registrationContext');
    let recruiterForwarded = false;
    let recruiterEmail = null;

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

    let applicantEmailSent = false;

    try {
      if (applicantProfile?.email) {
        const confirmationSubject = `Your application for ${job.title} was submitted`;
        const confirmationHtml = buildApplicantSubmissionEmail({
          user: applicantProfile.toObject ? applicantProfile.toObject() : applicantProfile,
          job,
          application,
          recruiterForwarded,
          recruiterEmail,
        });

        await sendgridClient.sendEmail({
          to: applicantProfile.email,
          subject: confirmationSubject,
          html: confirmationHtml,
        });
        applicantEmailSent = true;
        try {
          // persist flag on the application document
          await JobApplication.findByIdAndUpdate(application._id, { applicantEmailSent: true }).exec();
        } catch (err) {
          logger.warn(`Failed to persist applicantEmailSent for ${application._id}: ${err.message}`);
        }
      }
    } catch (err) {
      logger.warn(`Failed to send applicant submission confirmation: ${err.message}`);
    }

    res.status(201).json({
      success: true,
      message: tokenCost > 0 ? `Application submitted successfully using ${tokenCost} tokens` : 'Application submitted successfully',
      tokenCost,
      tokenBalance,
      emailSent: applicantEmailSent,
      application,
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

exports.updateJobApplicationStatus = async (req, res) => {
  try {
    const { id: jobId, applicationId } = req.params;
    const status = String(req.body?.status || '').trim().toLowerCase();

    if (!JOB_APPLICATION_STATUS.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid application status' });
    }

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

    const previousStatus = application.status;
    if (previousStatus === status) {
      return res.json({
        success: true,
        message: 'Status unchanged',
        application,
      });
    }

    application.status = status;
    await application.save();

    if (STATUS_NOTIFY_SET.has(status)) {
      const applicant = await User.findById(application.userId).select('firstName name email phone');
      await notifyJobApplicationStatusChange({
        applicant,
        status,
        jobTitle: job.title,
        company: job.company,
      });
    }

    return res.json({
      success: true,
      message: `Application status updated from ${previousStatus} to ${status}`,
      application,
    });
  } catch (error) {
    logger.error(`updateJobApplicationStatus error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
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