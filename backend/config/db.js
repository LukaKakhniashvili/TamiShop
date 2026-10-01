const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB დაკავშირებულია: ${conn.connection.host}`);
  } catch (error) {
    console.error(`შეცდომა MongoDB-თან დაკავშირებისას: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
