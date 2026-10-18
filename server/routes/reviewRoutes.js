const express = require('express');
const router = express.Router();
const {
  addReview,
  updateReview,
  getMovieReviews,
  deleteReview
} = require('../controllers/reviewController');
const fetchUser = require('../middlewares/fetchUser');

// Public review retrieval for a movie
router.get('/movie/:movieId', getMovieReviews);

// User-protected review actions
router.post('/', fetchUser, addReview);
router.put('/:id', fetchUser, updateReview);
router.delete('/:id', fetchUser, deleteReview);

module.exports = router;
