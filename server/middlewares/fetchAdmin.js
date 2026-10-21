const jwt = require('jsonwebtoken');
const Admin = require('../models/adminModel');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || !JWT_SECRET.trim()) {
  throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is missing or empty.');
}

/**
 * Middleware to authenticate and authorize administrator requests
 * Enforces:
 * 1. Valid JWT token provided in headers
 * 2. Token payload contains admin credentials and role === 'admin'
 * 3. Verified against the Admin collection in MongoDB
 */
const fetchAdmin = async (req, res, next) => {
  // Support admin-token header, auth-token header, or Authorization Bearer header
  let token = req.header('admin-token') || req.headers['admin-token'];

  if (!token) {
    const authHeader = req.header('authorization') || req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else if (req.header('auth-token') || req.headers['auth-token']) {
      token = req.header('auth-token') || req.headers['auth-token'];
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access denied. No admin authentication token provided.'
    });
  }

  try {
    const data = jwt.verify(token, JWT_SECRET);

    // Extract admin object & role from token payload
    const adminData = data.admin || (data.role === 'admin' ? data : null);
    const role = data.role || data.admin?.role || (data.admin ? 'admin' : (data.user?.role || 'user'));

    // Reject non-admin tokens
    if (!adminData || role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access forbidden. Administrator privileges required.'
      });
    }

    // Verify admin account exists in Admin database
    const adminId = adminData.id || adminData._id;
    if (adminId) {
      const adminExists = await Admin.findById(adminId);
      if (!adminExists) {
        return res.status(403).json({
          success: false,
          error: 'Access forbidden. Admin account not found.'
        });
      }

      req.admin = {
        id: adminExists._id,
        email: adminExists.email,
        username: adminExists.username,
        role: 'admin'
      };
    } else {
      req.admin = { ...adminData, role: 'admin' };
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token. Admin authentication failed.'
    });
  }
};

module.exports = fetchAdmin;
