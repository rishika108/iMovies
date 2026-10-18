const express = require('express');
const router = express.Router();
const {
  getAllShows,
  getShowById,
  getShowsByMovie,
  addShow,
  updateShow,
  deleteShow
} = require('../controllers/showController');
const fetchAdmin = require('../middlewares/fetchAdmin');

// Query routes (specific subpath /movie/:movieId before /:showId)
router.get('/', getAllShows);
router.get('/movie/:movieId', getShowsByMovie);
router.get('/:showId', getShowById);

// Admin-protected show management routes
router.post('/', fetchAdmin, addShow);
router.put('/:showId', fetchAdmin, updateShow);
router.delete('/:showId', fetchAdmin, deleteShow);

module.exports = router;
