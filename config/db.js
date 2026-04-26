const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/quantumtrade', {
      maxPoolSize: 50
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    // We removed process.exit(1) here so the server stays alive even if the database fails to connect.
    // This stops Render from constantly crashing and throwing 503 errors, making it easier to debug.
  }
};

module.exports = connectDB;
