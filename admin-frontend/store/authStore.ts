 'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import api from '../lib/api';

interface AdminUser {
  id: string; name: string; email?: string; phone: string;
  role: 'admin' | 'superadmin'; tokenBalance?: number;
  balanceUSD?: number; xpPoints?: number;
  twoFactorEnabled?: boolean;
}

interface AuthState {
  user: AdminUser | null; token: string | null;
  isLoading: boolean; hasHydrated: boolean;
  // 2FA challenge state
  pending2FA: { challengeId: string; userId: string; identifier: string; password: string; portal: string } | null;
  setHasHydrated: (v: boolean) => void;
  login: (identifier: string, password: string) => Promise<any>;
  verify2FA: (code: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null, token: null, isLoading: false,
      hasHydrated: false, pending2FA: null,

      setHasHydrated: (v) => set({ hasHydrated: v }),

      login: async (identifier, password) => {
        set({ isLoading: true });
        try {
          const res = await api.post('/auth/login', {
            identifier, password, portal: 'admin',
          });
          const data = res.data;
          if (data.requires2FA) {
            set({
              pending2FA: {
                challengeId: data.challengeId,
                userId: data.userId,
                identifier,
                password,
                portal: 'admin',
              },
              isLoading: false,
            });
            return { requires2FA: true };
          }
          const { token, user } = data;
          if (!['admin', 'superadmin'].includes(user.role)) {
            throw new Error('Access denied. Admin credentials required.');
          }
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          set({ token, user, isLoading: false, pending2FA: null });
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
          const res = await api.post('/auth/login', {
            identifier: pending2FA.identifier,
            password: pending2FA.password,
            twoFactorToken: code,
            twoFactorChallengeId: pending2FA.challengeId,
            portal: pending2FA.portal || 'admin',
          });
          const { token, user } = res.data;
          if (!['admin', 'superadmin'].includes(user.role)) throw new Error('Access denied');
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          set({ token, user, pending2FA: null, isLoading: false });
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      logout: () => {
        api.post('/auth/logout').catch(() => {});
        set({ user: null, token: null, pending2FA: null, isLoading: false });
        delete api.defaults.headers.common['Authorization'];
      },

      refreshUser: async () => {
        try {
          const res = await api.get('/auth/me');
          set({ user: { ...res.data.user, balanceUSD: res.data.wallet?.balanceUSD || 0 } });
        } catch {}
      },
    }),
    {
      name: 'admin-auth',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? localStorage
          : { getItem: () => null, setItem: () => {}, removeItem: () => {} }
      ),
      partialize: (s) => ({ token: s.token, user: s.user }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
        }
        (state ?? useAuthStore.getState())?.setHasHydrated(true);
      },
    }
  )
);
