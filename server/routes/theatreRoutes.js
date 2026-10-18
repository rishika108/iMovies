const express = require('express');
const router = express.Router();
const {
  getAllTheatres,
  getTheatreById,
  addTheatre,
  updateTheatre,
  deleteTheatre,
  getTheatresByAdmin
} = require('../controllers/theatreController');
const fetchAdmin = require('../middlewares/fetchAdmin');

// Public and admin-specific theatre query routes
router.get('/', getAllTheatres);
router.get('/admin', fetchAdmin, getTheatresByAdmin);
router.get('/:theatreId', getTheatreById);

// Admin-protected theatre mutation routes
router.post('/', fetchAdmin, addTheatre);
router.put('/:theatreId', fetchAdmin, updateTheatre);
router.delete('/:theatreId', fetchAdmin, deleteTheatre);

module.exports = router;
