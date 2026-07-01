import axios from 'axios';

const STORAGE_KEY = 'admin-auth';

const resolveApiBaseUrl = () => {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configuredUrl) return `${configuredUrl.replace(/\/$/, '')}/api`;
  return process.env.NODE_ENV === 'development' ? 'http://localhost:5000/api' : '/api';
};

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.token) {
          (config.headers as any)['Authorization'] = `Bearer ${parsed.token}`;
        }
      }
    }
  } catch {}
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
