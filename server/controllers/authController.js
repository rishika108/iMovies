const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const Admin = require('../models/adminModel');
const {
  sendVerificationEmail,
  sendPasswordResetEmail
} = require('../services/emailService');
const { CLIENT_URL } = require('../config/brevoConfig');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || !JWT_SECRET.trim()) {
  throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is missing or empty.');
}

/**
 * Register a new User
 * Validates username, email, password
 * Checks for duplicates
 * Hashes password with bcryptjs saltRounds=10
 * Generates secure verification token (24-hour expiration)
 * Dispatches verification email via Brevo
 * Signs JWT with { user: { id, email, username, role, isVerified } }, expires in 7d
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
    if (normalizedUsername.length < 3 || normalizedUsername.length > 20) {
      return res.status(400).json({
        success: false,
        error: 'Username must be between 3 and 20 characters long'
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email address'
      });
    }

    // Check for duplicate email or username
    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }]
    });

    if (existingUser) {
      const isEmailDuplicate = existingUser.email === normalizedEmail;
      return res.status(400).json({
        success: false,
        error: isEmailDuplicate
          ? 'User with this email already exists'
          : 'User with this username already exists'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate secure random verification token (32 bytes hex = 64 characters)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // SECURITY ENFORCEMENT: Force role to strictly 'user' and isVerified to false
    const newUser = new User({
      username: normalizedUsername,
      email: normalizedEmail,
      password: hashedPassword,
      role: 'user',
      isVerified: false,
      verificationToken,
      verificationTokenExpires,
      emailStatus: 'valid'
    });

    const savedUser = await newUser.save();
    console.log(`[authController.registerUser] Created user: ${savedUser.email} (ID: ${savedUser._id})`);

    // Asynchronously dispatch verification email via Brevo
    // Handled non-blockingly so intermittent email latency does not stall registration
    sendVerificationEmail(savedUser.email, verificationToken, savedUser.username)
      .then((mailRes) => {
        if (mailRes.success) {
          console.log(`[authController.registerUser] Verification email dispatched to ${savedUser.email} (MsgID: ${mailRes.messageId})`);
        } else {
          console.warn(`[authController.registerUser] Failed to send verification email to ${savedUser.email}:`, mailRes.error);
        }
      })
      .catch((mailErr) => {
        console.error(`[authController.registerUser] Exception sending verification email:`, mailErr.message);
      });

    return res.status(201).json({
      success: true,
      requiresVerification: true,
      message: 'Account created successfully! We have sent an authentication link to your email. Please verify your email to activate your account.',
      email: savedUser.email,
      user: {
        id: savedUser._id,
        email: savedUser.email,
        username: savedUser.username,
        role: 'user',
        isVerified: false
      }
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
 * Verify Email Address via Token
 * Validates verification token, marks account as isVerified: true, clears token
 * Supports both POST (API calls) and GET (email link clicks)
 */
