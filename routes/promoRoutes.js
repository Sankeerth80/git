const express = require('express');
const router = express.Router();
const { getPromos, createPromo, redeemPromo } = require('../controllers/promoController');
const { protect, admin } = require('../middleware/authMiddleware');
const { validate, promoCreateValidation, promoRedeemValidation } = require('../middleware/validationMiddleware');

router.get('/', protect, getPromos);
router.post('/', protect, admin, validate(promoCreateValidation), createPromo);
router.post('/redeem', protect, validate(promoRedeemValidation), redeemPromo);

module.exports = router;
