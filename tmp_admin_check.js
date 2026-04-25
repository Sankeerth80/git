const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcrypt');

(async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/quantumtrade_test');
    const admin = await User.findOne({ role: 'admin' }).lean();
    console.log('admin', admin ? { username: admin.username, role: admin.role, password: admin.password } : null);
    if (admin) {
      const ok = await bcrypt.compare('Satyamani80', admin.password);
      console.log('password match', ok);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
})();
