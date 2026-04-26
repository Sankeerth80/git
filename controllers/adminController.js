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

exports.clearTestData = async (req, res, next) => {
  try {
    const resultUsers = await User.deleteMany({ role: { $ne: 'admin' } });
    const resultTx = await Transaction.deleteMany({});
    res.json({ message: `Successfully deleted ${resultUsers.deletedCount} test users and ${resultTx.deletedCount} transactions.` });
  } catch (error) {
    next(error);
  }
};
