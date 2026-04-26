const User = require('../models/User');
const Transaction = require('../models/Transaction');

exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    next(error);
  }
};

exports.getActivity = async (req, res, next) => {
  try {
    const transactions = await Transaction.find().sort({ date: -1 }).limit(100);
    res.json(transactions);
  } catch (error) {
    next(error);
  }
};
