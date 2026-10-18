import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import MovieCard from '../components/MovieCard';
import TrailerModal from '../components/TrailerModal';
import Loader from '../components/Loader';
import API from '../utils/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSearch,
  faFire,
  faFilm,
  faStar,
  faCalendarAlt,
  faArrowTrendUp,
  faPlay,
  faTicket,
  faClapperboard,
  faRotateRight,
} from '@fortawesome/free-solid-svg-icons';

const LANGUAGES = [
  'All Languages',
  'English',
  'Hindi',
  'Tamil',
  'Telugu',
  'Malayalam',
  'Kannada',
];

const COUNTRIES = [
  { code: 'all', name: 'All Locations / Countries', icon: '🌍' },
  { code: 'IN',  name: 'India',                     icon: '🇮🇳' },
  { code: 'US',  name: 'USA',                       icon: '🇺🇸' },
  { code: 'KR',  name: 'South Korea',               icon: '🇰🇷' },
  { code: 'JP',  name: 'Japan',                     icon: '🇯🇵' },
  { code: 'GB',  name: 'United Kingdom',            icon: '🇬🇧' },
  { code: 'FR',  name: 'France',                    icon: '🇫🇷' },
  { code: 'ES',  name: 'Spain',                     icon: '🇪🇸' },
];

const TMDB_GENRES = [
  { id: 'all', name: '✨ All Categories' },
  { id: 28,    name: '💥 Action' },
  { id: 35,    name: '😂 Comedy' },
  { id: 878,   name: '🚀 Sci-Fi' },
  { id: 27,    name: '👻 Horror' },
  { id: 10749, name: '❤️ Romance' },
  { id: 53,    name: '🔪 Thriller' },
  { id: 16,    name: '🎨 Animation' },
  { id: 12,    name: '🗺️ Adventure' },
  { id: 18,    name: '🎭 Drama' },
];

const TMDB_SECTIONS = [
  { key: 'trending',   label: '⚡ Trending Today',          endpoint: '/movies/tmdb/trending',   icon: faFire },
  { key: 'nowplaying', label: '🎬 In Theatres (Now Playing)', endpoint: '/movies/tmdb/nowplaying', icon: faFilm },
  { key: 'popular',    label: '🔥 Global Blockbusters',       endpoint: '/movies/tmdb/popular',    icon: faArrowTrendUp },
  { key: 'toprated',   label: '⭐ All-Time Classics',         endpoint: '/movies/tmdb/toprated',   icon: faStar },
  { key: 'upcoming',   label: '📅 Coming Soon to Cinemas',    endpoint: '/movies/tmdb/upcoming',   icon: faCalendarAlt },
];

