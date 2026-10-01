const express = require('express');
const router = express.Router();
const {
  getProducts,
  getBestSellersHandler,
  getRecommendedHandler,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../controllers/productController');
const { protect, optionalAuth } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

router.get('/', getProducts);
// სპეციალური სიები — /:id-მდე, რომ slug-ად არ აღიქვას
router.get('/best-sellers', getBestSellersHandler);
router.get('/recommended', optionalAuth, getRecommendedHandler);
router.get('/:id', getProductById);
router.post('/', protect, authorize('admin', 'manager'), createProduct);
router.put('/:id', protect, authorize('admin', 'manager'), updateProduct);
router.delete('/:id', protect, authorize('admin'), deleteProduct);

module.exports = router;
