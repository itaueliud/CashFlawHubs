const Job = require('../models/Job');
const JobApplication = require('../models/JobApplication');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const logger = require('../utils/logger');
const { sendgridClient, sendSMS } = require('../services/notificationService');

const MAX_COVER_LETTER_LENGTH = 3000;
const JOB_APPLICATION_STATUS = ['submitted', 'reviewed', 'shortlisted', 'rejected'];
const STATUS_NOTIFY_SET = new Set(['reviewed', 'shortlisted']);

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
        .lean(),
      JobApplication.countDocuments(query),
    ]);

    const normalized = applications.map((application) => {
      const applicant = application.userId || {};
      return {
        _id: application._id,
        status: application.status,
        coverLetter: application.coverLetter || '',
        tokenCost: application.tokenCost || 0,
        appliedAt: application.appliedAt,
        createdAt: application.createdAt,
        updatedAt: application.updatedAt,
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
        tokenCost: application.tokenCost || 0,
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
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (job.expiresAt && job.expiresAt <= new Date()) {
      return res.status(410).json({ success: false, message: 'This job is no longer accepting applications' });
    }

    if (job.postedBy && String(job.postedBy) === String(req.user.id)) {
      return res.status(400).json({ success: false, message: 'You cannot apply to your own job posting' });
    }

    const coverLetter = typeof req.body?.coverLetter === 'string' ? req.body.coverLetter.trim() : '';
    if (coverLetter.length > MAX_COVER_LETTER_LENGTH) {
      return res.status(400).json({ success: false, message: `Cover letter is too long (max ${MAX_COVER_LETTER_LENGTH} characters)` });
    }

    const existingApplication = await JobApplication.findOne({ jobId: job._id, userId: req.user.id });
    if (existingApplication) {
      return res.status(409).json({ success: false, message: 'You already applied to this job' });
    }

    const tokenCost = Math.max(Number(job.applicationTokenCost || 0), 0);

    const application = await JobApplication.create({
      jobId: job._id,
      userId: req.user.id,
      coverLetter: coverLetter || null,
      tokenCost,
      status: 'submitted',
    });

    let tokenBalance = req.user.tokenBalance;
    if (tokenCost > 0) {
      const applicant = await User.findOneAndUpdate(
        { _id: req.user.id, tokenBalance: { $gte: tokenCost } },
        { $inc: { tokenBalance: -tokenCost, totalTokensSpent: tokenCost } },
        { new: true }
      );

      if (!applicant) {
        await JobApplication.deleteOne({ _id: application._id });
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
    (async () => {
      try {
        const jobRef = await Job.findById(job._id).select('applicationUrl title company description applicationContactEmail applicationContactSource');
        if (!jobRef) return;

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
          try {
            const applicant = await User.findById(req.user.id).select('firstName lastName name email phone userId');
            const applicantName = applicant?.name || [applicant?.firstName, applicant?.lastName].filter(Boolean).join(' ').trim() || applicant?.email || 'Applicant';
            const subject = `New application for ${jobRef.title} at ${jobRef.company}`;
            const safeCover = coverLetter ? String(coverLetter).replace(/\n/g, '<br/>') : 'No cover letter provided.';
            const html = `
              <p>Hello,</p>
              <p>You have received a new application for <strong>${jobRef.title}</strong> at <strong>${jobRef.company}</strong>.</p>
              <p><strong>Applicant:</strong> ${applicantName}</p>
              <p><strong>Email:</strong> ${applicant?.email || 'N/A'}</p>
              <p><strong>Phone:</strong> ${applicant?.phone || 'N/A'}</p>
              <p><strong>Cover Letter:</strong></p>
              <p>${safeCover}</p>
              <p>Original job listing: <a href="${jobRef.applicationUrl}">${jobRef.applicationUrl}</a></p>
              <p>To reply directly to the applicant, reply to this email.</p>
            `;

            // send with reply-to set to applicant email so employer responses go directly to applicant
            await sendgridClient.sendEmail({ to: ownerEmail, subject, html, replyTo: applicant?.email });
            logger.info(`Forwarded application ${application._id} to owner ${ownerEmail}`);
          } catch (err) {
            logger.warn(`Failed to forward application to owner: ${err.message}`);
          }
        }
      } catch (err) {
        logger.warn(`Owner forward attempt failed: ${err.message}`);
      }
    })();

    res.status(201).json({
      success: true,
      message: tokenCost > 0 ? `Application submitted successfully using ${tokenCost} tokens` : 'Application submitted successfully',
      tokenCost,
      tokenBalance,
      application,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: 'You already applied to this job' });
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