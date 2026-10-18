import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Header from '../components/Header';
import Footer from '../components/Footer';
import MovieCard from '../components/MovieCard';
import Loader from '../components/Loader';
import API from '../utils/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeart, faTrash, faFilm } from '@fortawesome/free-solid-svg-icons';

export default function FavoriteShows() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const token = localStorage.getItem('imovies-user-token');

  const fetchFavorites = async () => {
    if (!token) {
      navigate('/login');
      return;
    }

    setLoading(true);
    try {
      const res = await API.get('/favorites');
      const list = res.data?.favorites || [];
      setFavorites(list);
    } catch (err) {
      console.error('Failed to load favorites:', err);
      toast.error('Unable to fetch your watchlist');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, []);

  const handleRemoveFavorite = async (e, movieId) => {
    e.stopPropagation();
    try {
      await API.delete(`/favorites/${movieId}`);
      toast.info('Movie removed from your watchlist');
      setFavorites((prev) => prev.filter((item) => (item.movieId !== movieId && item.movie?._id !== movieId)));
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to remove favorite';
      toast.error(msg);
    }
  };

  return (
    <div className="d-flex flex-column min-vh-100 bg-dark text-white" style={{ backgroundColor: 'var(--dark-bg)' }}>
      <Header />

      <main className="container-fluid flex-grow-1 px-3 px-md-5 py-4" style={{ maxWidth: '1400px' }}>
        {/* Title Bar */}
        <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom border-dark">
          <div>
            <h2 className="fw-bold mb-1 d-flex align-items-center gap-2">
              <FontAwesomeIcon icon={faHeart} style={{ color: 'var(--primary-red)' }} />
              <span>My Watchlist & Favorites</span>
            </h2>
            <p className="text-secondary mb-0">Saved blockbusters ready for your next cinema adventure</p>
          </div>
          <span className="badge bg-dark border border-secondary px-3 py-2 rounded-pill fs-6">
            Saved: {favorites.length}
          </span>
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-5">
            <Loader message="Loading your watchlist..." fullScreen={false} />
          </div>
        ) : favorites.length === 0 ? (
          <div className="dark-card text-center py-5 px-3 my-4">
            <div className="mb-3 text-secondary" style={{ fontSize: '3.5rem' }}>
              ❤️
            </div>
            <h4 className="fw-bold text-white mb-2">Your watchlist is empty.</h4>
            <p className="text-secondary mx-auto mb-4" style={{ maxWidth: '440px' }}>
              Browse movies and add to favorites to keep track of the films you can't wait to see!
            </p>
            <button className="btn btn-primary-red" onClick={() => navigate('/home')}>
              Browse Movies
            </button>
          </div>
        ) : (
          <div className="row g-4">
            {favorites.map((fav) => {
              const movieObj = fav.movie || {
                _id: fav.movieId,
                movieName: 'Saved Movie',
                posterUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=60'
              };
              const movieId = fav.movieId || movieObj._id;

              return (
                <div key={fav._id || movieId} className="col-12 col-sm-6 col-md-4 col-xl-3 d-flex flex-column">
                  <div className="position-relative flex-grow-1">
                    <MovieCard movie={movieObj} />
                    <button
                      type="button"
                      className="btn btn-sm btn-dark position-absolute top-0 end-0 m-2 rounded-circle border border-danger text-danger d-flex align-items-center justify-content-center shadow"
                      style={{ width: '36px', height: '36px', zIndex: 10, backgroundColor: 'rgba(10, 10, 10, 0.85)' }}
                      onClick={(e) => handleRemoveFavorite(e, movieId)}
                      title="Remove from favorites"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
