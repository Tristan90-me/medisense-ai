const express = require('express');
const router = express.Router();
const {
  adminLogin, adminResendOtp, adminVerifyOtp, acceptAdminInvite, getMe,
} = require('../controllers/authAdminController');
const { protect, adminOnly } = require('../middleware/auth');

router.post('/login', adminLogin);
router.post('/resend-otp', adminResendOtp);
router.post('/verify-otp', adminVerifyOtp);
router.post('/accept-invite', acceptAdminInvite);
router.get('/me', protect, adminOnly, getMe);

module.exports = router;
