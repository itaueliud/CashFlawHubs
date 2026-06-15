import axios from 'axios';
import { normalizeLanguage } from '@/i18n';

const getApiBaseUrl = () => {
  const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  const canonicalApiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL?.trim() || 'https://cashflowhubs.onrender.com/api';
  const canonicalOrigin = (() => {
    try {
      return new URL(canonicalApiUrl).origin.replace(/\/+$/, '');
    } catch {
      return canonicalApiUrl.replace(/\/+$/, '');
    }
  })();

  if (configuredApiUrl) {
    const normalized = configuredApiUrl.replace(/\/+$/, '');
    return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
  }

  if (typeof window !== 'undefined') {
    const currentOrigin = window.location.origin.replace(/\/+$/, '');
    if (window.location.hostname.endsWith('.onrender.com')) {
      return canonicalApiUrl;
    }
    return `${currentOrigin}/api`;
  }

  return canonicalApiUrl;
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15000,
  withCredentials: true,
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
    const language = normalizeLanguage(localStorage.getItem('cfh_language') || localStorage.getItem('cfh-user-language') || navigator.language);
    config.headers['Accept-Language'] = language || navigator.language || 'en';
    config.headers['x-timezone'] = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    config.headers['x-device-fingerprint'] = getDeviceFingerprint();
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isBackgroundRefresh = err?.config?.headers?.['x-background-refresh'] === 'true';
    if (err.response?.status === 401 && typeof window !== 'undefined' && !isBackgroundRefresh) {
      localStorage.removeItem('earnhub-auth');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
