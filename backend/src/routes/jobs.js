const express = require('express');
const router = express.Router();
const { getJobs, getJob, getCategories, createJobPosting } = require('../controllers/jobController');
const { applyToJob } = require('../controllers/jobApplicationController');
const { protect, requireActivation } = require('../middleware/auth');

router.get('/', protect, getJobs);
router.post('/', protect, requireActivation, createJobPosting);
router.get('/categories', protect, getCategories);
router.get('/:id', protect, getJob);
router.post('/:id/apply', protect, applyToJob);

module.exports = router;
