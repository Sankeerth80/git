const express = require('express');
const router = express.Router();
const { getMarketData, getMarketHistory, getMarketTrend, getMarketNarrative, updateAllMarkets } = require('../utils/marketUtil');
const Promo = require('../models/Promo');
const { apiLimiter } = require('../middleware/rateLimiter');

router.use(apiLimiter);

router.get('/', async (req, res, next) => {
  try {
    updateAllMarkets();

    let promoHighlights = [];
    try {
      promoHighlights = await Promo.find({ active: true })
        .sort({ createdAt: -1 })
        .limit(3)
        .select('code amount maxUses usedCount -_id')
        .lean();
    } catch (err) {
      console.error('Unable to load promo highlights:', err.message);
    }

    const narrative = getMarketNarrative();
    
    res.json({
      prices: getMarketData(),
      history: getMarketHistory(),
      trend: getMarketTrend(),
      commentary: narrative.summary,
      marketNote: narrative.note,
      promoHighlights,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/trend', (req, res) => {
  res.json({ trend: getMarketTrend() });
});

module.exports = router;
