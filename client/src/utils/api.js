import axios from 'axios';

// Use environment variable with fallback to live Render backend
const rawBaseURL = import.meta.env.VITE_API_URL || 'https://imovies1802.onrender.com';

const API = axios.create({
  baseURL: rawBaseURL
});

// Interceptor to attach auth tokens and ensure clean URL resolution (preventing duplicate /api or missing /api)
API.interceptors.request.use(
  (config) => {
    // 1. Attach authentication tokens from localStorage
    const token = localStorage.getItem('imovies-user-token');
    const adminToken = localStorage.getItem('imovies-admin-token');
    if (token) {
      config.headers['auth-token'] = token;
    }
    if (adminToken) {
      config.headers['admin-token'] = adminToken;
    }

    // 2. Ensure /api is properly appended without duplication
    if (config.url && !config.url.startsWith('http://') && !config.url.startsWith('https://')) {
      const baseHasApi = config.baseURL && config.baseURL.replace(/\/+$/, '').endsWith('/api');
      const urlHasApi = config.url.replace(/^\/+/, '').startsWith('api/') || config.url === '/api' || config.url === 'api';

      if (baseHasApi && urlHasApi) {
        // Strip duplicate /api from relative URL if baseURL already contains /api
        config.url = config.url.replace(/^\/?api/, '');
        if (!config.url.startsWith('/')) {
          config.url = '/' + config.url;
        }
      } else if (!baseHasApi && !urlHasApi) {
        // Prepend /api to relative URL if baseURL does not contain /api
        const cleanUrl = config.url.startsWith('/') ? config.url : '/' + config.url;
        config.url = '/api' + cleanUrl;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default API;
