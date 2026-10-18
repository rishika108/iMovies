const mongoose = require('mongoose');
const Movie = require('../models/movieModel');
const tmdb  = require('../services/tmdbService');

// ─── TMDB Live Controllers ────────────────────────────────────────────────────

/** GET /api/movies/tmdb/nowplaying?page=1 */
const tmdbNowPlaying = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const result = await tmdb.getNowPlaying(page);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('tmdbNowPlaying error:', err.message);
    return res.status(502).json({ success: false, error: 'Failed to fetch now-playing movies from TMDB', movies: [] });
  }
};

/** GET /api/movies/tmdb/popular?page=1 */
const tmdbPopular = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const result = await tmdb.getPopular(page);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('tmdbPopular error:', err.message);
    return res.status(502).json({ success: false, error: 'Failed to fetch popular movies from TMDB', movies: [] });
  }
};

/** GET /api/movies/tmdb/toprated?page=1 */
const tmdbTopRated = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const result = await tmdb.getTopRated(page);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('tmdbTopRated error:', err.message);
    return res.status(502).json({ success: false, error: 'Failed to fetch top-rated movies from TMDB', movies: [] });
  }
};

/** GET /api/movies/tmdb/upcoming?page=1 */
const tmdbUpcoming = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const result = await tmdb.getUpcoming(page);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('tmdbUpcoming error:', err.message);
    return res.status(502).json({ success: false, error: 'Failed to fetch upcoming movies from TMDB', movies: [] });
  }
};

/** GET /api/movies/tmdb/search?q=avengers */
const tmdbSearchMovies = async (req, res) => {
  try {
    const query = (req.query.q || '').trim();
    if (!query) return res.status(400).json({ success: false, error: 'Search query is required', movies: [] });
    const page = parseInt(req.query.page) || 1;
    const result = await tmdb.searchMovies(query, page);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('tmdbSearchMovies error:', err.message);
    return res.status(502).json({ success: false, error: 'TMDB search failed', movies: [] });
  }
};

/** GET /api/movies/tmdb/:tmdbId — full detail with cast/director/trailer */
const tmdbGetMovieById = async (req, res) => {
  try {
    const { tmdbId } = req.params;
    const cleanId = tmdbId.startsWith('tmdb_') ? tmdbId.replace('tmdb_', '') : tmdbId;
    const movie = await tmdb.getMovieDetails(cleanId);
    return res.status(200).json({ success: true, movie });
  } catch (err) {
    console.error('tmdbGetMovieById error:', err.message);
    return res.status(502).json({ success: false, error: 'Failed to fetch movie details from TMDB' });
  }
};

/** GET /api/movies/tmdb/trending?timeWindow=day */
const tmdbTrending = async (req, res) => {
  try {
    const timeWindow = req.query.timeWindow === 'week' ? 'week' : 'day';
    const page = parseInt(req.query.page) || 1;
    const result = await tmdb.getTrending(timeWindow, page);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('tmdbTrending error:', err.message);
    return res.status(502).json({ success: false, error: 'Failed to fetch trending movies from TMDB', movies: [] });
  }
};

/** GET /api/movies/tmdb/genre/:genreId */
const tmdbMoviesByGenre = async (req, res) => {
  try {
    const { genreId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const result = await tmdb.getMoviesByGenre(genreId, page);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('tmdbMoviesByGenre error:', err.message);
    return res.status(502).json({ success: false, error: 'Failed to fetch movies by genre from TMDB', movies: [] });
  }
};

/** GET /api/movies/tmdb/:tmdbId/similar */
const tmdbSimilarMovies = async (req, res) => {
  try {
    const { tmdbId } = req.params;
    const cleanId = tmdbId.startsWith('tmdb_') ? tmdbId.replace('tmdb_', '') : tmdbId;
    const page = parseInt(req.query.page) || 1;
    const result = await tmdb.getSimilarMovies(cleanId, page);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('tmdbSimilarMovies error:', err.message);
    return res.status(502).json({ success: false, error: 'Failed to fetch similar movies from TMDB', movies: [] });
  }
};

/** GET /api/movies/tmdb/:tmdbId/trailer */
const tmdbMovieTrailer = async (req, res) => {
  try {
    const { tmdbId } = req.params;
    const cleanId = tmdbId.startsWith('tmdb_') ? tmdbId.replace('tmdb_', '') : tmdbId;
    const result = await tmdb.getMovieVideos(cleanId);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('tmdbMovieTrailer error:', err.message);
    return res.status(502).json({ success: false, error: 'Failed to fetch movie trailer from TMDB' });
  }
};


/**
 * Get all movies sorted by releaseDate descending
 */
const getAllMovies = async (req, res) => {
  try {
    const movies = await Movie.find({}).sort({ releaseDate: -1 });
    return res.status(200).json({
      success: true,
      count: movies.length,
      movies
    });
  } catch (error) {
    console.error('Error in getAllMovies:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch movies'
    });
  }
};

