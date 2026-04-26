const mongoose = require('mongoose');

const connectDB = async () => {
  mongoose.set('bufferCommands', false);
  const maxRetries = 5;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/quantumtrade', {
        maxPoolSize: 50,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferCommands: false, // Don't buffer if not connected, throw error instead
      });
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return; // Success
    } catch (error) {
      retries++;
      console.error(`Error connecting to MongoDB (Attempt ${retries}/${maxRetries}): ${error.message}`);
      if (retries >= maxRetries) {
        console.error('Max retries reached. Database connection failed. App will continue but DB calls will fail.');
      } else {
        // Wait 3 seconds before retrying
        await new Promise(res => setTimeout(res, 3000));
      }
    }
  }
};

module.exports = connectDB;
