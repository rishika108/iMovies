const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/userModel');
const Admin = require('../models/adminModel');
const {
  sendVerificationEmail,
  sendPasswordResetEmail
} = require('../services/emailService');

const JWT_SECRET = process.env.JWT_SECRET || 'imovies_super_secret_jwt_key_2024';

/**
 * Register a new User
 * Validates fields, checks duplicates
 * Hashes password
 * Generates 6-digit OTP & verification token
 * Sends Brevo verification email
 * Returns requireVerification: true
 */
const registerUser = async (req, res) => {
  try {
    const rawUsername = req.body.username || req.body.name;
    const { email, password } = req.body;

    // Validation
    if (!rawUsername || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide username, email, and password'
      });
    }

    const normalizedUsername = String(rawUsername).trim();
    if (normalizedUsername.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Username must be at least 3 characters long'
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Check for duplicate email or username
    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }]
    });

    // Generate 6-digit verification OTP and cryptographic verification token (valid for 15 mins)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    if (existingUser) {
      // If user exists with same email but is NOT verified, update credentials & resend OTP
      if (existingUser.email === normalizedEmail && existingUser.isVerified === false) {
        existingUser.username = normalizedUsername;
        existingUser.password = hashedPassword;
        existingUser.verificationOtp = otp;
        existingUser.verificationOtpExpires = expiry;
        existingUser.verificationToken = verificationToken;
        existingUser.verificationTokenExpires = expiry;
        await existingUser.save();

        // Send Brevo verification email asynchronously
        sendVerificationEmail(normalizedEmail, {
          username: normalizedUsername,
          verificationToken,
          otp
        }).catch((err) => console.error('[registerUser] Verification email dispatch error:', err.message));

        return res.status(200).json({
          success: true,
          requireVerification: true,
          email: normalizedEmail,
          message: 'A fresh 6-digit OTP has been sent to your email. Please verify to activate your account.'
        });
      }

      const isEmailDuplicate = existingUser.email === normalizedEmail;
      return res.status(400).json({
        success: false,
        error: isEmailDuplicate
          ? 'User with this email already exists'
          : 'User with this username already exists'
      });
    }

    // Create new unverified user
    const newUser = new User({
      username: normalizedUsername,
      email: normalizedEmail,
      password: hashedPassword,
      role: 'user',
      isVerified: false,
      verificationOtp: otp,
      verificationOtpExpires: expiry,
      verificationToken,
      verificationTokenExpires: expiry
    });

    await newUser.save();

    // Send Brevo verification email containing 6-digit OTP and direct activation link
    sendVerificationEmail(normalizedEmail, {
      username: normalizedUsername,
      verificationToken,
      otp
    }).catch((err) => console.error('[registerUser] Verification email dispatch error:', err.message));

    return res.status(201).json({
      success: true,
      requireVerification: true,
      email: normalizedEmail,
      message: 'Account created! Please enter the 6-digit verification code sent to your email.'
    });
  } catch (error) {
    console.error('Error in registerUser / signup:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};

/**
 * Verify Registration OTP
 * POST /api/auth/verify-otp
 * Verifies the 6-digit code, activates user account (isVerified = true), and returns JWT
 */
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        error: 'Please provide both email and 6-digit OTP'
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'No account found with this email address'
      });
    }

    // If already verified
    if (user.isVerified) {
      const payload = {
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          role: user.role || 'user'
        },
        role: user.role || 'user'
      };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
      return res.status(200).json({
        success: true,
        token,
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          role: user.role || 'user'
        },
        message: 'Account is already verified.'
      });
    }

    // Verify OTP match and expiration
    if (!user.verificationOtp || user.verificationOtp !== cleanOtp) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification OTP code. Please check and try again.'
      });
    }

    if (!user.verificationOtpExpires || new Date() > new Date(user.verificationOtpExpires)) {
      return res.status(400).json({
        success: false,
        error: 'Verification code has expired. Please request a new OTP.'
      });
    }

    // Mark account verified and clear OTP
    user.isVerified = true;
    user.verificationOtp = undefined;
    user.verificationOtpExpires = undefined;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    // Sign JWT
    const payload = {
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role || 'user'
      },
      role: user.role || 'user'
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role || 'user'
      },
      message: '🎉 Account verified successfully! Welcome to iMovies.'
    });
  } catch (error) {
    console.error('Error in verifyOtp:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to verify OTP'
    });
  }
};

/**
 * Verify Email Token (Direct Link clicked from email)
 * GET or POST /api/auth/verify-email
 */
