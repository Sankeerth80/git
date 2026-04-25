const express = require('express');
const router = express.Router();
const { getPromos, createPromo, redeemPromo } = require('../controllers/promoController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getPromos)
  .post(protect, admin, createPromo);

router.post('/redeem', protect, redeemPromo);

module.exports = router;
