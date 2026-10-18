/**
 * tmdbService.js
 * Centralised service layer for The Movie Database (TMDB) API.
 * All TMDB data is normalised to the iMovies internal schema so the
 * rest of the codebase never has to deal with raw TMDB field names.
 * Features: SChannel IPv4 curl fetching, automatic retry, and in-memory TTL caching.
 */

require('dotenv').config();
const { execFile } = require('child_process');

// ── Constants ────────────────────────────────────────────────────────────────
const BASE_URL = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const API_KEY  = process.env.TMDB_API_KEY  || 'c1f2e09dac496706b60f61178471177c';
const IMG_BASE = process.env.TMDB_IMAGE_BASE || 'https://image.tmdb.org/t/p/w500';

// In-memory cache map
const cache = new Map();

const getCached = (key) => {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  return item.data;
};

const setCached = (key, data, ttlMs = 5 * 60 * 1000) => {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
};

// TMDB genre_id → genre name mapping
const GENRE_MAP = {
  28:    'Action',
  12:    'Adventure',
  16:    'Animation',
  35:    'Comedy',
  80:    'Crime',
  99:    'Documentary',
  18:    'Drama',
  10751: 'Family',
  14:    'Fantasy',
  36:    'History',
  27:    'Horror',
  10402: 'Music',
  9648:  'Mystery',
  10749: 'Romance',
  878:   'Sci-Fi',
  10770: 'TV Movie',
  53:    'Thriller',
  10752: 'War',
  37:    'Western',
};

// Language code → readable name
const LANG_MAP = {
  en: 'English',
  hi: 'Hindi',
  ta: 'Tamil',
  te: 'Telugu',
  ml: 'Malayalam',
  kn: 'Kannada',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  it: 'Italian',
  pt: 'Portuguese',
};

// ISO 3166-1 country code → Country name
const COUNTRY_NAME_MAP = {
  IN: 'India',
  US: 'USA',
  KR: 'South Korea',
  JP: 'Japan',
  GB: 'United Kingdom',
  UK: 'United Kingdom',
  FR: 'France',
  ES: 'Spain',
  DE: 'Germany',
  IT: 'Italy',
  CN: 'China',
  CA: 'Canada',
  AU: 'Australia',
};

const resolveCountry = (raw, langCode) => {
  let codes = [];
  if (Array.isArray(raw?.origin_country) && raw.origin_country.length > 0) {
    codes = raw.origin_country;
  } else if (Array.isArray(raw?.production_countries) && raw.production_countries.length > 0) {
    codes = raw.production_countries.map((c) => c.iso_3166_1).filter(Boolean);
  }

  if (codes.length === 0) {
    if (['hi', 'ta', 'te', 'ml', 'kn'].includes(langCode)) codes = ['IN'];
    else if (langCode === 'ko') codes = ['KR'];
    else if (langCode === 'ja') codes = ['JP'];
    else if (langCode === 'fr') codes = ['FR'];
    else if (langCode === 'es') codes = ['ES'];
    else if (langCode === 'de') codes = ['DE'];
    else if (langCode === 'it') codes = ['IT'];
    else if (langCode === 'zh') codes = ['CN'];
    else codes = ['US'];
  }

  const primaryCode = (codes[0] || 'US').toUpperCase();
  const countryName = COUNTRY_NAME_MAP[primaryCode] || primaryCode;
  return {
    originCountry: codes.map((c) => c.toUpperCase()),
    country: countryName,
    countryCode: primaryCode,
  };
};

// Certification map per rating value from TMDB releases
const certForRating = (rating) => {
  if (rating >= 8)  return 'U';
  if (rating >= 6)  return 'UA';
  return 'A';
};

/**
 * Executes curl with automatic retries on network handshake resets.
 */
const tryCurl = (url, retries = 3) => {
  return new Promise((resolve, reject) => {
    const curlBin = process.platform === 'win32' ? 'C:\\Windows\\System32\\curl.exe' : 'curl';
    execFile(
      curlBin,
      ['-4', '-s', '--compressed', url],
      { maxBuffer: 10 * 1024 * 1024, encoding: 'utf8' },
      (err, stdout) => {
        if (!err && stdout) {
          try {
            const data = JSON.parse(stdout);
            return resolve(data);
          } catch (_) {}
        }
        if (retries > 0) {
          setTimeout(() => {
            tryCurl(url, retries - 1).then(resolve).catch(reject);
          }, 350);
        } else {
          reject(err || new Error('Failed to fetch from TMDB'));
        }
      }
    );
  });
};

/**
 * Cache-backed request utility
 */
