const mongoose = require('mongoose');
const Promo = require('../models/Promo');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

function generatePromoCode(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

exports.getPromos = async (req, res, next) => {
  try {
    const query = req.user.role === 'admin' ? {} : { active: true };
    const promos = await Promo.find(query).sort({ createdAt: -1 }).lean();
    const normalized = promos.map((promo) => ({
      code: promo.code,
      amount: promo.amount,
      maxUses: promo.maxUses,
      usedCount: promo.usedCount,
      active: promo.active,
      createdBy: promo.createdBy,
      createdAt: promo.createdAt,
    }));
    res.json(normalized);
  } catch (error) {
    next(error);
  }
};

exports.createPromo = async (req, res, next) => {
  try {
    let { code, amount, maxUses } = req.body;
    amount = Number(amount);
    maxUses = Number(maxUses);

    if (!code) {
      code = generatePromoCode(10);
    } else {
      code = String(code);
    }

    const existingPromo = await Promo.findOne({ code });
    if (existingPromo) {
      return res.status(409).json({ error: 'Promo code already exists' });
    }

    const promo = new Promo({
      code,
      amount,
      maxUses,
      createdBy: req.user.username,
    });

    await promo.save();
    res.status(201).json(promo);
  } catch (error) {
    next(error);
  }
};

exports.redeemPromo = async (req, res, next) => {
  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Idempotency-Key header is required' });
  }

  // Attempt to save the idempotency key. If it fails with a duplicate key error (11000),
  // it means this request is a duplicate being processed concurrently or recently.
  try {
    await require('../models/IdempotencyKey').create({ key: `${req.user.id}-${idempotencyKey}` });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Duplicate request detected. Please wait.' });
    }
    return next(error);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { code } = req.body;
    const userId = req.user.id;
    const safeCode = String(code);

    const promo = await Promo.findOne({ code: safeCode }).session(session);
    if (!promo || !promo.active) {
      throw new Error('Promo code not found or inactive');
    }

    if (promo.usedBy.includes(userId)) {
      throw new Error('You have already used this promo code');
    }

    if (promo.usedCount >= promo.maxUses) {
      promo.active = false;
      await promo.save({ session });
      throw new Error('Promo code has expired');
    }

    const user = await User.findById(userId).session(session);
    if (!user) {
      throw new Error('User not found');
    }

    const deposit = promo.amount;

    // Update Promo
    promo.usedCount += 1;
    promo.usedBy.push(userId);
    if (promo.usedCount >= promo.maxUses) {
      promo.active = false;
    }
    await promo.save({ session });

    // Update User Wallet
    user.cash = Number((user.cash + deposit).toFixed(2));
    await user.save({ session });

    // Create Transaction Log
    const transaction = new Transaction({
      userId: user._id,
      username: user.username,
      action: 'DEPOSIT',
      asset: 'PROMO',
      qty: 1,
      total: deposit
    });
    await transaction.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.json({
      code: promo.code,
      amount: deposit,
      remainingUses: promo.maxUses - promo.usedCount,
      active: promo.active,
      newCash: user.cash,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ error: error.message });
  }
};
