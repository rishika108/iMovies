import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import dayjs from 'dayjs';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Loader from '../components/Loader';
import API from '../utils/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFilm,
  faCalendarAlt,
  faMapMarkerAlt,
  faTicket,
  faClock,
  faTag,
  faArrowLeft
} from '@fortawesome/free-solid-svg-icons';

export default function MovieShows() {
  const { movieId } = useParams();
  const navigate = useNavigate();

  const [movie, setMovie] = useState(null);
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Generate next 7 dates
  const next7Days = Array.from({ length: 7 }, (_, i) => dayjs().add(i, 'day'));
  const [selectedDate, setSelectedDate] = useState(next7Days[0].format('YYYY-MM-DD'));

  useEffect(() => {
    const fetchMovieAndShows = async () => {
      setLoading(true);
      try {
        // Fetch Movie Details
        try {
          const isTmdb = movieId?.startsWith('tmdb_');
          const tmdbId = isTmdb ? movieId.replace('tmdb_', '') : null;
          const movieRes = isTmdb
            ? await API.get(`/movies/tmdb/${tmdbId}`)
            : await API.get(`/movies/${movieId}`);
          setMovie(movieRes.data?.movie || movieRes.data);
        } catch (movieErr) {
          console.warn('Movie details fetch warning:', movieErr);
        }

        // Fetch Shows for this movie
        const showsRes = await API.get(`/shows/movie/${movieId}`);
        const showData = showsRes.data?.shows || (Array.isArray(showsRes.data) ? showsRes.data : []);
        setShows(showData);
      } catch (err) {
        console.error('Error fetching shows for movie:', err);
      } finally {
        setLoading(false);
      }
    };

    if (movieId) {
      fetchMovieAndShows();
    }
  }, [movieId]);

  // Filter shows by selected date
  const filteredShows = shows.filter((s) => {
    if (!s.showDate) return false;
    const formattedShowDate = dayjs(s.showDate).format('YYYY-MM-DD');
    return (
      formattedShowDate === selectedDate ||
      s.showDate === selectedDate ||
      s.showDate.includes(selectedDate)
    );
  });

  // Group shows by theatreName
  const groupedByTheatre = filteredShows.reduce((acc, show) => {
    const theatreKey = show.theatreName || 'Cinepolis Multiplex';
    if (!acc[theatreKey]) {
      acc[theatreKey] = {
        theatreName: theatreKey,
        theatreId: show.theatreId,
        shows: [],
        prices: {
          balcony: 300,
          middle: 200,
          lower: 150
        }
      };

      // Extract pricing tiers from tickets if present
      if (show.tickets) {
        for (const key of Object.keys(show.tickets)) {
          const t = show.tickets[key];
          if (t && t.tier && t.price) {
            acc[theatreKey].prices[t.tier] = t.price;
          }
        }
      }
    }
    acc[theatreKey].shows.push(show);
    return acc;
  }, {});

  const movieTitle = movie?.movieName || movie?.name || movie?.title || 'Selected Movie';

  return (
    <div className="d-flex flex-column min-vh-100 bg-dark text-white" style={{ backgroundColor: 'var(--dark-bg)' }}>
      <Header />

      <main className="container-fluid flex-grow-1 px-3 px-md-5 py-4" style={{ maxWidth: '1200px' }}>
        {/* Back and Title Bar */}
        <div className="mb-4">
          <button
            onClick={() => navigate(-1)}
            className="btn btn-sm btn-outline-secondary mb-3 d-inline-flex align-items-center gap-2"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            <span>Back</span>
          </button>

          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 pb-3 border-bottom border-dark">
            <div>
              <span className="badge bg-danger text-uppercase px-2 py-1 mb-2">Showtimes</span>
              <h2 className="fw-bold mb-1 text-white d-flex align-items-center gap-2">
                <FontAwesomeIcon icon={faFilm} style={{ color: 'var(--primary-red)' }} />
                <span>{movieTitle}</span>
              </h2>
              {movie?.certification && (
                <span className="text-secondary small">
                  Rated {movie.certification} • {movie.language || 'English'}
                </span>
              )}
            </div>

            {/* Pricing Legend */}
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <span className="small text-secondary fw-semibold me-1">Tiers:</span>
              <span className="badge bg-dark border border-secondary px-2 py-1 text-light">
                Balcony: ₹300
              </span>
              <span className="badge bg-dark border border-secondary px-2 py-1 text-light">
                Middle: ₹200
              </span>
              <span className="badge bg-dark border border-secondary px-2 py-1 text-light">
                Lower: ₹150
              </span>
            </div>
          </div>
        </div>

        {/* Date Selector Tabs */}
        <div className="mb-4 overflow-auto pb-2">
          <div className="d-flex gap-2" style={{ minWidth: 'max-content' }}>
            {next7Days.map((dateObj) => {
              const dateStr = dateObj.format('YYYY-MM-DD');
              const isSelected = selectedDate === dateStr;
              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => setSelectedDate(dateStr)}
                  className={`btn py-2 px-3 text-center rounded-3 border-0 transition-all ${
                    isSelected
                      ? 'btn-danger shadow'
                      : 'btn-dark text-secondary'
                  }`}
                  style={
                    isSelected
                      ? { backgroundColor: 'var(--primary-red)', minWidth: '85px' }
                      : { backgroundColor: '#141824', minWidth: '85px', border: '1px solid #23293b' }
                  }
                >
                  <div className="small fw-semibold text-uppercase" style={{ fontSize: '0.75rem' }}>
                    {dateObj.format('ddd')}
                  </div>
                  <div className="fs-5 fw-bold text-white">
                    {dateObj.format('DD')}
                  </div>
                  <div className="small text-uppercase opacity-75" style={{ fontSize: '0.75rem' }}>
                    {dateObj.format('MMM')}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Shows Listing */}
        {loading ? (
          <div className="py-5">
            <Loader message="Fetching available showtimes..." fullScreen={false} />
          </div>
        ) : Object.keys(groupedByTheatre).length === 0 ? (
          <div className="dark-card text-center py-5 px-3 my-4">
            <div className="mb-3 text-secondary" style={{ fontSize: '3rem' }}>
              <FontAwesomeIcon icon={faCalendarAlt} />
            </div>
            <h4 className="fw-bold text-white mb-2">No Shows Scheduled</h4>
            <p className="text-secondary mx-auto mb-4" style={{ maxWidth: '420px' }}>
              There are no showtimes available for this movie on {dayjs(selectedDate).format('MMMM D, YYYY')}. Please choose another date or explore other movies.
            </p>
            <button
              className="btn btn-outline-custom"
              onClick={() => setSelectedDate(next7Days[0].format('YYYY-MM-DD'))}
            >
              Check Today's Shows
            </button>
          </div>
        ) : (
          <div className="d-flex flex-column gap-4">
            {Object.values(groupedByTheatre).map((theatreGroup) => (
              <div
                key={theatreGroup.theatreName}
                className="dark-card p-4 shadow-sm"
                style={{ border: '1px solid #23293b' }}
              >
                {/* Theatre Header */}
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mb-3 pb-3 border-bottom border-dark">
                  <div>
                    <h5 className="fw-bold text-white mb-1 d-flex align-items-center gap-2">
                      <FontAwesomeIcon icon={faMapMarkerAlt} className="text-danger" />
                      <span>{theatreGroup.theatreName}</span>
                    </h5>
                    <span className="text-secondary small">
                      Dolby 7.1 Surround • 4K Laser Projection • Recliner Seating Available
                    </span>
                  </div>

                  {/* Pricing Tiers badges */}
                  <div className="d-flex gap-2">
                    <span className="badge bg-dark border border-secondary px-2 py-1 small">
                      Balcony: ₹{theatreGroup.prices.balcony}
                    </span>
                    <span className="badge bg-dark border border-secondary px-2 py-1 small">
                      Middle: ₹{theatreGroup.prices.middle}
                    </span>
                    <span className="badge bg-dark border border-secondary px-2 py-1 small">
                      Lower: ₹{theatreGroup.prices.lower}
                    </span>
                  </div>
                </div>

                {/* Showtimes Buttons Grid */}
                <div className="d-flex flex-wrap gap-3">
                  {theatreGroup.shows.map((show) => (
                    <button
                      key={show.showId}
                      type="button"
                      onClick={() => navigate(`/seatslug/${show.showId}`)}
                      className="btn btn-outline-light px-4 py-2 rounded-3 text-start transition-all hover-scale d-flex flex-column align-items-center"
                      style={{
                        backgroundColor: '#0d111b',
                        borderColor: '#2e374f',
                        minWidth: '130px'
                      }}
                    >
                      <span className="fw-bold text-white fs-6 mb-1">
                        <FontAwesomeIcon icon={faClock} className="me-1 text-danger small" />
                        {show.showTime}
                      </span>
                      <span className="badge bg-secondary bg-opacity-50 text-light px-2 py-1" style={{ fontSize: '0.75rem' }}>
                        Book Seats
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
