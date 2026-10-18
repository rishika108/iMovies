import React from 'react';
import { Navigate } from 'react-router-dom';

export default function AdminProtection({ children }) {
  const adminToken = localStorage.getItem('imovies-admin-token');
  if (!adminToken) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
