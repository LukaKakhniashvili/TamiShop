const express = require('express');
const router = express.Router();
const {
  initPayment,
  getPaymentStatus,
  paymentCallback,
  sandboxPage,
  sandboxComplete,
} = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

// ბანკის შეტყობინებები და სატესტო გვერდი — ავტორიზაციის გარეშე
router.post('/callback/:bank', paymentCallback);
router.get('/sandbox/:sessionId', sandboxPage);
router.post('/sandbox/:sessionId', express.urlencoded({ extended: false }), sandboxComplete);

router.post('/:orderId/init', protect, initPayment);
router.get('/:orderId/status', protect, getPaymentStatus);

module.exports = router;
