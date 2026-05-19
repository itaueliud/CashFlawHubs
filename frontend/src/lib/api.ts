import axios from 'axios';

const getApiBaseUrl = () => {
  const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configuredApiUrl) {
    const normalized = configuredApiUrl.replace(/\/+$/, '');
    // Allow either NEXT_PUBLIC_API_URL=https://host or https://host/api
    return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
  }

  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api`;
  }

  return 'http://localhost:5000/api';
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

const getDeviceFingerprint = () => {
  if (typeof window === 'undefined') return '';
  const key = 'cfh-device-fingerprint';
  let fp = localStorage.getItem(key);
  if (!fp) {
    const seed = `${navigator.userAgent}|${navigator.platform}|${screen.width}x${screen.height}|${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
    fp = btoa(unescape(encodeURIComponent(seed))).slice(0, 64);
    localStorage.setItem(key, fp);
  }
  return fp;
};

// Inject token on every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    try {
      const stored = JSON.parse(localStorage.getItem('earnhub-auth') || '{}');
      const token = stored?.state?.token;
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch {}
    config.headers['Accept-Language'] = navigator.language || 'en';
    config.headers['x-timezone'] = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    config.headers['x-device-fingerprint'] = getDeviceFingerprint();
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('earnhub-auth');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
