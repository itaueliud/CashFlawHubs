const express = require('express');
const router = express.Router();
const { getJobs, getJob, getCategories } = require('../controllers/jobController');
const { protect } = require('../middleware/auth');

router.get('/', protect, getJobs);
router.get('/categories', protect, getCategories);
router.get('/:id', protect, getJob);

module.exports = router;