/**
 * Get single movie by MongoDB _id or TMDB virtual ID
 */
const getMovieById = async (req, res) => {
  try {
    const { id } = req.params;
    if (id && id.startsWith('tmdb_')) {
      const cleanId = id.replace('tmdb_', '');
      const movie = await tmdb.getMovieDetails(cleanId);
      return res.status(200).json({ success: true, movie });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        error: 'Movie not found'
      });
    }

    const movie = await Movie.findById(id);

    if (!movie) {
      return res.status(404).json({
        success: false,
        error: 'Movie not found'
      });
    }

    return res.status(200).json({
      success: true,
      movie
    });
  } catch (error) {
    console.error('Error in getMovieById:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch movie'
    });
  }
};

/**
 * Add a new movie
 * Requires admin authentication
 */
const addMovie = async (req, res) => {
  try {
    const {
      movieName,
      description,
      genres,
      releaseDate,
      language,
      duration,
      certification,
      posterUrl,
      trailerUrl,
      cast,
      director
    } = req.body;

    if (!movieName || !description || !genres || !releaseDate || !language || !duration) {
      return res.status(400).json({
        success: false,
        error: 'Please provide all required movie fields: movieName, description, genres, releaseDate, language, duration'
      });
    }

    const movie = new Movie({
      movieName,
      description,
      genres: Array.isArray(genres) ? genres : [genres],
      releaseDate,
      language,
      duration,
      certification: certification || 'U',
      posterUrl: posterUrl || '',
      trailerUrl: trailerUrl || '',
      cast: Array.isArray(cast) ? cast : (cast ? [cast] : []),
      director: director || ''
    });

    const savedMovie = await movie.save();

    return res.status(201).json({
      success: true,
      message: 'Movie added successfully',
      movie: savedMovie
    });
  } catch (error) {
    console.error('Error in addMovie:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to add movie'
    });
  }
};

/**
 * Update an existing movie by _id
 * Requires admin authentication
 */
const updateMovie = async (req, res) => {
  try {
    const { id } = req.params;

    const updatedMovie = await Movie.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!updatedMovie) {
      return res.status(404).json({
        success: false,
        error: 'Movie not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Movie updated successfully',
      movie: updatedMovie
    });
  } catch (error) {
    console.error('Error in updateMovie:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update movie'
    });
  }
};

/**
 * Delete a movie by _id
 * Requires admin authentication
 */
const deleteMovie = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedMovie = await Movie.findByIdAndDelete(id);

    if (!deletedMovie) {
      return res.status(404).json({
        success: false,
        error: 'Movie not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Movie deleted successfully',
      movie: deletedMovie
    });
  } catch (error) {
    console.error('Error in deleteMovie:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete movie'
    });
  }
};

/**
 * Search movies by name (case-insensitive substring match)
 * Query param: ?q=name
 */
const searchMovies = async (req, res) => {
  try {
    const query = req.query.q || '';
    const searchRegex = new RegExp(query.trim(), 'i');

    const movies = await Movie.find({
      movieName: { $regex: searchRegex }
    }).sort({ releaseDate: -1 });

    return res.status(200).json({
      success: true,
      count: movies.length,
      movies
    });
  } catch (error) {
    console.error('Error in searchMovies:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to search movies'
    });
  }
};

/**
 * Filter movies by genre and/or language
 * Query params: ?genre=Action&language=English
 */
const filterMovies = async (req, res) => {
  try {
    const { genre, language } = req.query;
    const filterQuery = {};

    if (genre && genre.trim() !== '') {
      filterQuery.genres = {
        $in: [new RegExp(`^${genre.trim()}$`, 'i')]
      };
    }

    if (language && language.trim() !== '') {
      filterQuery.language = {
        $regex: new RegExp(`^${language.trim()}$`, 'i')
      };
    }

    const movies = await Movie.find(filterQuery).sort({ releaseDate: -1 });

    return res.status(200).json({
      success: true,
      count: movies.length,
      movies
    });
  } catch (error) {
    console.error('Error in filterMovies:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to filter movies'
    });
  }
};

module.exports = {
  getAllMovies,
  getMovieById,
  addMovie,
  updateMovie,
  deleteMovie,
  searchMovies,
  filterMovies,
  // TMDB live data
  tmdbNowPlaying,
  tmdbPopular,
  tmdbTopRated,
  tmdbUpcoming,
  tmdbSearchMovies,
  tmdbGetMovieById,
  tmdbTrending,
  tmdbMoviesByGenre,
  tmdbSimilarMovies,
  tmdbMovieTrailer,
};

