const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
// Mocking the marketData and marketHistory logic here for simplicity,
// Ideally this should be a service or a shared module.
// In a real app, you'd fetch current price from a DB or memory store updated by a worker.

// We will export a setter from server.js or market.js to inject this, or just use a shared memory store.
// For now, let's keep the `getCurrentPrice` logic in a shared `utils/marketUtil.js` or assume it's passed somehow.
// Let's create a utils/marketUtil.js later.
const { getCurrentPrice } = require('../utils/marketUtil');

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

exports.buyStock = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { symbol, quantity } = req.body;
    const normalized = String(symbol || '').toUpperCase();
    const qty = Number(quantity);

    if (!normalized || !Number.isInteger(qty) || qty <= 0) {
      throw new Error('Invalid symbol or quantity');
    }

    const price = getCurrentPrice(normalized);
    if (!price) {
      throw new Error('Market price unavailable');
    }

    const cost = Number((price * qty).toFixed(2));

    const user = await User.findById(req.user.id).session(session);
    if (!user) throw new Error('User not found');

    if (user.cash < cost) {
      throw new Error('Insufficient funds for purchase');
    }

    user.cash = Number((user.cash - cost).toFixed(2));
    user.holdings = user.holdings || {};
    user.holdings[normalized] = (user.holdings[normalized] || 0) + qty;
    user.markModified('holdings'); // Important for mixed types
    await user.save({ session });

    const transaction = new Transaction({
      userId: user._id,
      type: 'debit',
      amount: cost,
      description: `Bought ${qty} shares of ${normalized} at $${price}`
    });
    await transaction.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Portfolio calc requires current marketData which we can get from marketUtil
    const { getMarketData } = require('../utils/marketUtil');
    const portfolio = calculatePortfolioValue(user.holdings, getMarketData());

    res.json({
      message: `Purchased ${qty} ${normalized} for $${cost.toFixed(2)}.`,
      symbol: normalized,
      price,
      quantity: qty,
      cash: user.cash,
      holdings: user.holdings,
      portfolio,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ error: error.message });
  }
};

exports.sellStock = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { symbol, quantity } = req.body;
    const normalized = String(symbol || '').toUpperCase();
    const qty = Number(quantity);

    if (!normalized || !Number.isInteger(qty) || qty <= 0) {
      throw new Error('Invalid symbol or quantity');
    }

    const user = await User.findById(req.user.id).session(session);
    if (!user) throw new Error('User not found');

    user.holdings = user.holdings || {};
    const owned = Number(user.holdings[normalized] || 0);
    if (owned < qty) {
      throw new Error('Not enough shares to sell');
    }

    const price = getCurrentPrice(normalized);
    if (!price) {
      throw new Error('Market price unavailable');
    }

    const proceeds = Number((price * qty).toFixed(2));
    user.cash = Number((user.cash + proceeds).toFixed(2));
    user.holdings[normalized] = owned - qty;
    
    if (user.holdings[normalized] <= 0) {
      delete user.holdings[normalized];
    }
    user.markModified('holdings');
    await user.save({ session });

    const transaction = new Transaction({
      userId: user._id,
      type: 'credit',
      amount: proceeds,
      description: `Sold ${qty} shares of ${normalized} at $${price}`
    });
    await transaction.save({ session });

    await session.commitTransaction();
    session.endSession();

    const { getMarketData } = require('../utils/marketUtil');
    const portfolio = calculatePortfolioValue(user.holdings, getMarketData());

    res.json({
      message: `Sold ${qty} ${normalized} for $${proceeds.toFixed(2)}.`,
      symbol: normalized,
      price,
      quantity: qty,
      cash: user.cash,
      holdings: user.holdings,
      portfolio,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ error: error.message });
  }
};
