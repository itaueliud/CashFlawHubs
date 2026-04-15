const Job = require('../models/Job');
const JobApplication = require('../models/JobApplication');
const logger = require('../utils/logger');

exports.applyToJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job || !job.isActive) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const existingApplication = await JobApplication.findOne({ jobId: job._id, userId: req.user.id });
    if (existingApplication) {
      return res.status(409).json({ success: false, message: 'You already applied to this job' });
    }

    const application = await JobApplication.create({
      jobId: job._id,
      userId: req.user.id,
      coverLetter: req.body.coverLetter || null,
      status: 'submitted',
    });

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      application,
    });
  } catch (error) {
    logger.error(`applyToJob error: ${error.message}`);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};