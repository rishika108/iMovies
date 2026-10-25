import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Loader from '../components/Loader';
import API from '../utils/api';
import { isShowExpired } from '../utils/timeHelper';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFilm,
  faCalendarAlt,
  faMapMarkerAlt,
  faClock,
  faArrowLeft,
  faBan,
  faBuilding,
  faFilter,
  faCheck,
  faRotateRight
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';

export default function MovieShows() {
  const { movieId } = useParams();
  const navigate = useNavigate();

  const [movie, setMovie] = useState(null);
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Generate next 7 dates
  const next7Days = Array.from({ length: 7 }, (_, i) => dayjs().add(i, 'day'));
  const [selectedDate, setSelectedDate] = useState(next7Days[0].format('YYYY-MM-DD'));
  const [selectedTheatreId, setSelectedTheatreId] = useState('all');

  const fetchMovieAndShows = async () => {
    setLoading(true);
    try {
      // 1. Fetch Movie Details
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

      // 2. Fetch Shows for this movie (supports multi-theater varied schedules)
      const showsRes = await API.get(`/shows/movie/${movieId}`);
      let showData = showsRes.data?.shows || (Array.isArray(showsRes.data) ? showsRes.data : []);

      // If returned shows are fewer than 12 (e.g. old 2-show legacy data in DB), automatically expand
      if (showData.length < 12) {
        try {
          const refreshRes = await API.post(`/shows/refresh/${movieId}`);
          if (refreshRes.data?.shows && refreshRes.data.shows.length > showData.length) {
            showData = refreshRes.data.shows;
          }
        } catch (rErr) {
          // non-blocking
        }
      }

      setShows(showData);
    } catch (err) {
      console.error('Error fetching shows for movie:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (movieId) {
      fetchMovieAndShows();
    }
  }, [movieId]);

  const handleRefreshShowtimes = async () => {
    setRefreshing(true);
    try {
      const res = await API.post(`/shows/refresh/${movieId}`);
      const freshShows = res.data?.shows || [];
      if (freshShows.length > 0) {
        setShows(freshShows);
        toast.success(`Expanded showtimes: 6 shows per theater loaded!`);
      } else {
        await fetchMovieAndShows();
      }
    } catch (err) {
      console.error('Failed to refresh showtimes:', err);
      toast.error('Unable to refresh showtimes');
    } finally {
      setRefreshing(false);
    }
  };

  // Filter shows by selected date
  const dateFilteredShows = useMemo(() => {
    return shows.filter((s) => {
      if (!s.showDate) return false;
      const formattedShowDate = dayjs(s.showDate).format('YYYY-MM-DD');
      return (
        formattedShowDate === selectedDate ||
        s.showDate === selectedDate ||
        s.showDate.includes(selectedDate)
      );
    });
  }, [shows, selectedDate]);

  // Group shows by unique theatre
  const groupedByTheatre = useMemo(() => {
    return dateFilteredShows.reduce((acc, show) => {
      const tKey = show.theatreId || show.theatreName || 'theatre_general';
      if (!acc[tKey]) {
        acc[tKey] = {
          theatreId: show.theatreId || tKey,
          theatreName: show.theatreName || 'Cinema Screen',
          location: show.location || 'Central Cineplex',
          screenName: show.screenName || 'Audi 1',
          facilities: show.facilities || ['Dolby 7.1', '4K Laser Projection', 'Recliner Seating Available'],
          shows: [],
          prices: {
            balcony: 300,
            middle: 200,
            lower: 150
          }
        };

        if (show.tickets) {
          for (const key of Object.keys(show.tickets)) {
            const t = show.tickets[key];
            if (t && t.tier && t.price) {
              acc[tKey].prices[t.tier] = t.price;
            }
          }
        }
      }
      acc[tKey].shows.push(show);
      return acc;
    }, {});
  }, [dateFilteredShows]);

  // Distinct theatres available for current date
  const availableTheatres = useMemo(() => {
    return Object.values(groupedByTheatre);
  }, [groupedByTheatre]);

  // Filter grouped theaters based on selectedTheatreId
  const displayedTheatres = useMemo(() => {
    if (selectedTheatreId === 'all') {
      return Object.values(groupedByTheatre);
    }
    const filtered = Object.values(groupedByTheatre).filter(
      (t) => t.theatreId === selectedTheatreId
    );
    return filtered;
  }, [groupedByTheatre, selectedTheatreId]);

  const movieTitle = movie?.movieName || movie?.name || movie?.title || 'Selected Movie';

  const handleSelectShow = (show, theatreGroup) => {
    const isExpired = show.isExpired !== undefined
      ? show.isExpired
      : isShowExpired(show.showDate, show.showTime);

    if (isExpired) return;

    const bookingPayload = {
      showId: show.showId,
      movieId: show.movieId,
      movieTitle,
      theatreId: show.theatreId || theatreGroup.theatreId,
      theatreName: show.theatreName || theatreGroup.theatreName,
      showDate: show.showDate,
      showTime: show.showTime,
      screenName: show.screenName || theatreGroup.screenName
    };

    try {
      localStorage.setItem('imovies-current-booking', JSON.stringify(bookingPayload));
    } catch (e) {
      // non-blocking
    }

    navigate(`/seatslug/${show.showId}`, {
      state: bookingPayload
    });
  };

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
              <span className="badge bg-danger text-uppercase px-2 py-1 mb-2">Multi-Theater Showtimes</span>
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

            {/* Actions & Pricing Legend */}
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <button
                type="button"
                onClick={handleRefreshShowtimes}
                disabled={refreshing}
                className="btn btn-sm btn-outline-danger px-3 rounded-pill d-inline-flex align-items-center gap-2 fw-semibold"
                title="Expand and refresh full 6 daily showtimes for each theater"
              >
                <FontAwesomeIcon icon={faRotateRight} className={refreshing ? 'fa-spin' : ''} />
                <span>{refreshing ? 'Loading 6 Shows...' : 'Refresh Showtimes (6/day)'}</span>
              </button>
              <span className="badge bg-dark border border-secondary px-2 py-1 text-light">
                Balcony: ₹300-₹400
              </span>
              <span className="badge bg-dark border border-secondary px-2 py-1 text-light">
                Middle: ₹200-₹280
              </span>
              <span className="badge bg-dark border border-secondary px-2 py-1 text-light">
                Lower: ₹140-₹180
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
                    isSelected ? 'btn-danger shadow' : 'btn-dark text-secondary'
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

        {/* Dynamic Theater Filter Bar */}
        {availableTheatres.length > 0 && (
          <div className="mb-4 p-3 rounded-4" style={{ backgroundColor: '#111520', border: '1px solid #23293b' }}>
            <div className="d-flex align-items-center gap-2 mb-2 text-secondary small fw-bold text-uppercase">
              <FontAwesomeIcon icon={faFilter} className="text-danger" />
              <span>Filter by Theater Location ({availableTheatres.length} Theaters Available)</span>
            </div>
            <div className="d-flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedTheatreId('all')}
                className={`btn btn-sm px-3 rounded-pill transition-all ${
                  selectedTheatreId === 'all'
                    ? 'btn-danger fw-bold shadow-sm'
                    : 'btn-outline-secondary text-light'
                }`}
              >
                All Theaters ({dateFilteredShows.length} Shows)
              </button>

              {availableTheatres.map((theatre) => {
                const isSelected = selectedTheatreId === theatre.theatreId;
                return (
                  <button
                    key={theatre.theatreId}
                    type="button"
                    onClick={() => setSelectedTheatreId(theatre.theatreId)}
                    className={`btn btn-sm px-3 rounded-pill d-inline-flex align-items-center gap-2 transition-all ${
                      isSelected
                        ? 'btn-danger fw-bold shadow-sm'
                        : 'btn-outline-secondary text-light'
                    }`}
                  >
                    <FontAwesomeIcon icon={faBuilding} className={isSelected ? 'text-white' : 'text-danger'} />
                    <span>{theatre.theatreName}</span>
                    <span className="badge bg-dark border border-secondary text-light ms-1" style={{ fontSize: '0.7rem' }}>
                      {theatre.shows.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Shows Listing */}
        {loading ? (
          <div className="py-5">
            <Loader message="Fetching distinct theater schedules..." fullScreen={false} />
          </div>
        ) : displayedTheatres.length === 0 ? (
          <div className="dark-card text-center py-5 px-3 my-4">
            <div className="mb-3 text-secondary" style={{ fontSize: '3rem' }}>
              <FontAwesomeIcon icon={faCalendarAlt} />
            </div>
            <h4 className="fw-bold text-white mb-2">No Shows Scheduled</h4>
            <p className="text-secondary mx-auto mb-4" style={{ maxWidth: '420px' }}>
              No showtimes match the selected theater and date ({dayjs(selectedDate).format('MMMM D, YYYY')}).
            </p>
            <div className="d-flex gap-2 justify-content-center">
              {selectedTheatreId !== 'all' && (
                <button
                  className="btn btn-outline-secondary rounded-pill px-3"
                  onClick={() => setSelectedTheatreId('all')}
                >
                  View All Theaters
                </button>
              )}
              <button
                className="btn btn-danger rounded-pill px-4"
                onClick={() => setSelectedDate(next7Days[0].format('YYYY-MM-DD'))}
              >
                Check Today's Shows
              </button>
            </div>
          </div>
        ) : (
          <div className="d-flex flex-column gap-4">
            {displayedTheatres.map((theatreGroup) => (
              <div
                key={theatreGroup.theatreId}
                className="dark-card p-4 shadow-sm rounded-4"
                style={{ border: '1px solid #23293b' }}
              >
                {/* Theatre Header */}
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mb-3 pb-3 border-bottom border-dark">
                  <div>
                    <h5 className="fw-bold text-white mb-1 d-flex align-items-center gap-2">
                      <FontAwesomeIcon icon={faMapMarkerAlt} className="text-danger" />
                      <span>{theatreGroup.theatreName}</span>
                    </h5>
                    <div className="text-secondary small d-flex flex-wrap align-items-center gap-2 mt-1">
                      <span className="text-light fw-medium">{theatreGroup.screenName || 'Audi 1'}</span>
                      <span>•</span>
                      <span>{theatreGroup.facilities?.join(' • ') || 'Dolby 7.1 • 4K Laser'}</span>
                    </div>
                  </div>

                  {/* Pricing Tiers badges */}
                  <div className="d-flex gap-2 flex-wrap">
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

                {/* Multiple Daily Showtimes Chips Grid (4-6 shows per theater) */}
                <div>
                  <div className="text-secondary small fw-semibold text-uppercase mb-2" style={{ letterSpacing: '0.05em' }}>
                    Available Showtimes ({theatreGroup.shows.length} Shows Daily)
                  </div>
                  <div className="d-flex flex-wrap gap-3">
                    {theatreGroup.shows.map((show) => {
                      const expired = show.isExpired !== undefined
                        ? show.isExpired
                        : isShowExpired(show.showDate, show.showTime);

                      return (
                        <button
                          key={show.showId}
                          type="button"
                          onClick={() => handleSelectShow(show, theatreGroup)}
                          disabled={expired}
                          className={`btn px-4 py-2 rounded-3 text-start transition-all d-flex flex-column align-items-center ${
                            expired
                              ? 'btn-outline-secondary opacity-50'
                              : 'btn-outline-light hover-scale'
                          }`}
                          style={{
                            backgroundColor: expired ? '#10131c' : '#0d111b',
                            borderColor: expired ? '#22283a' : '#2e374f',
                            minWidth: '135px',
                            cursor: expired ? 'not-allowed' : 'pointer'
                          }}
                          title={expired ? 'This showtime has already passed' : `Book for ${show.showTime} at ${theatreGroup.theatreName}`}
                        >
                          <span className={`fw-bold fs-6 mb-1 ${expired ? 'text-secondary text-decoration-line-through' : 'text-white'}`}>
                            <FontAwesomeIcon icon={faClock} className={`me-1 small ${expired ? 'text-secondary' : 'text-danger'}`} />
                            {show.showTime}
                          </span>
                          {expired ? (
                            <span className="badge bg-danger bg-opacity-20 text-danger border border-danger border-opacity-25 px-2 py-1" style={{ fontSize: '0.7rem' }}>
                              <FontAwesomeIcon icon={faBan} className="me-1" />
                              Passed
                            </span>
                          ) : (
                            <span className="badge bg-success bg-opacity-20 text-success border border-success border-opacity-25 px-2 py-1" style={{ fontSize: '0.75rem' }}>
                              Book Seats
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
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