const verifyEmail = async (req, res) => {
  try {
    const rawToken = req.query.token || req.body.token;

    if (!rawToken || typeof rawToken !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Verification token is required'
      });
    }

    const token = rawToken.trim();

    // Query user by verification token with active expiry
    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: new Date() }
    });

    if (!user) {
      // Check if user is already verified (in case they clicked the link twice)
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification token. Please request a new verification email.'
      });
    }

    // Activate user account
    user.isVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpires = null;
    await user.save();

    console.log(`[authController.verifyEmail] Email verified successfully for user: ${user.email}`);

    // If request originates from a browser navigation (GET with HTML accept header), redirect to frontend
    const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html');
    if (req.method === 'GET' && acceptsHtml && CLIENT_URL) {
      return res.redirect(`${CLIENT_URL}/login?verified=true&email=${encodeURIComponent(user.email)}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Your email address has been verified successfully! You now have full access to iMovies.',
      isVerified: true,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        isVerified: true
      }
    });
  } catch (error) {
    console.error('Error in verifyEmail:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error verifying email'
    });
  }
};

/**
 * Resend Email Verification Token
 * Generates fresh token and dispatches new email
 */
const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !String(email).trim()) {
      return res.status(400).json({
        success: false,
        error: 'Email address is required'
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    // OWASP security standard: avoid revealing whether an email exists or not
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a new verification link has been sent.'
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        error: 'This account has already been verified. Please log in directly.'
      });
    }

    // Generate new token & 24h expiration
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.verificationToken = verificationToken;
    user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    console.log(`[authController.resendVerification] Regenerated token for ${user.email}`);

    // Dispatch email
    const mailResult = await sendVerificationEmail(user.email, verificationToken, user.username);
    if (!mailResult.success) {
      console.warn(`[authController.resendVerification] Brevo dispatch warning:`, mailResult.error);
    }

    return res.status(200).json({
      success: true,
      message: 'A fresh verification link has been sent to your email address.'
    });
  } catch (error) {
    console.error('Error in resendVerification:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};

/**
 * Request Password Reset (Forgot Password Flow)
 * Generates a secure single-use reset token valid for 1 hour
 * Dispatches password recovery email via Brevo
 */
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !String(email).trim()) {
      return res.status(400).json({
        success: false,
        error: 'Please provide your registered email address'
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    // OWASP: Always return 200 with generic message to prevent account enumeration attacks
    if (!user) {
      console.log(`[authController.requestPasswordReset] Attempted reset for non-existent email: ${normalizedEmail}`);
      return res.status(200).json({
        success: true,
        message: 'If an account exists with that email, a password recovery link has been sent.'
      });
    }

    // Check if user has bounced email
    if (user.emailStatus === 'hard_bounce' || user.emailStatus === 'blocked' || user.emailStatus === 'spam') {
      console.warn(`[authController.requestPasswordReset] Skipping email dispatch for bounced/blocked address: ${user.email}`);
      return res.status(400).json({
        success: false,
        error: 'Email delivery to this address has been previously blocked or bounced. Please contact support.'
      });
    }

    // Generate secure random reset token (32 bytes hex)
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiration
    await user.save();

    console.log(`[authController.requestPasswordReset] Generated password reset token for: ${user.email}`);

    // Asynchronously dispatch recovery email
    const mailResult = await sendPasswordResetEmail(user.email, resetToken, user.username);
    if (!mailResult.success) {
      console.error(`[authController.requestPasswordReset] Brevo dispatch error for ${user.email}:`, mailResult.error);
    }

    return res.status(200).json({
      success: true,
      message: 'If an account exists with that email, a password recovery link has been sent.'
    });
  } catch (error) {
    console.error('Error in requestPasswordReset:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error processing password reset request'
    });
  }
};

/**
 * Reset Password with Token
 * Validates reset token and expiration, hashes new password, clears reset fields
 */
const resetPassword = async (req, res) => {
  try {
    const { token, password, newPassword, confirmPassword } = req.body;
    const resetToken = (token || req.query.token || '').trim();

    if (!resetToken) {
      return res.status(400).json({
        success: false,
        error: 'Password reset token is required'
      });
    }

    const targetPassword = newPassword || password;
    if (!targetPassword || String(targetPassword).length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters long'
      });
    }

    if (confirmPassword && confirmPassword !== targetPassword) {
      return res.status(400).json({
        success: false,
        error: 'Passwords do not match'
      });
    }

    // Find user with matching active reset token
    const user = await User.findOne({
      resetPasswordToken: resetToken,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Password reset link is invalid or has expired. Please request a new link.'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(targetPassword, salt);

    // Invalidate reset token immediately
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    console.log(`[authController.resetPassword] Password updated successfully for: ${user.email}`);

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully! You can now sign in with your new password.'
    });
  } catch (error) {
    console.error('Error in resetPassword:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error resetting password'
    });
  }
};

/**
 * Login existing User
 * Verifies email and password
 * Returns signed JWT and user details including isVerified status
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

    // Enforce email authentication: without verification, user cannot log in
    if (user.isVerified === false) {
      return res.status(403).json({
        success: false,
        isVerified: false,
        error: 'Email verification required. Please check your inbox and verify your email before logging in.',
        email: user.email
      });
    }

    // Sign JWT payload for authenticated user
    const payload = {
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role || 'user',
        isVerified: user.isVerified || false
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
        role: user.role || 'user',
        isVerified: user.isVerified || false,
        emailStatus: user.emailStatus || 'valid'
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
        role: user.role || 'user',
        isVerified: user.isVerified || false,
        emailStatus: user.emailStatus || 'valid'
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

    // Sign Admin JWT payload
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
  verifyEmail,
  resendVerification,
  requestPasswordReset,
  forgotPassword: requestPasswordReset,
  resetPassword,
  loginUser,
  signin: loginUser,
  validateUserToken,
  registerAdmin,
  loginAdmin,
  validateAdminToken,
  changePassword
};
