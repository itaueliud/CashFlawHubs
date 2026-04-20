const express = require('express');
const router = express.Router();
const { getJobs, getJob, getCategories, createJobPosting } = require('../controllers/jobController');
const { protect, requireActivation } = require('../middleware/auth');

router.get('/', protect, getJobs);
router.post('/', protect, requireActivation, createJobPosting);
router.get('/categories', protect, getCategories);
router.get('/:id', protect, getJob);

module.exports = router;
