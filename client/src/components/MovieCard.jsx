import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock, faTicket, faStar } from '@fortawesome/free-solid-svg-icons';

export default function MovieCard({ movie }) {
  const navigate = useNavigate();

  if (!movie) return null;

  const id = movie._id || movie.id;
  // Fallbacks: movieName is primary
  const title = movie.movieName || movie.name || movie.title || 'Untitled Movie';
  const poster =
    movie.posterUrl ||
    movie.poster ||
    movie.image ||
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=60';
  const certification = movie.certification || movie.cert || 'U/A';
  const language =
    movie.language ||
    (Array.isArray(movie.languages) ? movie.languages.join(', ') : 'English');

  let genres = [];
  if (Array.isArray(movie.genres)) {
    genres = movie.genres;
  } else if (Array.isArray(movie.genre)) {
    genres = movie.genre;
  } else if (typeof movie.genre === 'string') {
    genres = movie.genre.split(',').map((g) => g.trim());
  } else if (typeof movie.genres === 'string') {
    genres = movie.genres.split(',').map((g) => g.trim());
  }

  const formatDuration = (val) => {
    if (!val) return '';
    if (typeof val === 'number') {
      const hours = Math.floor(val / 60);
      const mins = val % 60;
      return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    }
    return val;
  };

  const handleCardClick = () => {
    if (id) navigate(`/moviedetails/${id}`);
  };

  const handleBookClick = (e) => {
    e.stopPropagation();
    if (id) navigate(`/movieshows/${id}`);
  };

  const ratingVal = movie.rating || movie.vote_average || 0;

  return (
    <div
      className="movie-card hover-scale h-100 d-flex flex-column position-relative"
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
    >
      {/* Poster */}
      <div className="position-relative overflow-hidden" style={{ height: '300px' }}>
        <img
          src={poster}
          alt={title}
          className="w-100 h-100"
          style={{ objectFit: 'cover', transition: 'transform 0.3s ease' }}
          onError={(e) => {
            e.target.onerror = null;
            e.target.src =
              'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=60';
          }}
        />

        {/* Cert badge top-left */}
        <div className="position-absolute top-0 start-0 m-2 d-flex gap-1 align-items-center">
          <span
            className="badge bg-dark bg-opacity-75 border border-secondary text-uppercase fw-semibold px-2 py-1"
            style={{ fontSize: '0.65rem' }}
          >
            {certification}
          </span>
          {movie.source === 'tmdb' && (
            <span
              className="badge px-2 py-1 fw-bold"
              style={{
                backgroundColor: 'rgba(1, 180, 228, 0.9)',
                color: '#fff',
                fontSize: '0.6rem',
                letterSpacing: '0.5px',
              }}
            >
              TMDB
            </span>
          )}
        </div>

        {/* Language badge top-right */}
        <div className="position-absolute top-0 end-0 m-2">
          <span
            className="badge fw-semibold"
            style={{ background: 'rgba(0,150,255,0.85)', fontSize: '0.65rem' }}
          >
            {language}
          </span>
        </div>

        {/* Star Rating badge bottom-left */}
        {ratingVal > 0 && (
          <div className="position-absolute bottom-0 start-0 m-2" style={{ zIndex: 1 }}>
            <span
              className="badge bg-dark bg-opacity-75 border border-warning text-warning fw-bold px-2 py-1 d-inline-flex align-items-center gap-1"
              style={{ fontSize: '0.7rem' }}
            >
              <FontAwesomeIcon icon={faStar} />
              <span>{Number(ratingVal).toFixed(1)}</span>
            </span>
          </div>
        )}

        {/* Hover overlay with Book Now */}
        <div
          className="book-overlay position-absolute bottom-0 start-0 w-100 px-3 pb-3"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, transparent 100%)',
            opacity: 0,
            transition: 'opacity 0.25s ease',
            zIndex: 3,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
        >
          <button
            className="btn btn-primary-red btn-sm w-100 fw-semibold"
            onClick={handleBookClick}
            style={{ fontSize: '0.82rem' }}
          >
            <FontAwesomeIcon icon={faTicket} className="me-1" />
            Book Now
          </button>
        </div>
      </div>

      {/* Details */}
      <div className="p-3 d-flex flex-column flex-grow-1 justify-content-between">
        <div>
          <h5
            className="fw-bold mb-2 text-truncate"
            title={title}
            style={{ fontSize: '0.95rem', lineHeight: 1.3 }}
          >
            {title}
          </h5>

          {/* Genres */}
          <div className="mb-2 d-flex flex-wrap gap-1">
            {genres.slice(0, 2).map((genre, idx) => (
              <span
                key={idx}
                className="genre-badge m-0"
                style={{ fontSize: '0.7rem', padding: '2px 8px' }}
              >
                {genre}
              </span>
            ))}
          </div>
        </div>

        {/* Meta row: duration + Book button */}
        <div className="mt-2 pt-2 border-top border-dark d-flex align-items-center justify-content-between">
          <span className="text-secondary small d-flex align-items-center gap-1">
            <FontAwesomeIcon icon={faClock} style={{ fontSize: '0.72rem' }} />
            <span>{movie.duration ? formatDuration(movie.duration) : '2h'}</span>
          </span>
          <button
            className="btn btn-sm px-2 py-1 fw-semibold"
            style={{
              background: 'rgba(229,9,20,0.15)',
              border: '1px solid var(--primary-red)',
              color: 'var(--primary-red)',
              fontSize: '0.7rem',
              borderRadius: '6px',
            }}
            onClick={handleBookClick}
          >
            <FontAwesomeIcon icon={faTicket} className="me-1" />
            Book
          </button>
        </div>
      </div>
    </div>
  );
}
