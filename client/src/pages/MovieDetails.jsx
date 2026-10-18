import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Loader from '../components/Loader';
import StarRating from '../components/StarRating';
import MovieCard from '../components/MovieCard';
import TrailerModal from '../components/TrailerModal';
import API from '../utils/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHeart,
  faTicket,
  faStar,
  faClock,
  faLanguage,
  faCalendarAlt,
  faUserTie,
  faUsers,
  faCommentDots,
  faCheckCircle,
  faPlay,
  faCoins,
  faCircleCheck,
  faFilm
} from '@fortawesome/free-solid-svg-icons';

export default function MovieDetails() {
  const { movieId } = useParams();
  const navigate = useNavigate();

  const [movie, setMovie] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [avgRating, setAvgRating] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [trailerOpen, setTrailerOpen] = useState(false);

  // Review Form States
  const [userRating, setUserRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [username, setUsername] = useState('');

  const token = localStorage.getItem('imovies-user-token');

  // Load user info from localStorage
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('imovies-user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        setUserEmail(parsed.email || '');
        setUsername(parsed.username || '');
      }
    } catch (e) {
      console.error('Error loading stored user:', e);
    }
  }, []);

  // Fetch movie data & reviews
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch Movie Details (supports both TMDB and Local MongoDB movies)
        const isTmdb = movieId?.startsWith('tmdb_');
        const tmdbId = isTmdb ? movieId.replace('tmdb_', '') : null;
        const movieRes = isTmdb
          ? await API.get(`/movies/tmdb/${tmdbId}`)
          : await API.get(`/movies/${movieId}`);
        const movieData = movieRes.data?.movie || movieRes.data;
        setMovie(movieData);

        // Fetch Movie Reviews
        try {
          const reviewsRes = await API.get(`/reviews/movie/${movieId}`);
          const reviewsData = reviewsRes.data?.reviews || [];
          setReviews(reviewsData);
          setAvgRating(reviewsRes.data?.averageRating || 0);
        } catch (revErr) {
          console.warn('Reviews fetch warning:', revErr);
        }

        // Fetch Favorites status if user is logged in
        if (token) {
          try {
            const favRes = await API.get('/favorites');
            const favoritesList = favRes.data?.favorites || [];
            const isFav = favoritesList.some(
              (f) => (f.movieId === movieId) || (f.movie && (f.movie._id === movieId || f.movie.id === movieId))
            );
            setIsFavorite(isFav);
          } catch (favErr) {
            console.warn('Favorites status check warning:', favErr);
          }
        }
      } catch (err) {
        console.error('Error fetching movie details:', err);
        toast.error('Failed to load movie details');
      } finally {
        setLoading(false);
      }
    };

    if (movieId) {
      fetchData();
    }
  }, [movieId, token]);

  // Handle Toggle Favorite
  const handleToggleFavorite = async () => {
    if (!token) {
      toast.info('Please log in to add movies to your favorites');
      navigate('/login');
      return;
    }

    try {
      if (isFavorite) {
        await API.delete(`/favorites/${movieId}`);
        setIsFavorite(false);
        toast.info('Removed from Favorites');
      } else {
        await API.post('/favorites', { movieId });
        setIsFavorite(true);
        toast.success('Added to Favorites!');
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to update favorites';
      toast.error(msg);
    }
  };

  // Check if current user already submitted a review
  const hasReviewed = reviews.some(
    (r) => userEmail && r.userEmail && r.userEmail.toLowerCase() === userEmail.toLowerCase()
  );

  // Submit Review Handler
  const handleAddReview = async (e) => {
    e.preventDefault();

    if (!token) {
      toast.info('Please log in to submit a review');
      navigate('/login');
      return;
    }

    if (!reviewText.trim() || reviewText.trim().length < 10) {
      toast.error('Review text must be at least 10 characters long');
      return;
    }

    setSubmittingReview(true);
    try {
      const res = await API.post('/reviews', {
        movieId,
        rating: userRating,
        reviewText: reviewText.trim(),
        username: username || 'Verified Viewer'
      });

      if (res.data && res.data.success) {
        toast.success('Review submitted successfully!');
        setReviewText('');
        // Re-fetch reviews to update average and listing
        const reviewsRes = await API.get(`/reviews/movie/${movieId}`);
        setReviews(reviewsRes.data?.reviews || []);
        setAvgRating(reviewsRes.data?.averageRating || 0);
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to submit review';
      toast.error(msg);
    } finally {
      setSubmittingReview(false);
    }
  };

  const formatDuration = (val) => {
    if (!val) return '2h 15m';
    if (typeof val === 'number') {
      const hours = Math.floor(val / 60);
      const mins = val % 60;
      return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    }
    return val;
  };

  const formatCurrency = (val) => {
    if (!val || Number(val) === 0) return 'Undisclosed';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  if (loading) {
    return (
      <div className="min-vh-100 bg-dark text-white d-flex flex-column">
        <Header />
        <div className="flex-grow-1 d-flex align-items-center justify-content-center">
          <Loader message="Loading movie details..." fullScreen={false} />
        </div>
        <Footer />
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="min-vh-100 bg-dark text-white d-flex flex-column">
        <Header />
        <main className="container flex-grow-1 py-5 text-center">
          <div className="dark-card p-5 my-5">
            <h2 className="text-white fw-bold mb-3">Movie Not Found</h2>
            <p className="text-secondary mb-4">The movie you requested does not exist or may have been removed.</p>
            <button className="btn btn-primary-red" onClick={() => navigate('/home')}>
              Return to Movies
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const title = movie.movieName || movie.name || movie.title || 'Untitled Movie';
  const poster = movie.posterUrl || movie.poster || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=60';
  const backdrop = movie.backdropUrl || movie.posterUrl || poster;
  const genres = Array.isArray(movie.genres)
    ? movie.genres
    : typeof movie.genres === 'string'
    ? movie.genres.split(',').map((g) => g.trim())
    : ['Action', 'Drama'];
  const releaseFormatted = movie.releaseDate ? dayjs(movie.releaseDate).format('MMMM D, YYYY') : 'Coming Soon';
  
  // Cast items (support rich objects or strings)
  const castList = Array.isArray(movie.cast) ? movie.cast : [];
  const similarList = Array.isArray(movie.similarMovies) ? movie.similarMovies : [];

  return (
    <div className="d-flex flex-column min-vh-100 bg-dark text-white" style={{ backgroundColor: 'var(--dark-bg)' }}>
      <Header />

      <main className="flex-grow-1">
        {/* Full-width Hero Backdrop Section */}
        <section
          className="position-relative py-5 px-3 px-md-5"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(10, 10, 10, 0.96) 20%, rgba(10, 10, 10, 0.85) 65%, rgba(10, 10, 10, 0.96) 100%), url(${backdrop})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            borderBottom: '1px solid #23293b'
          }}
        >
          <div className="container" style={{ maxWidth: '1200px' }}>
            <div className="row g-4 align-items-center">
              {/* Poster Column */}
              <div className="col-12 col-md-4 col-lg-3 text-center text-md-start">
                <div
                  className="rounded-4 overflow-hidden shadow-lg mx-auto position-relative"
                  style={{
                    maxWidth: '280px',
                    border: '2px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.7)'
                  }}
                >
                  <img
                    src={poster}
                    alt={title}
                    className="w-100 h-100 object-fit-cover"
                    style={{ minHeight: '380px' }}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=60';
                    }}
                  />
                  {movie.trailerKey && (
                    <button
                      type="button"
                      className="btn position-absolute top-50 start-50 translate-middle rounded-circle d-flex align-items-center justify-content-center shadow-lg"
                      style={{
                        width: '64px',
                        height: '64px',
                        backgroundColor: 'rgba(229, 9, 20, 0.9)',
                        color: '#fff',
                        border: '3px solid #fff',
                        fontSize: '1.4rem'
                      }}
                      onClick={() => setTrailerOpen(true)}
                      title="Play Trailer"
                    >
                      <FontAwesomeIcon icon={faPlay} style={{ marginLeft: '4px' }} />
                    </button>
                  )}
                </div>
              </div>

              {/* Details Column */}
              <div className="col-12 col-md-8 col-lg-9">
                {/* Title & Badges */}
                <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                  <span className="badge bg-danger text-uppercase px-2 py-1 fw-bold">
                    {movie.certification || 'U/A'}
                  </span>
                  <span className="badge bg-secondary px-2 py-1">
                    {movie.language || 'English'}
                  </span>
                  {movie.source === 'tmdb' && (
                    <span
                      className="badge px-2 py-1 fw-bold"
                      style={{ backgroundColor: 'rgba(1, 180, 228, 0.95)', color: '#fff' }}
                    >
                      TMDB LIVE
                    </span>
                  )}
                  {movie.status && (
                    <span className="badge bg-dark border border-secondary px-2 py-1 text-light">
                      {movie.status}
                    </span>
                  )}
                </div>

                <h1 className="fw-extrabold display-5 text-white mb-1" style={{ fontWeight: 800 }}>
                  {title}
                </h1>

                {/* Tagline */}
                {movie.tagline && (
                  <p className="fst-italic text-secondary fs-6 mb-3 opacity-90">
                    "{movie.tagline}"
                  </p>
                )}

                {/* Rating & Duration Bar */}
                <div className="d-flex flex-wrap align-items-center gap-3 mb-3 text-secondary">
                  <div className="d-flex align-items-center gap-1">
                    <FontAwesomeIcon icon={faStar} className="text-warning" />
                    <span className="text-white fw-bold fs-5">
                      {movie.rating ? Number(movie.rating).toFixed(1) : (avgRating ? Number(avgRating).toFixed(1) : 'New')}
                    </span>
                    <span className="small text-secondary">
                      {movie.voteCount ? `(${movie.voteCount} TMDB votes)` : `(${reviews.length} reviews)`}
                    </span>
                  </div>
                  <span>•</span>
                  <div className="d-flex align-items-center gap-1">
                    <FontAwesomeIcon icon={faClock} />
                    <span>{formatDuration(movie.duration)}</span>
                  </div>
                  <span>•</span>
                  <div className="d-flex align-items-center gap-1">
                    <FontAwesomeIcon icon={faCalendarAlt} />
                    <span>{releaseFormatted}</span>
                  </div>
                </div>

                {/* Genre Badges */}
                <div className="d-flex flex-wrap gap-2 mb-3">
                  {genres.map((g, idx) => (
                    <span key={idx} className="genre-badge m-0">
                      {g}
                    </span>
                  ))}
                </div>

                {/* Description */}
                <p className="lead fs-6 text-light opacity-90 mb-4" style={{ lineHeight: 1.7, maxWidth: '850px' }}>
                  {movie.description || 'Experience the drama, thrill, and high-stakes excitement on the biggest screen.'}
                </p>

                {/* Director */}
                {movie.director && (
                  <div className="mb-4 d-flex align-items-center gap-2 text-secondary">
                    <FontAwesomeIcon icon={faUserTie} className="text-danger" />
                    <span>Directed by:</span>
                    <strong className="text-white">{movie.director}</strong>
                  </div>
                )}

                {/* Action CTA Buttons */}
                <div className="d-flex flex-wrap align-items-center gap-3">
                  <button
                    className="btn btn-primary-red px-4 py-2 fw-bold fs-5"
                    onClick={() => navigate(`/movieshows/${movieId}`)}
                  >
                    <FontAwesomeIcon icon={faTicket} />
                    <span>Book Tickets</span>
                  </button>

                  {movie.trailerKey && (
                    <button
                      type="button"
                      className="btn btn-outline-light px-4 py-2 fw-semibold fs-5 d-inline-flex align-items-center gap-2"
                      onClick={() => setTrailerOpen(true)}
                    >
                      <FontAwesomeIcon icon={faPlay} className="text-danger" />
                      <span>Watch Trailer</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className={`btn px-3 py-2 fw-semibold rounded-3 d-inline-flex align-items-center gap-2 transition-all ${
                      isFavorite ? 'btn-danger' : 'btn-outline-light'
                    }`}
                    onClick={handleToggleFavorite}
                    style={isFavorite ? { backgroundColor: 'var(--primary-red)', border: 'none' } : {}}
                  >
                    <FontAwesomeIcon icon={faHeart} style={{ opacity: isFavorite ? 1 : 0.5 }} />
                    <span>{isFavorite ? 'In Favorites' : 'Add to Favorites'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Content Section: Cast and Reviews */}
        <div className="container py-5" style={{ maxWidth: '1200px' }}>
          <div className="row g-5">
            {/* Left Column: Cast & Details */}
            <div className="col-12 col-lg-5">
              {/* Rich Cast Section */}
              <div className="dark-card p-4 mb-4">
                <h4 className="fw-bold text-white mb-3 d-flex align-items-center gap-2">
                  <FontAwesomeIcon icon={faUsers} style={{ color: 'var(--primary-red)' }} />
                  <span>Starring Cast</span>
                </h4>

                {castList.length === 0 ? (
                  <p className="text-secondary mb-0">Cast information unavailable.</p>
                ) : typeof castList[0] === 'object' ? (
                  <div className="d-flex flex-column gap-3">
                    {castList.slice(0, 6).map((actor, idx) => (
                      <div key={idx} className="d-flex align-items-center gap-3">
                        <div
                          className="rounded-circle overflow-hidden flex-shrink-0 bg-secondary"
                          style={{ width: '48px', height: '48px', border: '1px solid rgba(255,255,255,0.2)' }}
                        >
                          {actor.profileUrl ? (
                            <img src={actor.profileUrl} alt={actor.name} className="w-100 h-100 object-fit-cover" />
                          ) : (
                            <div className="w-100 h-100 d-flex align-items-center justify-content-center text-white small fw-bold">
                              {actor.name ? actor.name[0] : 'A'}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="fw-bold text-white fs-6">{actor.name}</div>
                          <div className="text-secondary small">{actor.character}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="d-flex flex-wrap gap-2">
                    {castList.map((actor, idx) => (
                      <span
                        key={idx}
                        className="badge bg-dark border border-secondary text-light px-3 py-2 rounded-pill fw-medium"
                      >
                        {actor}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Extra Movie & TMDB Info Card */}
              <div className="dark-card p-4">
                <h5 className="fw-bold text-white mb-3 d-flex align-items-center gap-2">
                  <FontAwesomeIcon icon={faFilm} className="text-danger" />
                  <span>Production & Details</span>
                </h5>
                <ul className="list-unstyled text-secondary mb-0 d-flex flex-column gap-2">
                  <li className="d-flex justify-content-between">
                    <span>Language:</span>
                    <span className="text-white">{movie.language || 'English'}</span>
                  </li>
                  <li className="d-flex justify-content-between">
                    <span>Certification:</span>
                    <span className="text-white">{movie.certification || 'U/A'}</span>
                  </li>
                  <li className="d-flex justify-content-between">
                    <span>Release Status:</span>
                    <span className="text-white">{movie.status || 'In Theatres'}</span>
                  </li>
                  {movie.budget > 0 && (
                    <li className="d-flex justify-content-between">
                      <span>Budget:</span>
                      <span className="text-white">{formatCurrency(movie.budget)}</span>
                    </li>
                  )}
                  {movie.revenue > 0 && (
                    <li className="d-flex justify-content-between">
                      <span>Box Office:</span>
                      <span className="text-white">{formatCurrency(movie.revenue)}</span>
                    </li>
                  )}
                  <li className="d-flex justify-content-between">
                    <span>Formats Available:</span>
                    <span className="text-white">2D, 3D, IMAX, 4DX, Atmos</span>
                  </li>
                  <li className="d-flex justify-content-between">
                    <span>Release Date:</span>
                    <span className="text-white">{releaseFormatted}</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Right Column: Reviews & Rating System */}
            <div className="col-12 col-lg-7">
              <div className="dark-card p-4">
                <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom border-dark">
                  <h4 className="fw-bold text-white mb-0 d-flex align-items-center gap-2">
                    <FontAwesomeIcon icon={faCommentDots} style={{ color: 'var(--primary-red)' }} />
                    <span>Audience Reviews</span>
                  </h4>
                  <span className="badge bg-danger bg-opacity-25 border border-danger text-danger px-3 py-1 rounded-pill fw-bold">
                    ★ {avgRating ? Number(avgRating).toFixed(1) : (movie.rating ? Number(movie.rating).toFixed(1) : 'New')} / 5.0
                  </span>
                </div>

                {/* Add Review Form */}
                <div className="p-3 mb-4 rounded-3" style={{ backgroundColor: '#0d111b', border: '1px solid #23293b' }}>
                  {!token ? (
                    <div className="text-center py-3">
                      <p className="text-secondary mb-2">Want to share your thoughts on this movie?</p>
                      <button
                        className="btn btn-sm btn-outline-danger px-3"
                        onClick={() => navigate('/login')}
                      >
                        Sign in to leave a review
                      </button>
                    </div>
                  ) : hasReviewed ? (
                    <div className="d-flex align-items-center gap-2 text-success py-2">
                      <FontAwesomeIcon icon={faCheckCircle} />
                      <span>Thank you! You have already reviewed this movie.</span>
                    </div>
                  ) : (
                    <form onSubmit={handleAddReview}>
                      <h6 className="fw-bold text-white mb-3">Write Your Review</h6>

                      {/* Star Rating Picker */}
                      <div className="mb-3 d-flex align-items-center gap-3">
                        <span className="text-secondary small fw-semibold">Your Rating:</span>
                        <StarRating
                          rating={userRating}
                          maxStars={5}
                          onRate={(stars) => setUserRating(stars)}
                          size="1.4rem"
                        />
                        <span className="fw-bold text-warning">{userRating} / 5</span>
                      </div>

                      {/* Review Text */}
                      <div className="mb-3">
                        <textarea
                          className="form-control form-dark"
                          rows="3"
                          placeholder="What did you think of the story, acting, and visuals? (Min 10 characters)"
                          value={reviewText}
                          onChange={(e) => setReviewText(e.target.value)}
                          minLength={10}
                          required
                        />
                      </div>

                      <div className="text-end">
                        <button
                          type="submit"
                          className="btn btn-primary-red btn-sm px-4"
                          disabled={submittingReview}
                        >
                          {submittingReview ? 'Submitting...' : 'Post Review'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Reviews List */}
                {reviews.length === 0 ? (
                  <div className="text-center py-4 text-secondary">
                    <p className="mb-0">No user reviews yet. Be the first to share your thoughts!</p>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {reviews.map((rev) => (
                      <div
                        key={rev._id}
                        className="p-3 rounded-3"
                        style={{ backgroundColor: '#141824', border: '1px solid #1f2638' }}
                      >
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div>
                            <span className="fw-bold text-white me-2">
                              {rev.username || 'Movie Buff'}
                            </span>
                            <span className="small text-secondary">
                              {rev.createdAt ? dayjs(rev.createdAt).format('MMM D, YYYY') : ''}
                            </span>
                          </div>
                          <div>
                            <StarRating rating={rev.rating || 5} readOnly={true} size="0.9rem" />
                          </div>
                        </div>
                        <p className="text-light opacity-90 small mb-0" style={{ lineHeight: 1.6 }}>
                          {rev.reviewText}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* More Like This (Similar TMDB Movies) */}
          {similarList.length > 0 && (
            <section className="mt-5 pt-4 border-top border-dark">
              <h3 className="genre-section-title mb-4">
                <span>🎬</span> More Like This
              </h3>
              <div className="genre-scroll-row pb-3">
                {similarList.map((simMovie) => (
                  <div key={simMovie._id} className="genre-scroll-card">
                    <MovieCard movie={simMovie} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <Footer />

      {/* Trailer Modal */}
      <TrailerModal
        isOpen={trailerOpen}
        onClose={() => setTrailerOpen(false)}
        trailerKey={movie.trailerKey}
        title={title}
      />
    </div>
  );
}
