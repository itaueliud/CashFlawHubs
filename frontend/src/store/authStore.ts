import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/api';

interface User {
  id: string;
  userId: string;
  name: string;
  phone: string;
  country: string;
  referralCode: string;
  activationStatus: boolean;
  level: number;
  xpPoints: number;
  streak: number;
  badges: string[];
  balanceUSD: number;
  phoneVerified?: boolean;
  surveysCompleted?: number;
  tasksCompleted?: number;
  totalReferrals?: number;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,

      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),

      login: async (phone, password) => {
        set({ isLoading: true });
        try {
          const res = await api.post('/auth/login', { phone, password });
          const { token, user } = res.data;
          set({ token, user, isLoading: false });
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      logout: () => {
        set({ user: null, token: null });
        delete api.defaults.headers.common['Authorization'];
      },

      refreshUser: async () => {
        try {
          const res = await api.get('/auth/me');
          set({ user: { ...get().user, ...res.data.user, balanceUSD: res.data.wallet?.balanceUSD || 0 } });
        } catch {}
      },
    }),
    {
      name: 'earnhub-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);
