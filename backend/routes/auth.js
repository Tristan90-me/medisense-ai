const express = require('express');
const router = express.Router();
const {
  register, verifyEmail, resendVerification,
  login, verifyOtp, getMe,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/login', login);
router.post('/verify-otp', verifyOtp);
router.get('/me', protect, getMe);

module.exports = router;