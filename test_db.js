const mongoose = require('mongoose');

async function testConnection() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/quantumtrade';
  console.log('Testing connection to:', uri.replace(/:([^:@]+)@/, ':****@')); // Hide password in logs

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000 // Fail fast if IP is blocked or bad auth
    });
    console.log(`✅ SUCCESS! Connected to MongoDB: ${conn.connection.host}`);
    console.log('Your username and password are perfectly correct!');
    process.exit(0);
  } catch (err) {
    console.log('❌ FAILED to connect to MongoDB.');
    if (err.message.includes('bad auth')) {
      console.log('REASON: Incorrect username or password.');
    } else if (err.message.includes('timed out')) {
      console.log('REASON: IP Address is blocked by MongoDB Atlas. You must whitelist 0.0.0.0/0 in Atlas.');
    } else {
      console.log(`REASON: ${err.message}`);
    }
    process.exit(1);
  }
}

require('dotenv').config();
testConnection();
