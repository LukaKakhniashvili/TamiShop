const asyncHandler = require('express-async-handler');
const { parseRange, toMeta } = require('../services/analytics/range');
const { summary, sales } = require('../services/analytics/sales');
const { products } = require('../services/analytics/products');
const { customers } = require('../services/analytics/customers');
const { wishlist } = require('../services/analytics/wishlist');
const { reviews } = require('../services/analytics/reviews');

/*
 * ბიზნეს-ანალიტიკა (ადმინი / მენეჯერი). ყველა endpoint იღებს ერთსა და იმავე დიაპაზონს:
 *   ?range=today|7d|30d|3m|1y|custom&from=YYYY-MM-DD&to=YYYY-MM-DD   (Asia/Tbilisi, [start, end))
 * პასუხს ახლავს meta (start, end, prevStart, prevEnd, granularity, timezone).
 * განმარტებები და წესები: services/analytics/base.js
 */

const withRange = (fn) =>
  asyncHandler(async (req, res) => {
    const range = parseRange(req.query);
    res.json({ meta: toMeta(range), ...(await fn(range, req.query)) });
  });

// @route GET /api/analytics-summary    — KPI-ები + წინა პერიოდი
const getSummary = withRange((range) => summary(range));
// @route GET /api/analytics-sales      — სერია, სტატუსები, გადახდები, კატეგორიები
const getSales = withRange((range) => sales(range));
// @route GET /api/analytics-products   — ბესტსელერები, შემოსავლით, სუსტი პროდუქტები (?limit≤20)
const getProducts = withRange((range, q) => products(range, { limit: q.limit }));
// @route GET /api/analytics-customers  — ახალი / დაბრუნებული / რეგისტრაციები / ტოპ მყიდველები
const getCustomers = withRange((range) => customers(range));
// @route GET /api/analytics-reviews    — შეფასებები პერიოდში
const getReviews = withRange((range) => reviews(range));

// @route GET /api/analytics-wishlist   — მხოლოდ მიმდინარე მდგომარეობა (დიაპაზონს არ იყენებს)
const getWishlist = asyncHandler(async (req, res) => {
  res.json(await wishlist());
});

module.exports = { getSummary, getSales, getProducts, getCustomers, getReviews, getWishlist };
