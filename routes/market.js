const express = require('express');
const router = express.Router();

const prices = {
  BTC: 62000,
  ETH: 4200,
  SOL: 185,
  ADA: 0.95,
  LINK: 22,
};

function randomWalk(value) {
  const change = (Math.random() * 2 - 1) * value * 0.02;
  return Math.max(0.01, value + change);
}

router.get('/', (req, res) => {
  Object.keys(prices).forEach((symbol) => {
    prices[symbol] = Number(randomWalk(prices[symbol]).toFixed(2));
  });
  res.json(prices);
});

module.exports = router;
