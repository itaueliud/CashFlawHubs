const express = require('express');
const router = express.Router();
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

router.get('/', protect, getJobs);
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
