import React from 'react';
import { Navigate } from 'react-router-dom';

export default function UserProtection({ children }) {
  const token = localStorage.getItem('imovies-user-token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
