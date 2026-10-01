const express = require('express');
const router = express.Router();
const { googleLogin, register, login, sendOtp, verifyOtp, getMe, updateMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { limitCodeSend, limitCodeVerify } = require('../middleware/authLimits');

router.post('/google', googleLogin);
router.post('/register', register);
router.post('/login', login);
router.post('/send-otp', limitCodeSend, sendOtp);
router.post('/verify-otp', limitCodeVerify, verifyOtp);
router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);

module.exports = router;
