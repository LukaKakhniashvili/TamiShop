import axios from 'axios';
import i18n from '../i18n';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // არჩეული ენა — სერვერი შეცდომის კოდებს აბრუნებს, ტექსტს კი UI თარგმნის (src/i18n/errors.js)
  config.headers['Accept-Language'] = i18n.language || 'ka';
  return config;
});

export default api;
