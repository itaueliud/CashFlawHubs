'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import api from '../lib/api';

interface LedgerUser {
  id: string;
  name: string;
  email?: string;
  phone: string;
  role: 'ledger';
  tokenBalance?: number;
  balanceUSD?: number;
  xpPoints?: number;
  twoFactorEnabled?: boolean;
  adminAllowedPages?: string[];
}

interface AuthState {
  user: LedgerUser | null;
  token: string | null;
  isLoading: boolean;
  hasHydrated: boolean;
  pending2FA: { challengeId: string; userId: string } | null;
  setHasHydrated: (v: boolean) => void;
  setUser: (user: LedgerUser | null) => void;
  login: (identifier: string, password: string) => Promise<any>;
  verify2FA: (code: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const normalizeUser = (user: any): LedgerUser | null => {
  if (!user) return null;

  return {
    ...user,
    id: user.id || user._id || user.userId || '',
    balanceUSD: typeof user.balanceUSD === 'number' ? user.balanceUSD : 0,
    adminAllowedPages: Array.isArray(user.adminAllowedPages) ? user.adminAllowedPages : [],
  };
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      hasHydrated: false,
      pending2FA: null,

      setHasHydrated: (v) => set({ hasHydrated: v }),
      setUser: (user) => set({ user: normalizeUser(user) }),

      login: async (identifier, password) => {
        set({ isLoading: true });
        try {
          const res = await api.post('/ledger/auth/login', { identifier, password });
          const data = res.data;
          if (data.requires2FA) {
            set({ pending2FA: { challengeId: data.challengeId, userId: data.userId }, isLoading: false });
            return { requires2FA: true };
          }

          const { token, user } = data;
          const normalizedUser = normalizeUser(user);
          if (normalizedUser?.role !== 'ledger') throw new Error('Access denied. Ledger credentials required.');
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          set({ token, user: normalizedUser, isLoading: false, pending2FA: null });
          return {};
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      verify2FA: async (code) => {
        const { pending2FA } = get();
        if (!pending2FA) throw new Error('No pending 2FA challenge');
        set({ isLoading: true });
        try {
          const res = await api.post('/ledger/auth/login/2fa', {
            token: code,
            tempToken: pending2FA.challengeId,
          });
          const { token, user } = res.data;
          const normalizedUser = normalizeUser(user);
          if (normalizedUser?.role !== 'ledger') throw new Error('Access denied');
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          set({ token, user: normalizedUser, pending2FA: null, isLoading: false });
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      logout: () => {
        api.post('/auth/logout').catch(() => {});
        set({ user: null, token: null, pending2FA: null });
        delete api.defaults.headers.common['Authorization'];
      },

      refreshUser: async () => {
        try {
          const res = await api.get('/auth/me');
          const normalizedUser = normalizeUser({ ...res.data.user, balanceUSD: res.data.wallet?.balanceUSD || 0 });
          set({ user: normalizedUser });
        } catch {
          // Keep the current session intact if the refresh fails temporarily.
        }
      },
    }),
    {
      name: 'ledger-auth',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : { getItem: () => null, setItem: () => {}, removeItem: () => {} })),
      partialize: (s) => ({ token: s.token, user: s.user }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) api.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
        (state ?? useAuthStore.getState())?.setHasHydrated(true);
      },
    }
  )
);
