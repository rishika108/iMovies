const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || !JWT_SECRET.trim()) {
  throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is missing or empty.');
}

const fetchUser = (req, res, next) => {
  // Get token from auth-token header
  const token = req.header('auth-token') || req.headers['auth-token'];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Please authenticate using a valid token'
    });
  }

  try {
    const data = jwt.verify(token, JWT_SECRET);
    req.user = data.user !== undefined ? data.user : data;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Please authenticate using a valid token'
    });
  }
};

module.exports = fetchUser;
