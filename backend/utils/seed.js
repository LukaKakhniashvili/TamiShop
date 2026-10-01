// გამოყენება: npm run seed
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Category = require('../models/Category');
const Product = require('../models/Product');

const slugify = (str) =>
  str.toString().trim().toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');

const run = async () => {
  await connectDB();

  await Category.deleteMany();
  await Product.deleteMany();

  const categories = await Category.insertMany([
    { name: 'ელექტრონიკა', slug: 'electronics' },
    { name: 'სამოსი', slug: 'apparel' },
    { name: 'სახლი და ბაღი', slug: 'home-and-garden' },
  ]);

  await Product.insertMany([
    {
      name: 'უსადენო ყურსასმენები',
      slug: 'wireless-headphones-' + Date.now().toString(36),
      description: 'მაღალი ხარისხის უსადენო ყურსასმენები აქტიური ხმაურის ჩახშობით.',
      price: 199.99,
      image: 'https://placehold.co/600x600?text=Headphones',
      category: categories[0]._id,
      inStock: true,
    },
    {
      name: 'სმარტ საათი',
      slug: 'smart-watch-' + Date.now().toString(36),
      description: 'ფიტნეს ტრეკერი პულსის მონიტორინგით და GPS-ით.',
      price: 249.0,
      image: 'https://placehold.co/600x600?text=Smart+Watch',
      category: categories[0]._id,
      inStock: true,
    },
    {
      name: 'საზაფხულო მაისური',
      slug: 't-shirt-' + Date.now().toString(36),
      description: '100% ბამბის მაისური, ხელმისაწვდომია რამდენიმე ფერში.',
      price: 29.99,
      image: 'https://placehold.co/600x600?text=T-Shirt',
      category: categories[1]._id,
      inStock: true,
    },
    {
      name: 'სარგავი ქოთანი',
      slug: 'plant-pot-' + Date.now().toString(36),
      description: 'კერამიკული ქოთანი დეკორატიული მცენარეებისთვის.',
      price: 15.5,
      image: 'https://placehold.co/600x600?text=Plant+Pot',
      category: categories[2]._id,
      inStock: true,
    },
  ]);

  console.log('საწყისი მონაცემები წარმატებით დაემატა!');
  await mongoose.connection.close();
  process.exit(0);
};

// მხოლოდ პირდაპირ გაშვებისას (node utils/...) — require()-ით ჩატვირთვა ბაზას არ ეხება
if (require.main === module) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
