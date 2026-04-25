const express = require('express');
const router = express.Router();
const { getProfile, getTransactions } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.get('/me', protect, getProfile);
router.get('/transactions', protect, getTransactions);

module.exports = router;
