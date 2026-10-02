const asyncHandler = require('express-async-handler');
const reviews = require('../services/reviews');

/*
 * შეფასებები. მომხმარებელი — მხოლოდ req.user (frontend-ის userId / verifiedPurchase არ მიიღება);
 * შეძენის შემოწმება და რეიტინგის დათვლა — services/reviews.js.
 */

// @desc    პროდუქტის გამოქვეყნებული შეფასებები (sort=newest|highest|lowest, page, limit, rating=1..5)
// @route   GET /api/review-list/:productId
// @access  Public
const getProductReviews = asyncHandler(async (req, res) => {
  res.json(await reviews.list(req.params.productId, req.query));
});

// @desc    საშუალო, რაოდენობა და განაწილება (1..5)
// @route   GET /api/review-summary/:productId
// @access  Public
const getReviewSummary = asyncHandler(async (req, res) => {
  res.json(await reviews.summary(req.params.productId));
});

// @desc    შეუძლია თუ არა მიმდინარე მომხმარებელს შეფასება + მისი შეფასება
// @route   GET /api/review-eligibility/:productId
// @access  Private
const getEligibility = asyncHandler(async (req, res) => {
  res.json(await reviews.eligibility(req.user._id, req.params.productId));
});

// @desc    ჩემი შეფასებები რამდენიმე პროდუქტზე ერთი მოთხოვნით (My Orders) — ?productIds=a,b,c
// @route   GET /api/review-my-status
// @access  Private
const getMyStatus = asyncHandler(async (req, res) => {
  const ids = String(req.query.productIds || '').split(',').filter(Boolean);
  res.json({ reviews: await reviews.myStatus(req.user._id, ids) });
});

// @desc    შეფასების დაწერა (მხოლოდ დასრულებულ შეკვეთაში ნაყიდ პროდუქტზე)
// @route   POST /api/review-create/:productId
// @access  Private
const createReview = asyncHandler(async (req, res) => {
  const review = await reviews.create(req.user._id, req.params.productId, req.body);
  res.status(201).json({ review });
});

// @desc    საკუთარი შეფასების რედაქტირება (rating, comment)
// @route   PUT /api/review-update/:id
// @access  Private
const updateReview = asyncHandler(async (req, res) => {
  res.json({ review: await reviews.update(req.user._id, req.params.id, req.body) });
});

// @desc    საკუთარი შეფასების წაშლა
// @route   DELETE /api/review-delete/:id
// @access  Private
const deleteReview = asyncHandler(async (req, res) => {
  res.json(await reviews.remove(req.user._id, req.params.id));
});

// @desc    მოდერაციის სია (status, rating, search, page)
// @route   GET /api/review-admin-list
// @access  Admin / Manager
const adminListReviews = asyncHandler(async (req, res) => {
  res.json(await reviews.adminList(req.query));
});

// @desc    შეფასების დამალვა (საჯაროდ აღარ ჩანს და რეიტინგში არ ითვლება)
// @route   PUT /api/review-hide/:id
// @access  Admin / Manager
const hideReview = asyncHandler(async (req, res) => {
  res.json({ review: await reviews.setStatus(req.params.id, 'hidden', req.user._id) });
});

// @desc    შეფასების აღდგენა (ხელახლა გამოქვეყნება)
// @route   PUT /api/review-restore/:id
// @access  Admin / Manager
const restoreReview = asyncHandler(async (req, res) => {
  res.json({ review: await reviews.setStatus(req.params.id, 'published', req.user._id) });
});

module.exports = {
  getProductReviews,
  getReviewSummary,
  getEligibility,
  getMyStatus,
  createReview,
  updateReview,
  deleteReview,
  adminListReviews,
  hideReview,
  restoreReview,
};
