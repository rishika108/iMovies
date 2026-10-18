import axios from 'axios';

const API = axios.create({
  baseURL: '/api'
});

// Interceptor to attach auth-token from localStorage
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('imovies-user-token');
    const adminToken = localStorage.getItem('imovies-admin-token');
    if (token) {
      config.headers['auth-token'] = token;
    }
    if (adminToken) {
      config.headers['admin-token'] = adminToken;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default API;
