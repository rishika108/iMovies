const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    minlength: 3,
    maxlength: 20,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    maxlength: 50,
    trim: true,
    lowercase: true
  },
    password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  // Account verification
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationOtp: {
    type: String
  },
  verificationOtpExpires: {
    type: Date
  },
  verificationToken: {
    type: String
  },
  verificationTokenExpires: {
    type: Date
  },
  // Password reset recovery
  resetPasswordOtp: {
    type: String
  },
  resetPasswordOtpExpires: {
    type: Date
  },
  resetPasswordToken: {
    type: String
  },
  resetPasswordExpires: {
    type: Date
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
