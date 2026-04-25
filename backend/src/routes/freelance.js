const express = require('express');
const router = express.Router();
const { getGigs, createGig, applyToGig, placeOrder, completeOrder, getMyGigs } = require('../controllers/freelanceController');
const { protect, requireActivation } = require('../middleware/auth');

router.get('/gigs', protect, getGigs);
router.post('/gigs', protect, requireActivation, createGig);
router.get('/my-gigs', protect, getMyGigs);
router.post('/gigs/:id/apply', protect, requireActivation, applyToGig);
router.post('/gigs/:id/order', protect, requireActivation, placeOrder);
router.put('/orders/:id/complete', protect, completeOrder);

module.exports = router;
