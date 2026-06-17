const express = require('express');
const router = express.Router();
const { postback } = require('../controllers/timewallController');

router.get('/postback', postback);

module.exports = router;