const verifyEmailToken = async (req, res) => {
  try {
    const token = req.query.token || req.body.token;
    const email = req.query.email || req.body.email;

    if (!token || !email) {
      return res.status(400).json({
        success: false,
        error: 'Verification token and email are required'
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(200).json({ success: true, message: 'Account is already verified.' });
    }

    if (!user.verificationToken || user.verificationToken !== token) {
      return res.status(400).json({ success: false, error: 'Invalid verification link.' });
    }

    if (!user.verificationTokenExpires || new Date() > new Date(user.verificationTokenExpires)) {
      return res.status(400).json({ success: false, error: 'Verification link has expired.' });
    }

    user.isVerified = true;
    user.verificationOtp = undefined;
    user.verificationOtpExpires = undefined;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    // If browser GET request, redirect to frontend with verified query parameter
    if (req.method === 'GET') {
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      return res.redirect(`${clientUrl}/login?verified=true&email=${encodeURIComponent(normalizedEmail)}`);
    }

    const payload = {
      user: { id: user._id, email: user.email, username: user.username, role: user.role || 'user' },
      role: user.role || 'user'
    };
    const jwtToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    return res.status(200).json({
      success: true,
      token: jwtToken,
      user: { id: user._id, email: user.email, username: user.username, role: user.role || 'user' },
      message: 'Account verified successfully!'
    });
  } catch (error) {
    console.error('Error in verifyEmailToken:', error);
    return res.status(500).json({ success: false, error: error.message || 'Verification failed' });
  }
};

/**
 * Resend Verification OTP
 * POST /api/auth/resend-otp
 */
const resendVerificationOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ success: false, error: 'No account found with this email' });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, error: 'Account is already verified. Please sign in.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 15 * 60 * 1000);

    user.verificationOtp = otp;
    user.verificationOtpExpires = expiry;
    user.verificationToken = verificationToken;
    user.verificationTokenExpires = expiry;
    await user.save();

    sendVerificationEmail(normalizedEmail, {
      username: user.username,
      verificationToken,
      otp
    }).catch((err) => console.error('[resendVerificationOtp] Email error:', err.message));

    return res.status(200).json({
      success: true,
      message: 'A fresh 6-digit verification code has been dispatched to your email.'
    });
  } catch (error) {
    console.error('Error in resendVerificationOtp:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to resend OTP' });
  }
};

/**
 * Login existing User
 * Verifies email, password, and account activation status
 */
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find user by email
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // CHECK EMAIL VERIFICATION: Unverified accounts cannot log in
    if (user.isVerified === false) {
      // Generate a fresh OTP and resend email automatically so user can activate immediately
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const expiry = new Date(Date.now() + 15 * 60 * 1000);

      user.verificationOtp = otp;
      user.verificationOtpExpires = expiry;
      user.verificationToken = verificationToken;
      user.verificationTokenExpires = expiry;
      await user.save();

      sendVerificationEmail(user.email, {
        username: user.username,
        verificationToken,
        otp
      }).catch((err) => console.error('[loginUser] Verification email error:', err.message));

      return res.status(403).json({
        success: false,
        requireVerification: true,
        email: user.email,
        error: 'Your email address is not verified yet. We just sent a fresh 6-digit OTP to your inbox.'
      });
    }

    // Sign JWT
    const payload = {
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role || 'user'
      },
      role: user.role || 'user'
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role || 'user'
      }
    });
  } catch (error) {
    console.error('Error in loginUser:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};

/**
 * Forgot Password Request
 * POST /api/auth/forgot-password
 * Generates recovery OTP and reset link, sending via Brevo
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email address is required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'No registered user account found with this email address.'
      });
    }

    const resetOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    user.resetPasswordOtp = resetOtp;
    user.resetPasswordOtpExpires = expiry;
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = expiry;
    await user.save();

    // Send Brevo recovery email
    sendPasswordResetEmail(normalizedEmail, {
      username: user.username,
      resetToken,
      otp: resetOtp
    }).catch((err) => console.error('[forgotPassword] Reset email dispatch error:', err.message));

    return res.status(200).json({
      success: true,
      email: normalizedEmail,
      message: 'Password reset OTP and recovery link have been sent to your email.'
    });
  } catch (error) {
    console.error('Error in forgotPassword:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to process request' });
  }
};

/**
 * Verify Password Reset OTP
 * POST /api/auth/verify-reset-otp
 */
const verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, error: 'Email and OTP are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (!user.resetPasswordOtp || user.resetPasswordOtp !== cleanOtp) {
      return res.status(400).json({ success: false, error: 'Invalid password reset code' });
    }

    if (!user.resetPasswordOtpExpires || new Date() > new Date(user.resetPasswordOtpExpires)) {
      return res.status(400).json({ success: false, error: 'Password reset code has expired' });
    }

    return res.status(200).json({
      success: true,
      message: 'Code verified successfully. Please enter your new password.'
    });
  } catch (error) {
    console.error('Error in verifyResetOtp:', error);
    return res.status(500).json({ success: false, error: error.message || 'Verification failed' });
  }
};

