// გამოყენება: node utils/makeAdmin.js user@example.com
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

const email = process.argv[2];

if (!email) {
  console.error('გთხოვთ მიუთითოთ ემეილი: node utils/makeAdmin.js user@example.com');
  process.exit(1);
}

const run = async () => {
  await connectDB();
  const user = await User.findOneAndUpdate({ email }, { role: 'admin' }, { new: true });

  if (!user) {
    console.error(`მომხმარებელი ვერ მოიძებნა: ${email}. ჯერ ერთხელ შედით საიტზე Google-ით.`);
  } else {
    console.log(`მომხმარებელი ${email} გახდა admin.`);
  }

  await mongoose.connection.close();
  process.exit(0);
};

run();
