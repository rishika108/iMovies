const express = require('express');
const router  = express.Router();
const {
  getAllMovies,
  getMovieById,
  addMovie,
  updateMovie,
  deleteMovie,
  searchMovies,
  filterMovies,
  // TMDB live endpoints
  tmdbNowPlaying,
  tmdbPopular,
  tmdbTrending,
  tmdbTopRated,
  tmdbUpcoming,
  tmdbMoviesByGenre,
  tmdbSimilarMovies,
  tmdbMovieTrailer,
  tmdbSearchMovies,
  tmdbGetMovieById,
} = require('../controllers/movieController');
const fetchAdmin = require('../middlewares/fetchAdmin');

// ── TMDB live-data routes  (must come before /:id) ───────────────────────────
router.get('/tmdb/nowplaying',         tmdbNowPlaying);
router.get('/tmdb/popular',            tmdbPopular);
router.get('/tmdb/trending',           tmdbTrending);
router.get('/tmdb/toprated',           tmdbTopRated);
router.get('/tmdb/upcoming',           tmdbUpcoming);
router.get('/tmdb/genre/:genreId',     tmdbMoviesByGenre);
router.get('/tmdb/search',             tmdbSearchMovies);
router.get('/tmdb/:tmdbId/similar',    tmdbSimilarMovies);
router.get('/tmdb/:tmdbId/trailer',    tmdbMovieTrailer);
router.get('/tmdb/:tmdbId',            tmdbGetMovieById);

// ── Local DB routes ───────────────────────────────────────────────────────────
router.get('/',        getAllMovies);
router.get('/search',  searchMovies);
router.get('/filter',  filterMovies);
router.get('/:id',     getMovieById);

// ── Admin-protected mutations ─────────────────────────────────────────────────
router.post('/',       fetchAdmin, addMovie);
router.put('/:id',     fetchAdmin, updateMovie);
router.delete('/:id',  fetchAdmin, deleteMovie);

module.exports = router;
