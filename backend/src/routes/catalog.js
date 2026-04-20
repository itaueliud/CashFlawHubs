const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getCategoryCatalog, getProvidersByCategory } = require('../controllers/categoryController');

router.get('/categories', protect, getCategoryCatalog);
router.get('/categories/:categoryKey/providers', protect, getProvidersByCategory);

module.exports = router;
