import axios from 'axios';

const STORAGE_KEY = 'admin-auth';
const DEFAULT_BACKEND_API = 'https://cashflawhubs-km48.onrender.com/api';
const LEGACY_BACKEND_API = 'https://cashflowhubs.onrender.com/api';

const resolveApiBaseUrl = () => {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configuredUrl) {
    const normalized = configuredUrl.replace(/\/+$/, '');
    if (normalized.includes('cashflowhubs.onrender.com')) {
      return DEFAULT_BACKEND_API;
    }
    return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
  }

  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:5000/api';
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (host === 'localhost' || host.startsWith('127.0.0.1')) {
      return 'http://localhost:5000/api';
    }

    if (host.endsWith('.cashflowhubs.com') || host === 'cashflowhubs.com') {
      return DEFAULT_BACKEND_API;
    }
  }

  return DEFAULT_BACKEND_API || LEGACY_BACKEND_API;
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