export default function Home() {
  const navigate = useNavigate();
  const [username, setUsername]                 = useState('');
  const [searchQuery, setSearchQuery]           = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('All Languages');
  const [selectedCountry, setSelectedCountry]   = useState('all');
  const [selectedGenre, setSelectedGenre]       = useState('all');
  const [genreMovies, setGenreMovies]           = useState([]);
  const [genreLoading, setGenreLoading]         = useState(false);
  const [searchResults, setSearchResults]       = useState([]);
  const [searchLoading, setSearchLoading]       = useState(false);

  // Trailer modal state
  const [trailerData, setTrailerData] = useState({ isOpen: false, key: '', title: '' });

  // Section data: { [key]: { movies, loading, error } }
  const [sections, setSections] = useState(
    Object.fromEntries(TMDB_SECTIONS.map(({ key }) => [key, { movies: [], loading: true, error: null }]))
  );

  const debounceTimer = useRef(null);

  // ── Load username ──────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem('imovies-user');
      if (stored) {
        const p = JSON.parse(stored);
        setUsername(p.username || (p.email ? p.email.split('@')[0] : 'Movie Lover'));
      }
    } catch (_) {}
  }, []);

  // ── Fetch curated sections ─────────────────────────────────────────────────
  useEffect(() => {
    TMDB_SECTIONS.forEach(({ key, endpoint }) => {
      API.get(endpoint)
        .then((res) => {
          setSections((prev) => ({
            ...prev,
            [key]: { movies: res.data?.movies || [], loading: false, error: null },
          }));
        })
        .catch((err) => {
          console.error(`TMDB section ${key} error:`, err.message);
          setSections((prev) => ({
            ...prev,
            [key]: { movies: [], loading: false, error: 'Failed to load' },
          }));
        });
    });
  }, []);

  // ── Fetch movies when a Genre Pill is selected ─────────────────────────────
  useEffect(() => {
    if (selectedGenre === 'all') {
      setGenreMovies([]);
      return;
    }
    setGenreLoading(true);
    API.get(`/movies/tmdb/genre/${selectedGenre}`)
      .then((res) => {
        setGenreMovies(res.data?.movies || []);
      })
      .catch((err) => {
        console.error('Genre fetch error:', err.message);
        setGenreMovies([]);
      })
      .finally(() => setGenreLoading(false));
  }, [selectedGenre]);

  // ── Debounced TMDB search ─────────────────────────────────────────────────
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await API.get(`/movies/tmdb/search?q=${encodeURIComponent(trimmed)}`);
        const results = res.data?.movies || [];
        setSearchResults(results);
      } catch (err) {
        console.error('TMDB search error:', err.message);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 350);

    return () => clearTimeout(debounceTimer.current);
  }, [searchQuery]);

  const isSearching = searchQuery.trim() !== '';
  const isGenreSelected = selectedGenre !== 'all';

  // ── Filter movies in each section by language and country ─────────────────
  const filterMovies = (moviesList) => {
    if (!Array.isArray(moviesList)) return [];
    return moviesList.filter((m) => {
      // 1. Language filter
      if (selectedLanguage !== 'All Languages') {
        const langMatch = m.language?.toLowerCase() === selectedLanguage.toLowerCase();
        if (!langMatch) return false;
      }
      // 2. Country / Location filter
      if (selectedCountry !== 'all') {
        const target = selectedCountry.toUpperCase();
        const originList = (Array.isArray(m.originCountry) ? m.originCountry : [m.originCountry])
          .filter(Boolean)
          .map((c) => String(c).toUpperCase());
        const countryCode = (m.countryCode || '').toUpperCase();
        const countryName = (m.country || '').toLowerCase();

        const countryNames = {
          IN: 'india',
          US: 'usa',
          KR: 'south korea',
          JP: 'japan',
          GB: 'united kingdom',
          FR: 'france',
          ES: 'spain',
        };

        const targetName = countryNames[target] || '';
        const codeMatch = originList.includes(target) || countryCode === target;
        const nameMatch = targetName ? countryName.includes(targetName) : false;

        // Inferred mapping from language if metadata is absent
        let inferredCode = '';
        const langLower = (m.language || '').toLowerCase();
        if (['hindi', 'tamil', 'telugu', 'malayalam', 'kannada'].includes(langLower)) inferredCode = 'IN';
        else if (langLower === 'korean') inferredCode = 'KR';
        else if (langLower === 'japanese') inferredCode = 'JP';
        else if (langLower === 'french') inferredCode = 'FR';
        else if (langLower === 'spanish') inferredCode = 'ES';

        const inferredMatch = inferredCode === target;

        if (!codeMatch && !nameMatch && !inferredMatch) {
          return false;
        }
      }
      return true;
    });
  };

  // Hero movie (top trending item)
  const heroMovie = sections.trending.movies[0] || sections.popular.movies[0] || null;

  // Open trailer for hero movie
  const handleOpenHeroTrailer = async (movie) => {
    if (!movie) return;
    try {
      const tmdbId = movie._id?.replace('tmdb_', '') || movie.tmdbId;
      const res = await API.get(`/movies/tmdb/${tmdbId}/trailer`);
      if (res.data?.trailerKey) {
        setTrailerData({ isOpen: true, key: res.data.trailerKey, title: movie.movieName });
      } else {
        window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(movie.movieName + ' trailer')}`, '_blank');
      }
    } catch (_) {
      window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(movie.movieName + ' trailer')}`, '_blank');
    }
  };

  // ── Horizontal scroll row component ──────────────────────────────────────
  const SectionRow = ({ sectionKey, label, icon: Icon }) => {
    const { movies, loading, error } = sections[sectionKey] || { movies: [], loading: false, error: null };
    const filtered = filterMovies(movies);

    return (
      <div className="mb-5">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h5 className="genre-section-title mb-0">
            {Icon && <FontAwesomeIcon icon={Icon} className="me-2 text-danger" />}
            <span>{label}</span>
            {!loading && (
              <span
                className="badge bg-secondary rounded-pill fw-normal ms-2"
                style={{ fontSize: '0.72rem' }}
              >
                {filtered.length}
              </span>
            )}
          </h5>
        </div>

        {loading ? (
          <div className="d-flex gap-3 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="genre-scroll-card rounded-3"
                style={{
                  height: '320px',
                  background: 'linear-gradient(110deg, #1a1a2e 30%, #16213e 50%, #1a1a2e 70%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.5s infinite',
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
        ) : error ? (
          <p className="text-secondary small">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="text-secondary small">No movies available for the selected country / language.</p>
        ) : (
          <div className="genre-scroll-row">
            {filtered.map((movie) => (
              <div key={movie._id} className="genre-scroll-card">
                <MovieCard movie={movie} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="d-flex flex-column min-vh-100" style={{ backgroundColor: 'var(--dark-bg)' }}>
      <Header />

      <main className="container-fluid flex-grow-1 px-3 px-md-5 py-4" style={{ maxWidth: '1440px' }}>
        {/* ── Top Welcome & Stats Bar ── */}
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 pb-3 border-bottom border-dark">
          <div>
            <h2 className="fw-bold mb-1">
              Welcome back,{' '}
              <span style={{ color: 'var(--primary-red)' }}>
                {username || 'Movie Enthusiast'}
              </span>!
            </h2>
            <p className="text-secondary mb-0">
              Live box-office blockbusters, trending releases, trailers & real-time tickets.
            </p>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <span className="badge bg-danger bg-opacity-25 border border-danger text-danger px-3 py-2 rounded-pill fw-semibold">
              <FontAwesomeIcon icon={faFire} className="me-1" /> Live TMDB Market
            </span>
            <span className="badge bg-info bg-opacity-25 border border-info text-info px-3 py-2 rounded-pill fw-semibold">
              <FontAwesomeIcon icon={faClapperboard} className="me-1" /> HD Trailers Ready
            </span>
          </div>
        </div>

        {/* ── Hero Spotlight Banner (Top Trending Release) ── */}
        {!isSearching && !isGenreSelected && heroMovie && (
          <div
            className="rounded-4 overflow-hidden mb-5 position-relative p-4 p-md-5 shadow-lg"
            style={{
              backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.92) 25%, rgba(0,0,0,0.7) 65%, rgba(0,0,0,0.85) 100%), url(${heroMovie.backdropUrl || heroMovie.posterUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              border: '1px solid rgba(255,255,255,0.15)',
              minHeight: '340px',
            }}
          >
            <div className="row align-items-center" style={{ minHeight: '260px' }}>
              <div className="col-12 col-lg-8">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <span className="badge bg-danger text-uppercase px-2 py-1 fw-bold" style={{ fontSize: '0.72rem' }}>
                    🔥 #1 TRENDING NOW
                  </span>
                  <span className="badge bg-dark border border-secondary px-2 py-1 text-light small">
                    {heroMovie.certification || 'U/A'}
                  </span>
                  <span className="badge bg-secondary px-2 py-1 text-light small">
                    {heroMovie.language}
                  </span>
                  {heroMovie.rating > 0 && (
                    <span className="badge bg-warning text-dark px-2 py-1 fw-bold small">
                      ★ {heroMovie.rating}
                    </span>
                  )}
                </div>

                <h1 className="display-5 fw-extrabold text-white mb-2" style={{ fontWeight: 800 }}>
                  {heroMovie.movieName}
                </h1>

                <p
                  className="lead fs-6 text-light opacity-90 mb-4"
                  style={{ maxWidth: '640px', lineHeight: 1.6 }}
                >
                  {heroMovie.description?.slice(0, 200)}...
                </p>

                <div className="d-flex flex-wrap gap-3">
                  <button
                    className="btn btn-primary-red px-4 py-2 fw-bold"
                    onClick={() => navigate(`/movieshows/${heroMovie._id}`)}
                  >
                    <FontAwesomeIcon icon={faTicket} className="me-2" />
                    Book Tickets
                  </button>
                  <button
                    className="btn btn-outline-light px-4 py-2 fw-semibold d-inline-flex align-items-center gap-2"
                    onClick={() => handleOpenHeroTrailer(heroMovie)}
                  >
                    <FontAwesomeIcon icon={faPlay} className="text-danger" />
                    <span>Watch Trailer</span>
                  </button>
                  <button
                    className="btn btn-dark border border-secondary px-3 py-2 fw-semibold"
                    onClick={() => navigate(`/moviedetails/${heroMovie._id}`)}
                  >
                    More Info
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Search Bar, Genre Dropdown, Country Dropdown & Language Selector ── */}
        <div className="dark-card p-3 p-md-4 mb-4 shadow-sm" style={{ border: '1px solid #23293b' }}>
          <div className="row g-3 align-items-center">
            {/* Search Input */}
            <div className="col-12 col-xl-4 col-lg-4">
              <div className="input-group">
                <span className="input-group-text border-end-0">
                  <FontAwesomeIcon icon={faSearch} />
                </span>
                <input
                  type="text"
                  className="form-control form-dark border-start-0 ps-0"
                  placeholder="Search TMDB market (e.g. Spider-Man, Avengers, Batman)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    className="btn btn-outline-secondary"
                    type="button"
                    onClick={() => setSearchQuery('')}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Genre Dropdown */}
            <div className="col-12 col-sm-6 col-md-4 col-xl-3 col-lg-3">
              <select
                className="form-select form-dark"
                value={selectedGenre}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedGenre(val === 'all' ? 'all' : Number(val));
                }}
                aria-label="Filter by Genre"
              >
                {TMDB_GENRES.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Country / Location Dropdown (beside Genre Dropdown) */}
            <div className="col-12 col-sm-6 col-md-4 col-xl-3 col-lg-3">
              <select
                className="form-select form-dark"
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                aria-label="Filter by Location / Country"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Language Dropdown */}
            <div className="col-12 col-sm-12 col-md-4 col-xl-2 col-lg-2">
              <select
                className="form-select form-dark"
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                aria-label="Filter by Language"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    🌐 {lang}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Active Filters Bar ── */}
        {(selectedCountry !== 'all' || selectedLanguage !== 'All Languages' || selectedGenre !== 'all') && (
          <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
            <span className="small text-secondary fw-semibold">Active Filters:</span>
            {selectedGenre !== 'all' && (
              <span className="badge bg-danger rounded-pill px-3 py-1 d-inline-flex align-items-center gap-1">
                {TMDB_GENRES.find((g) => g.id === selectedGenre)?.name}
                <button
                  type="button"
                  className="btn-close btn-close-white ms-1"
                  style={{ fontSize: '0.55rem' }}
                  onClick={() => setSelectedGenre('all')}
                  aria-label="Remove Genre Filter"
                />
              </span>
            )}
            {selectedCountry !== 'all' && (
              <span className="badge bg-primary rounded-pill px-3 py-1 d-inline-flex align-items-center gap-1">
                {COUNTRIES.find((c) => c.code === selectedCountry)?.icon} {COUNTRIES.find((c) => c.code === selectedCountry)?.name}
                <button
                  type="button"
                  className="btn-close btn-close-white ms-1"
                  style={{ fontSize: '0.55rem' }}
                  onClick={() => setSelectedCountry('all')}
                  aria-label="Remove Country Filter"
                />
              </span>
            )}
            {selectedLanguage !== 'All Languages' && (
              <span className="badge bg-secondary rounded-pill px-3 py-1 d-inline-flex align-items-center gap-1">
                🌐 {selectedLanguage}
                <button
                  type="button"
                  className="btn-close btn-close-white ms-1"
                  style={{ fontSize: '0.55rem' }}
                  onClick={() => setSelectedLanguage('All Languages')}
                  aria-label="Remove Language Filter"
                />
              </span>
            )}
            <button
              type="button"
              className="btn btn-link btn-sm text-secondary text-decoration-none p-0 ms-2"
              onClick={() => {
                setSelectedGenre('all');
                setSelectedCountry('all');
                setSelectedLanguage('All Languages');
              }}
            >
              Reset All
            </button>
          </div>
        )}

        {/* ── TMDB Genre Filter Pills ── */}
        {!isSearching && (
          <div className="mb-4 overflow-auto pb-2">
            <div className="d-flex gap-2" style={{ minWidth: 'max-content' }}>
              {TMDB_GENRES.map((g) => {
                const active = selectedGenre === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelectedGenre(g.id)}
                    className={`btn btn-sm px-3 py-2 rounded-pill fw-semibold transition-all ${
                      active
                        ? 'btn-danger shadow'
                        : 'btn-dark text-secondary'
                    }`}
                    style={
                      active
                        ? { backgroundColor: 'var(--primary-red)', border: 'none' }
                        : { backgroundColor: '#141824', border: '1px solid #23293b' }
                    }
                  >
                    {g.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Search Results Grid ── */}
        {isSearching && (
          <div className="mb-5">
            <div className="d-flex align-items-center justify-content-between mb-4 pb-2 border-bottom border-dark">
              <h4 className="fw-bold mb-0">
                Search Results for <span style={{ color: 'var(--primary-red)' }}>"{searchQuery}"</span>
              </h4>
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setSearchQuery('')}
              >
                <FontAwesomeIcon icon={faRotateRight} className="me-1" /> Clear
              </button>
            </div>

            {searchLoading ? (
              <div className="py-5">
                <Loader message="Searching TMDB global catalog..." fullScreen={false} />
              </div>
            ) : filterMovies(searchResults).length === 0 ? (
              <div className="dark-card text-center py-5 px-3">
                <div style={{ fontSize: '3rem' }}>🔍</div>
                <h4 className="fw-bold mt-2">No Movies Found</h4>
                <p className="text-secondary">
                  No market movies matched "{searchQuery}" with the current filters. Try adjusting country, language, or keywords.
                </p>
              </div>
            ) : (
              <div className="row g-4">
                {filterMovies(searchResults).map((movie) => (
                  <div key={movie._id} className="col-6 col-md-4 col-lg-3 col-xl-2 d-flex">
                    <MovieCard movie={movie} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Genre Grid (When a Specific Genre is Selected) ── */}
        {!isSearching && isGenreSelected && (
          <div className="mb-5">
            <div className="d-flex align-items-center justify-content-between mb-4 pb-2 border-bottom border-dark">
              <h4 className="fw-bold mb-0 d-flex align-items-center gap-2">
                <span>{TMDB_GENRES.find((g) => g.id === selectedGenre)?.name} Movies</span>
                {!genreLoading && (
                  <span className="badge bg-danger rounded-pill fw-normal ms-2 small">
                    {filterMovies(genreMovies).length}
                  </span>
                )}
              </h4>
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setSelectedGenre('all')}
              >
                View All Categories
              </button>
            </div>

            {genreLoading ? (
              <div className="py-5">
                <Loader message="Discovering genre movies from TMDB..." fullScreen={false} />
              </div>
            ) : filterMovies(genreMovies).length === 0 ? (
              <div className="dark-card text-center py-5 px-3">
                <p className="text-secondary mb-0">No movies found in this genre for the selected location or language.</p>
              </div>
            ) : (
              <div className="row g-4">
                {filterMovies(genreMovies).map((movie) => (
                  <div key={movie._id} className="col-6 col-md-4 col-lg-3 col-xl-2 d-flex">
                    <MovieCard movie={movie} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Curated TMDB Sections (When All Categories & Not Searching) ── */}
        {!isSearching && !isGenreSelected && (
          <div>
            {TMDB_SECTIONS.map(({ key, label, icon }) => (
              <SectionRow key={key} sectionKey={key} label={label} icon={icon} />
            ))}
          </div>
        )}
      </main>

      <Footer />

      {/* Hero Trailer Modal */}
      <TrailerModal
        isOpen={trailerData.isOpen}
        onClose={() => setTrailerData({ isOpen: false, key: '', title: '' })}
        trailerKey={trailerData.key}
        title={trailerData.title}
      />
    </div>
  );
}
