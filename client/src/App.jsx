import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import Loader from './components/Loader';
import UserProtection from './utils/UserProtection';
import AdminProtection from './utils/AdminProtection';
import { ThemeProvider } from './context/ThemeContext';

// Lazy load all pages
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Home = lazy(() => import('./pages/Home'));
const MovieDetails = lazy(() => import('./pages/MovieDetails'));
const MovieShows = lazy(() => import('./pages/MovieShows'));
const SeatSlug = lazy(() => import('./pages/SeatSlug'));
const Bookings = lazy(() => import('./pages/Bookings'));
const FavoriteShows = lazy(() => import('./pages/FavoriteShows'));
const Profile = lazy(() => import('./pages/Profile'));
const Admin = lazy(() => import('./pages/Admin'));
const AddMovie = lazy(() => import('./pages/AddMovie'));
const AddTheatre = lazy(() => import('./pages/AddTheatre'));
const AddShow = lazy(() => import('./pages/AddShow'));
const AddAdmin = lazy(() => import('./pages/AddAdmin'));
const AdminBookings = lazy(() => import('./pages/AdminBookings'));
const AdminTransactions = lazy(() => import('./pages/AdminTransactions'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Suspense fallback={<Loader />}>
          <ToastContainer position="top-right" theme="dark" autoClose={3000} />
          <Routes>
            <Route path="/" element={<Navigate to="/landing" replace />} />
            <Route path="/landing" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            {/* User Protected Routes */}
            <Route
              path="/home"
              element={
                <UserProtection>
                  <Home />
                </UserProtection>
              }
            />
            <Route
              path="/moviedetails/:movieId"
              element={
                <UserProtection>
                  <MovieDetails />
                </UserProtection>
              }
            />
            <Route
              path="/movieshows/:movieId"
              element={
                <UserProtection>
                  <MovieShows />
                </UserProtection>
              }
            />
            <Route
              path="/seatslug/:showId"
              element={
                <UserProtection>
                  <SeatSlug />
                </UserProtection>
              }
            />
            <Route
              path="/bookings"
              element={
                <UserProtection>
                  <Bookings />
                </UserProtection>
              }
            />
            <Route
              path="/favoriteshows"
              element={
                <UserProtection>
                  <FavoriteShows />
                </UserProtection>
              }
            />
            <Route
              path="/profile"
              element={
                <UserProtection>
                  <Profile />
                </UserProtection>
              }
            />
            {/* Admin Protected Routes */}
            <Route
              path="/admin"
              element={
                <AdminProtection>
                  <Admin />
                </AdminProtection>
              }
            />
            <Route
              path="/addmovie"
              element={
                <AdminProtection>
                  <AddMovie />
                </AdminProtection>
              }
            />
            <Route
              path="/addtheatre"
              element={
                <AdminProtection>
                  <AddTheatre />
                </AdminProtection>
              }
            />
            <Route
              path="/addshow"
              element={
                <AdminProtection>
                  <AddShow />
                </AdminProtection>
              }
            />
            <Route
              path="/addadmin"
              element={
                <AdminProtection>
                  <AddAdmin />
                </AdminProtection>
              }
            />
            <Route
              path="/adminbookings"
              element={
                <AdminProtection>
                  <AdminBookings />
                </AdminProtection>
              }
            />
            <Route
              path="/admintransactions"
              element={
                <AdminProtection>
                  <AdminTransactions />
                </AdminProtection>
              }
            />
            {/* Fallback 404 Route */}
            <Route path="*" element={<Navigate to="/landing" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}
