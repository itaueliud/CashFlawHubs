const express = require('express');
const router = express.Router();
const { getJobs, getJob, getCategories, createJobPosting } = require('../controllers/jobController');
const {
	applyToJob,
	getMyJobApplications,
	updateJobApplicationStatus,
	getJobApplicationsForManagement,
} = require('../controllers/jobApplicationController');
const { getJobApplicants } = require('../controllers/jobApplicationController');
const { protect, requireActivation } = require('../middleware/auth');

router.get('/', protect, getJobs);
router.post('/', protect, requireActivation, createJobPosting);
router.get('/categories', protect, getCategories);
router.get('/applications/me', protect, getMyJobApplications);
router.get('/:id/applications', protect, getJobApplicationsForManagement);
router.get('/:id/applicants', protect, getJobApplicants);
router.patch('/:id/applications/:applicationId/status', protect, updateJobApplicationStatus);
router.get('/:id', protect, getJob);
router.post('/:id/apply', protect, requireActivation, applyToJob);

module.exports = router;
