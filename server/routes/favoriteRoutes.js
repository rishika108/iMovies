const express = require('express');
const router = express.Router();
const {
  addFavorite,
  removeFavorite,
  getUserFavorites
} = require('../controllers/favoriteController');
const fetchUser = require('../middlewares/fetchUser');

router.post('/', fetchUser, addFavorite);
router.delete('/:movieId', fetchUser, removeFavorite);
router.get('/', fetchUser, getUserFavorites);

module.exports = router;
