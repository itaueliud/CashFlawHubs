const express = require('express');
const router = express.Router();
const User = require('../models/User');
const {
  getJobs,
  getJob,
  getCategories,
  createJobPosting,
  syncScrapedJob,
  expireScrapedJobs,
  claimJob,
  requestClaim,
  confirmClaim,
  getMyPostedJobs,
} = require('../controllers/jobController');
const {
	applyToJob,
	getMyJobApplications,
	updateJobApplicationStatus,
	updateMyJobApplicationStatus,
	getJobApplicationsForManagement,
} = require('../controllers/jobApplicationController');
const { getJobApplicants } = require('../controllers/jobApplicationController');
const jobsUpload = require('../middleware/jobsUpload');
const { protect, requireActivation, staffOnly } = require('../middleware/auth');
const { syncJobs } = require('../controllers/jobController');
const { getTheirStackCompanies, getLoopcvAlerts, normalizeProviderAlert, buildProviderStatus } = require('../services/jobProviderService');

const getUserCountry = (user = {}) => String(user?.country || 'KE').toUpperCase();
const isAdminOrSuperadmin = (user = {}) => ['admin', 'superadmin'].includes(String(user?.role || '').toLowerCase());

router.get('/', protect, getJobs);
router.get('/providers/status', protect, async (req, res) => {
  try {
    const status = buildProviderStatus({
      theirStackConfigured: Boolean(process.env.THEIRSTACK_API_KEY),
      loopcvConfigured: Boolean(process.env.LOOPCV_API_KEY),
    });

    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/providers/companies', protect, async (req, res) => {
  try {
    const country = getUserCountry(req.user);
    const skill = String(req.query.skill || '').trim();
    const page = Number(req.query.page || 0);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 50);
    const result = await getTheirStackCompanies({ country, skill, page, limit });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/providers/alerts', protect, async (req, res) => {
  try {
    const country = getUserCountry(req.user);
    const skill = String(req.query.skill || '').trim();
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 50);
    const result = await getLoopcvAlerts({ country, skill, limit });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/providers/alerts/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('jobAlerts');
    res.json({ success: true, alerts: user?.jobAlerts || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/providers/alerts', protect, async (req, res) => {
  try {
    const payload = normalizeProviderAlert(req.body);
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const existing = user.jobAlerts || [];
    const next = [
      { ...payload, createdAt: new Date() },
      ...existing.filter((item) => JSON.stringify(item) !== JSON.stringify(payload)),
    ].slice(0, 6);

    user.jobAlerts = next;
    await user.save();

    res.json({ success: true, alert: next[0], alerts: next });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/providers/alerts/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const next = (user.jobAlerts || []).filter((item) => String(item._id || item.id || '') !== req.params.id);
    user.jobAlerts = next;
    await user.save();

    res.json({ success: true, alerts: next });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/providers/admin', protect, async (req, res) => {
  if (!isAdminOrSuperadmin(req.user)) {
    return res.status(403).json({ success: false, message: 'Only admins can access provider monitoring' });
  }

  try {
    const users = await User.find({ jobAlerts: { $exists: true, $ne: [] } })
      .select('name email role jobAlerts')
      .limit(20)
      .lean();

    res.json({ success: true, users, status: buildProviderStatus({
      theirStackConfigured: Boolean(process.env.THEIRSTACK_API_KEY),
      loopcvConfigured: Boolean(process.env.LOOPCV_API_KEY),
    }) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.post('/', protect, requireActivation, createJobPosting);
router.get('/categories', protect, getCategories);
router.get('/my-posts', protect, getMyPostedJobs);
router.get('/applications/me', protect, getMyJobApplications);
router.patch('/applications/:applicationId/status', protect, requireActivation, updateMyJobApplicationStatus);
router.post('/sync', syncScrapedJob);
router.post('/expire', expireScrapedJobs);
router.patch('/:id/claim', protect, requireActivation, claimJob);
router.post('/:id/request-claim', requestClaim);
router.get('/claim/confirm', confirmClaim);
router.get('/:id/applications', protect, getJobApplicationsForManagement);
router.get('/:id/applicants', protect, getJobApplicants);
router.patch('/:id/applications/:applicationId/status', protect, updateJobApplicationStatus);
router.post('/sync-now', protect, staffOnly, async (req, res) => {
  try {
    const result = await syncJobs();
    res.json({
      success: result?.success !== false,
      message: `Job sync completed. Synced ${result?.synced || 0} jobs.`,
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Job sync failed',
      error: error?.message || String(error),
    });
  }
});
router.get('/:id', protect, getJob);
router.post('/:id/apply', protect, requireActivation, jobsUpload.single('cv'), applyToJob);

module.exports = router;
