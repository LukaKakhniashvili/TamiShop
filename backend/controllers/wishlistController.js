const asyncHandler = require('express-async-handler');
const wishlist = require('../services/wishlist');

/* რჩეულები — მხოლოდ ავტორიზებული მომხმარებლის საკუთარი სია (req.user; frontend-ის userId არ მიიღება) */

// @desc    რჩეული პროდუქტები (მიმდინარე მონაცემებით, ProductCard-ისთვის)
// @route   GET /api/wishlist-list
// @access  Private
const getWishlist = asyncHandler(async (req, res) => {
  const products = await wishlist.listProducts(req.user._id);
  res.json({ products, count: products.length });
});

// @desc    რჩეულების id-ები (მსუბუქი — გულების მდგომარეობისთვის, ერთი მოთხოვნით მთელ საიტზე)
// @route   GET /api/wishlist-ids
// @access  Private
const getWishlistIds = asyncHandler(async (req, res) => {
  const ids = await wishlist.listIds(req.user._id);
  res.json({ ids, count: ids.length });
});

// @desc    რჩეულების რაოდენობა
// @route   GET /api/wishlist-count
// @access  Private
const getWishlistCount = asyncHandler(async (req, res) => {
  res.json({ count: (await wishlist.listIds(req.user._id)).length });
});

// @desc    დამატება (განმეორებითი — უსაფრთხოა, დუბლიკატს არ ქმნის)
// @route   POST /api/wishlist-add/:productId
// @access  Private
const addToWishlist = asyncHandler(async (req, res) => {
  const ids = await wishlist.add(req.user._id, req.params.productId);
  res.json({ ids, count: ids.length });
});

// @desc    წაშლა (განმეორებითი — უსაფრთხოა)
// @route   DELETE /api/wishlist-remove/:productId
// @access  Private
const removeFromWishlist = asyncHandler(async (req, res) => {
  const ids = await wishlist.remove(req.user._id, req.params.productId);
  res.json({ ids, count: ids.length });
});

module.exports = { getWishlist, getWishlistIds, getWishlistCount, addToWishlist, removeFromWishlist };