/**
 * Reset Password
 * POST /api/auth/reset-password
 * Accepts email, newPassword, and either otp OR token
 */
const resetPassword = async (req, res) => {
  try {
    const { email, otp, token, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ success: false, error: 'Email and new password are required' });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters long' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    let isValid = false;

    // Check OTP
    if (otp && user.resetPasswordOtp && user.resetPasswordOtp === String(otp).trim()) {
      if (user.resetPasswordOtpExpires && new Date() <= new Date(user.resetPasswordOtpExpires)) {
        isValid = true;
      }
    }

    // Check Token
    if (!isValid && token && user.resetPasswordToken && user.resetPasswordToken === String(token).trim()) {
      if (user.resetPasswordExpires && new Date() <= new Date(user.resetPasswordExpires)) {
        isValid = true;
      }
    }

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired password reset credentials. Please request a new OTP.'
      });
    }

    // Hash and update password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetPasswordOtp = undefined;
    user.resetPasswordOtpExpires = undefined;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.isVerified = true; // Email confirmed via reset process

    await user.save();

    return res.status(200).json({
      success: true,
      message: '🎉 Your password has been successfully reset. You can now sign in with your new password.'
    });
  } catch (error) {
    console.error('Error in resetPassword:', error);
    return res.status(500).json({ success: false, error: error.message || 'Password reset failed' });
  }
};

/**
 * Validate User Token
 * Requires fetchUser middleware applied at route level
 * Returns current authenticated user data
 */
const validateUserToken = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid token payload'
      });
    }

    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role || 'user'
      }
    });
  } catch (error) {
    console.error('Error in validateUserToken:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};

/**
 * Register a new Admin
 * Validates fields, checks duplicates in Admin model
 * Hashes password, signs JWT with { admin: { id, email, username } }
 */
const registerAdmin = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide username, email, and password'
      });
    }

    if (username.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Username must be at least 3 characters long'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim();

    // Check for duplicate in Admin model
    const existingAdmin = await Admin.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }]
    });

    if (existingAdmin) {
      const isEmailDuplicate = existingAdmin.email === normalizedEmail;
      return res.status(400).json({
        success: false,
        error: isEmailDuplicate
          ? 'Admin with this email already exists'
          : 'Admin with this username already exists'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create admin
    const newAdmin = new Admin({
      username: normalizedUsername,
      email: normalizedEmail,
      password: hashedPassword,
      role: 'admin'
    });

    const savedAdmin = await newAdmin.save();

    // Sign JWT
    const payload = {
      admin: {
        id: savedAdmin._id,
        email: savedAdmin.email,
        username: savedAdmin.username,
        role: 'admin'
      },
      role: 'admin'
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    return res.status(201).json({
      success: true,
      token,
      admin: {
        id: savedAdmin._id,
        email: savedAdmin.email,
        username: savedAdmin.username,
        role: 'admin'
      }
    });
  } catch (error) {
    console.error('Error in registerAdmin:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};

/**
 * Login existing Admin
 * Verifies email and password against Admin collection
 * Returns signed JWT and admin details
 */
const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find admin by email
    const admin = await Admin.findOne({ email: normalizedEmail });
    if (!admin) {
      return res.status(400).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Sign JWT
    const payload = {
      admin: {
        id: admin._id,
        email: admin.email,
        username: admin.username,
        role: 'admin'
      },
      role: 'admin'
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    return res.status(200).json({
      success: true,
      token,
      admin: {
        id: admin._id,
        email: admin.email,
        username: admin.username,
        role: 'admin'
      }
    });
  } catch (error) {
    console.error('Error in loginAdmin:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};

/**
 * Validate Admin Token
 * Requires fetchAdmin middleware applied at route level
 * Returns current authenticated admin data
 */
const validateAdminToken = async (req, res) => {
  try {
    if (!req.admin || !req.admin.id) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid admin token payload'
      });
    }

    const admin = await Admin.findById(req.admin.id).select('-password');
    if (!admin) {
      return res.status(404).json({
        success: false,
        error: 'Admin not found'
      });
    }

    return res.status(200).json({
      success: true,
      admin: {
        id: admin._id,
        email: admin.email,
        username: admin.username,
        role: 'admin'
      }
    });
  } catch (error) {
    console.error('Error in validateAdminToken:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};


/**
 * Change password for authenticated user
 * PUT /api/auth/change-password
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ success: false, error: 'Current password is incorrect' });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    return res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to change password' });
  }
};

module.exports = {
  registerUser,
  signup: registerUser,
  loginUser,
  signin: loginUser,
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
};
