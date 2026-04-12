const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, trim: true, lowercase: true, index: true },
    password: String,
    role: { type: String, default: 'user' },
    phone: String,
    ip: String,
    cash: { type: Number, default: 1000 },
    holdings: { type: Object, default: {} },
    pnl: { type: Number, default: 0 }
});

module.exports = mongoose.model('User', userSchema);