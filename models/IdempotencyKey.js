const mongoose = require('mongoose');

const idempotencySchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now, expires: 600 } // Auto-delete after 10 minutes (600 seconds)
});

module.exports = mongoose.model('IdempotencyKey', idempotencySchema);
