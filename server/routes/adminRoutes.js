const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getAllUsers,
  deleteUser,
  getAllTransactions,
  refundBooking,
  createAdminAccount
} = require('../controllers/adminController');
const fetchAdmin = require('../middlewares/fetchAdmin');

// All admin dashboard management routes protected by fetchAdmin
router.get('/stats', fetchAdmin, getDashboardStats);
router.get('/users', fetchAdmin, getAllUsers);
router.delete('/users/:id', fetchAdmin, deleteUser);

// Admin transactions and refund management
router.get('/transactions', fetchAdmin, getAllTransactions);
router.post('/refund/:paymentId', fetchAdmin, refundBooking);

// Protected admin account provisioning
router.post('/create-admin', fetchAdmin, createAdminAccount);

module.exports = router;

