const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  validateUserToken,
  registerAdmin,
  loginAdmin,
  validateAdminToken,
  changePassword,
  verifyOtp,
  verifyEmailToken,
  resendVerificationOtp,
  forgotPassword,
  verifyResetOtp,
  resetPassword
} = require('../controllers/authController');
const fetchUser = require('../middlewares/fetchUser');
const fetchAdmin = require('../middlewares/fetchAdmin');

// User Authentication routes
router.post('/register', registerUser);
router.post('/signup', registerUser);
router.post('/login', loginUser);
router.post('/signin', loginUser);
router.get('/validate', fetchUser, validateUserToken);
router.put('/change-password', fetchUser, changePassword);

// Email Verification & OTP Routes
router.post('/verify-otp', verifyOtp);
router.post('/verify-email', verifyEmailToken);
router.get('/verify-email', verifyEmailToken);
router.post('/resend-otp', resendVerificationOtp);

// Forgot Password & Reset Routes
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOtp);
router.post('/reset-password', resetPassword);

// Admin Authentication routes (Registration protected — only authenticated admins can create admins)
router.post('/admin/register', fetchAdmin, registerAdmin);
router.post('/admin/login', loginAdmin);
router.get('/admin/validate', fetchAdmin, validateAdminToken);

module.exports = router;
