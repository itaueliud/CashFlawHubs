const express = require('express');
const router = express.Router();
const {
  getJobs,
  getJob,
  getCategories,
  createJobPosting,
  syncScrapedJob,
  expireScrapedJobs,
} = require('../controllers/jobController');
const {
	applyToJob,
	getMyJobApplications,
	updateJobApplicationStatus,
	getJobApplicationsForManagement,
} = require('../controllers/jobApplicationController');
const { getJobApplicants } = require('../controllers/jobApplicationController');
const { protect, requireActivation, staffOnly } = require('../middleware/auth');
const { syncJobs } = require('../controllers/jobController');

router.get('/', protect, getJobs);
router.post('/', protect, requireActivation, createJobPosting);
router.get('/categories', protect, getCategories);
router.get('/applications/me', protect, getMyJobApplications);
router.post('/sync', syncScrapedJob);
router.post('/expire', expireScrapedJobs);
router.get('/:id/applications', protect, getJobApplicationsForManagement);
router.get('/:id/applicants', protect, getJobApplicants);
router.patch('/:id/applications/:applicationId/status', protect, updateJobApplicationStatus);
router.post('/sync-now', protect, staffOnly, async (req, res) => {
  const result = await syncJobs();
  res.json({
    success: result?.success !== false,
    message: `Job sync completed. Synced ${result?.synced || 0} jobs.`,
    ...result,
  });
});
router.get('/:id', protect, getJob);
router.post('/:id/apply', protect, requireActivation, applyToJob);

module.exports = router;
