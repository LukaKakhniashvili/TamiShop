const express = require('express');
const router = express.Router();
const {
  getCheckoutOptions,
  createOrder,
  cancelMyOrder,
  getMyOrders,
  getOrders,
  updateOrderStatus,
} = require('../controllers/orderController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

router.get('/checkout-options', getCheckoutOptions);
router.post('/', protect, createOrder);
router.get('/mine', protect, getMyOrders);
router.post('/:id/cancel', protect, cancelMyOrder);
router.get('/', protect, authorize('admin', 'manager'), getOrders);
router.put('/:id/status', protect, authorize('admin', 'manager'), updateOrderStatus);

module.exports = router;
