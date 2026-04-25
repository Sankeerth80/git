const express = require('express');
const router = express.Router();
const { buyStock, sellStock } = require('../controllers/tradeController');
const { protect } = require('../middleware/authMiddleware');

router.post('/buy', protect, buyStock);
router.post('/sell', protect, sellStock);

module.exports = router;
