const express = require('express');
const router = express.Router();
const { getUsers, getActivity } = require('../controllers/adminController');
const { protect, admin } = require('../middleware/authMiddleware');
const { setMarketTrend } = require('../utils/marketUtil');

router.get('/users', protect, admin, getUsers);
router.get('/activity', protect, admin, getActivity);

router.post('/market-trend', protect, admin, (req, res) => {
  const { trend } = req.body;
  if (setMarketTrend(trend)) {
    res.json({ trend, message: `Market trend set to ${trend}` });
  } else {
    res.status(400).json({ error: 'Invalid trend' });
  }
});

module.exports = router;
