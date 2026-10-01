const express = require('express');
const router = express.Router();

const auth = require('../controllers/authController');
const password = require('../controllers/passwordController');
const {
  limitCodeSend,
  limitCodeVerify,
  limitResetSend,
  limitResetVerify,
  limitResetComplete,
  limitPasswordChange,
} = require('../middleware/authLimits');
const categories = require('../controllers/categoryController');
const products = require('../controllers/productController');
const orders = require('../controllers/orderController');
const users = require('../controllers/userController');
const payments = require('../controllers/paymentController');
const { protect, optionalAuth } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

const staff = [protect, authorize('admin', 'manager')];
const admin = [protect, authorize('admin')];

/*
 * API — სახელები ფორმატით /api/<რესურსი>-<მოქმედება>, რომ endpoint-იდან ჩანდეს რას აკეთებს.
 * ძველი REST მისამართები (/api/orders, /api/products/...) დროებით რჩება თავსებადობისთვის (server.js).
 */

// ---- ავტორიზაცია
router.post('/auth-google-login', auth.googleLogin);
router.post('/auth-register', auth.register);
router.post('/auth-login', auth.login);
router.post('/auth-verification-code-send', limitCodeSend, auth.sendOtp); // ვერიფიკაციის კოდი ელ. ფოსტაზე
router.get('/auth-verification-code-status', auth.otpStatus); // დარჩენილი ტაიმერები (გვერდის განახლების შემდეგ)
router.post('/auth-verification-code-verify', limitCodeVerify, auth.verifyOtp);
router.get('/auth-profile', protect, auth.getMe);
router.put('/auth-profile-update', protect, auth.updateMe);

// ---- პაროლი: შეცვლა (ავტორიზებული) და აღდგენა (კოდი → reset token → ახალი პაროლი)
router.post('/auth-password-change', protect, limitPasswordChange, password.changePassword);
router.post('/auth-password-reset-code-send', limitResetSend, password.sendResetCode);
router.get('/auth-password-reset-code-status', password.resetCodeStatus);
router.post('/auth-password-reset-code-verify', limitResetVerify, password.verifyResetCode);
router.post('/auth-password-reset', limitResetComplete, password.resetPassword);

// ---- კატეგორიები
router.get('/category-list', categories.getCategories);
router.get('/category-details/:id', categories.getCategoryById);
router.post('/category-create', ...staff, categories.createCategory);
router.put('/category-reorder', ...staff, categories.reorderCategories);
router.put('/category-update/:id', ...staff, categories.updateCategory);
router.delete('/category-delete/:id', ...staff, categories.deleteCategory);

// ---- პროდუქტები
router.get('/product-list', products.getProducts);
router.get('/product-best-sellers', products.getBestSellersHandler);
router.get('/product-recommended', optionalAuth, products.getRecommendedHandler);
router.get('/product-details/:id', products.getProductById);
router.post('/product-create', ...staff, products.createProduct);
router.put('/product-update/:id', ...staff, products.updateProduct);
router.delete('/product-delete/:id', ...admin, products.deleteProduct);

// ---- შეკვეთები
router.get('/order-checkout-options', orders.getCheckoutOptions);
// შეკვეთის შექმნა: კურიერთან გადახდისას შეკვეთა მაშინვე დადასტურებულია და მომხმარებელს
// ელ. ფოსტაზე ეგზავნება დადასტურების წერილი (ბარათით გადახდისას — წარმატებული გადახდის შემდეგ)
router.post('/order-create', protect, orders.createOrder);
router.get('/order-my-list', protect, orders.getMyOrders);
router.post('/order-cancel/:id', protect, orders.cancelMyOrder);
router.get('/order-list', ...staff, orders.getOrders);
router.put('/order-status-update/:id', ...staff, orders.updateOrderStatus);

// ---- მომხმარებლები (ადმინი)
router.get('/user-list', ...admin, users.getUsers);
router.post('/user-create', ...admin, users.createUser);
router.put('/user-update/:id', ...admin, users.updateUser);
router.delete('/user-delete/:id', ...admin, users.deleteUser);
router.put('/user-role-update/:id', ...admin, users.updateUserRole);
router.put('/user-status-update/:id', ...admin, users.updateUserStatus);

// ---- ბარათით გადახდა (ბანკის callback და სატესტო გვერდი რჩება /api/payments/... — ეს მისამართები ბანკებთანაა რეგისტრირებული)
router.post('/payment-init/:orderId', protect, payments.initPayment);
router.get('/payment-status/:orderId', protect, payments.getPaymentStatus);

module.exports = router;