const requestTmdb = async (endpoint, params = {}, ttlMs = 5 * 60 * 1000) => {
  const allParams = { api_key: API_KEY, language: 'en-US', ...params };
  const qs = new URLSearchParams(allParams).toString();
  const url = `${BASE_URL}${endpoint}${qs ? '?' + qs : ''}`;

  const cached = getCached(url);
  if (cached) return cached;

  const data = await tryCurl(url, 3);
  if (data) {
    setCached(url, data, ttlMs);
  }
  return data;
};

// ── Normaliser ───────────────────────────────────────────────────────────────
/**
 * Convert a raw TMDB movie object into the iMovies schema shape.
 * The returned object uses the same field names expected by the frontend
 * (movieName, posterUrl, genres[], language, description, releaseDate …).
 */
const normalise = (raw) => {
  const genres = (raw.genre_ids || []).map((id) => GENRE_MAP[id]).filter(Boolean);
  const langCode = raw.original_language || 'en';
  const language = LANG_MAP[langCode] || langCode.toUpperCase();
  const rating   = raw.vote_average || 0;
  const { originCountry, country, countryCode } = resolveCountry(raw, langCode);

  return {
    // Use tmdb_ prefix as a virtual _id so the rest of the app can navigate
    _id:         `tmdb_${raw.id}`,
    tmdbId:      raw.id,
    movieName:   raw.title || raw.original_title || 'Unknown Title',
    description: raw.overview || 'No description available.',
    genres:      genres.length ? genres : ['Drama'],
    releaseDate: raw.release_date || null,
    language,
    originCountry,
    country,
    countryCode,
    duration:    raw.runtime ? `${Math.floor(raw.runtime / 60)}h ${raw.runtime % 60}m` : null,
    certification: certForRating(rating),
    posterUrl:   raw.poster_path   ? `${IMG_BASE}${raw.poster_path}`   : '',
    backdropUrl: raw.backdrop_path ? `https://image.tmdb.org/t/p/w1280${raw.backdrop_path}` : '',
    trailerUrl:  '',
    rating:      Number(rating.toFixed(1)),
    voteCount:   raw.vote_count || 0,
    popularity:  raw.popularity || 0,
    cast:        [],
    director:    '',
    source:      'tmdb',   // flag so frontend knows this is live data
  };
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch now-playing movies (page 1 = up to 20 movies).
 */
const getNowPlaying = async (page = 1) => {
  const data = await requestTmdb('/movie/now_playing', { page }, 10 * 60 * 1000);
  return {
    page:        data.page,
    totalPages:  data.total_pages,
    totalResults: data.total_results,
    movies:      (data.results || []).map(normalise),
  };
};

/**
 * Fetch popular movies.
 */
const getPopular = async (page = 1) => {
  const data = await requestTmdb('/movie/popular', { page }, 10 * 60 * 1000);
  return {
    page,
    totalPages:  data.total_pages,
    totalResults: data.total_results,
    movies:      (data.results || []).map(normalise),
  };
};

/**
 * Fetch trending movies (day or week).
 */
const getTrending = async (timeWindow = 'day', page = 1) => {
  const validWindow = timeWindow === 'week' ? 'week' : 'day';
  const data = await requestTmdb(`/trending/movie/${validWindow}`, { page }, 10 * 60 * 1000);
  return {
    page:        data.page,
    totalPages:  data.total_pages,
    totalResults: data.total_results,
    movies:      (data.results || []).map(normalise),
  };
};

/**
 * Fetch top-rated movies.
 */
const getTopRated = async (page = 1) => {
  const data = await requestTmdb('/movie/top_rated', { page }, 10 * 60 * 1000);
  return {
    page,
    totalPages:  data.total_pages,
    totalResults: data.total_results,
    movies:      (data.results || []).map(normalise),
  };
};

/**
 * Fetch upcoming movies.
 */
const getUpcoming = async (page = 1) => {
  const data = await requestTmdb('/movie/upcoming', { page }, 10 * 60 * 1000);
  return {
    page,
    totalPages:  data.total_pages,
    totalResults: data.total_results,
    movies:      (data.results || []).map(normalise),
  };
};

/**
 * Fetch movies by TMDB genre ID (Discover API).
 */
const getMoviesByGenre = async (genreId, page = 1) => {
  const data = await requestTmdb('/discover/movie', { with_genres: genreId, page, sort_by: 'popularity.desc' }, 10 * 60 * 1000);
  return {
    page:        data.page,
    totalPages:  data.total_pages,
    totalResults: data.total_results,
    movies:      (data.results || []).map(normalise),
  };
};

/**
 * Fetch similar / recommended movies for a given TMDB movie.
 */
const getSimilarMovies = async (tmdbId, page = 1) => {
  const data = await requestTmdb(`/movie/${tmdbId}/similar`, { page }, 15 * 60 * 1000);
  return {
    page:        data.page,
    totalPages:  data.total_pages,
    totalResults: data.total_results,
    movies:      (data.results || []).map(normalise),
  };
};

/**
 * Fetch official trailers and video clips.
 */
const getMovieVideos = async (tmdbId) => {
  const data = await requestTmdb(`/movie/${tmdbId}/videos`, {}, 30 * 60 * 1000);
  const results = data.results || [];
  const youtubeVideos = results.filter((v) => v.site === 'YouTube');
  const officialTrailer = youtubeVideos.find((v) => v.type === 'Trailer') || youtubeVideos[0] || null;

  return {
    trailerKey: officialTrailer ? officialTrailer.key : null,
    trailerUrl: officialTrailer ? `https://www.youtube.com/watch?v=${officialTrailer.key}` : null,
    embedUrl:   officialTrailer ? `https://www.youtube.com/embed/${officialTrailer.key}` : null,
    videos:     youtubeVideos.slice(0, 5),
  };
};

/**
 * Get full details for a single TMDB movie by its TMDB id.
 * Also fetches credits so we can return rich cast with photos, director, and similar movies.
 */
const getMovieDetails = async (tmdbId) => {
  const [raw, credits] = await Promise.all([
    requestTmdb(`/movie/${tmdbId}`, { append_to_response: 'videos,similar' }, 30 * 60 * 1000),
    requestTmdb(`/movie/${tmdbId}/credits`, {}, 30 * 60 * 1000),
  ]);

  // Cast with photos & characters
  const rawCast = credits?.cast || [];
  const cast = rawCast.slice(0, 10).map((c) => ({
    name: c.name,
    character: c.character || 'Supporting Role',
    profileUrl: c.profile_path ? `${IMG_BASE}${c.profile_path}` : null,
  }));
  // String array fallback for legacy components
  const castNames = rawCast.slice(0, 8).map((c) => c.name);

  const directorObj = (credits?.crew || []).find((c) => c.job === 'Director');
  const director    = directorObj ? directorObj.name : '';

  // Trailer info
  const videos = raw?.videos?.results || [];
  const youtubeVideos = videos.filter((v) => v.site === 'YouTube');
  const officialTrailer = youtubeVideos.find((v) => v.type === 'Trailer') || youtubeVideos[0] || null;
  const trailerKey = officialTrailer ? officialTrailer.key : null;
  const trailerUrl = officialTrailer ? `https://www.youtube.com/watch?v=${officialTrailer.key}` : '';
  const embedUrl   = officialTrailer ? `https://www.youtube.com/embed/${officialTrailer.key}?autoplay=1` : '';

  const genres = (raw?.genres || []).map((g) => g.name);
  const langCode = raw?.original_language || 'en';
  const language = LANG_MAP[langCode] || langCode.toUpperCase();
  const rating   = raw?.vote_average || 0;
  const runtime  = raw?.runtime;
  const { originCountry, country, countryCode } = resolveCountry(raw, langCode);

  // Similar movies preview
  const similarMovies = (raw?.similar?.results || []).slice(0, 8).map(normalise);

  return {
    _id:         `tmdb_${raw?.id || tmdbId}`,
    tmdbId:      raw?.id || tmdbId,
    movieName:   raw?.title || raw?.original_title || 'Unknown Title',
    tagline:     raw?.tagline || '',
    description: raw?.overview || '',
    genres,
    releaseDate: raw?.release_date || null,
    status:      raw?.status || 'Released',
    budget:      raw?.budget || 0,
    revenue:     raw?.revenue || 0,
    language,
    originCountry,
    country,
    countryCode,
    duration:    runtime
      ? `${Math.floor(runtime / 60)}h ${runtime % 60}m`
      : 'N/A',
    certification: certForRating(rating),
    posterUrl:    raw?.poster_path   ? `${IMG_BASE}${raw.poster_path}`   : '',
    backdropUrl:  raw?.backdrop_path ? `https://image.tmdb.org/t/p/w1280${raw.backdrop_path}` : '',
    trailerUrl,
    trailerKey,
    embedUrl,
    rating:       Number(rating.toFixed(1)),
    voteCount:    raw?.vote_count || 0,
    popularity:   raw?.popularity || 0,
    cast,
    castNames,
    director,
    similarMovies,
    source: 'tmdb',
  };
};

/**
 * Search TMDB by movie title.
 */
const searchMovies = async (query, page = 1) => {
  const data = await requestTmdb('/search/movie', { query, page, include_adult: false }, 5 * 60 * 1000);
  return {
    page,
    totalPages:   data.total_pages,
    totalResults: data.total_results,
    movies:       (data.results || []).map(normalise),
  };
};

module.exports = {
  getNowPlaying,
  getPopular,
  getTrending,
  getTopRated,
  getUpcoming,
  getMoviesByGenre,
  getSimilarMovies,
  getMovieVideos,
  getMovieDetails,
  searchMovies,
  normalise,
  GENRE_MAP,
};
