const express = require('express');
const router = express.Router();
const tradeController = require('../controllers/tradeController');
const { protect } = require('../middleware/authMiddleware');

const { validate, tradeValidation } = require('../middleware/validationMiddleware');

router.post('/buy', protect, validate(tradeValidation), tradeController.buyStock);
router.post('/sell', protect, validate(tradeValidation), tradeController.sellStock);

module.exports = router;
