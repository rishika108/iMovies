const express = require('express');
const router = express.Router();
const {
  registerUser,
  verifyEmail,
  resendVerification,
  requestPasswordReset,
  resetPassword,
  loginUser,
  validateUserToken,
  registerAdmin,
  loginAdmin,
  validateAdminToken,
  changePassword
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

// Email Verification routes
router.get('/verify-email', verifyEmail);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);

// Password Reset routes
router.post('/forgot-password', requestPasswordReset);
router.post('/request-password-reset', requestPasswordReset);
router.post('/reset-password', resetPassword);

// Admin Authentication routes (Registration protected — only authenticated admins can create admins)
router.post('/admin/register', fetchAdmin, registerAdmin);
router.post('/admin/login', loginAdmin);
router.get('/admin/validate', fetchAdmin, validateAdminToken);

module.exports = router;
