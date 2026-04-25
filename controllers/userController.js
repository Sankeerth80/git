const User = require('../models/User');
const Transaction = require('../models/Transaction');

function calculatePortfolioValue(holdings, marketData) {
  const values = {};
  let total = 0;
  Object.entries(holdings || {}).forEach(([symbol, quantity]) => {
    const price = marketData[symbol]?.toFixed?.(2) ? Number(marketData[symbol]) : 0;
    const position = Number(quantity) * price;
    values[symbol] = {
      quantity: Number(quantity),
      price,
      value: Number(position.toFixed(2)),
    };
    total += position;
  });
  return { positions: values, totalValue: Number(total.toFixed(2)) };
}

exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password -googleId');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { getMarketData } = require('../utils/marketUtil');
    const portfolio = calculatePortfolioValue(user.holdings || {}, getMarketData());

    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      cash: user.cash,
      holdings: user.holdings,
      pnl: user.pnl,
      portfolio,
    });
  } catch (error) {
    next(error);
  }
};

exports.getTransactions = async (req, res, next) => {
  try {
    const transactions = await Transaction.find({ userId: req.user.id }).sort({ date: -1 }).limit(50);
    res.json(transactions);
  } catch (error) {
    next(error);
  }
};
