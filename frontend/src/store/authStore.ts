import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import api from '@/lib/api';

const safeStorage = {
  getItem: (_name: string) => null,
  setItem: (_name: string, _value: string) => {},
  removeItem: (_name: string) => {},
};

interface User {
  id: string;
  _id?: string;
  userId: string;
  role?: 'user' | 'admin' | 'superadmin' | 'ledger';
  userAccessType?: 'real' | 'test';
  firstName?: string;
  lastName?: string;
  name: string;
  email?: string;
  pending_email?: string;
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
  emailVerified?: boolean;
  identityVerificationStatus?: string;
  surveysCompleted?: number;
  tasksCompleted?: number;
  totalReferrals?: number;
  tokenBalance?: number;
  totalTokensPurchased?: number;
  totalTokensSpent?: number;
  paymentProvider?: string;
  userLanguage?: string;
  browserLanguage?: string;
  paymentRouting?: {
    deposits: string[];
    withdrawals: string[];
  };
  tokenPackages?: { tokens: number; amountKES: number }[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  hasHydrated: boolean;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  login: (
    identifier: string,
    password: string,
    turnstileToken?: string,
    browserLanguage?: string,
    timezone?: string,
    portal?: string,
    twoFactorToken?: string,
    twoFactorChallengeId?: string
  ) => Promise<User | { success: true; requires2FA: true; challengeId: string; userId: string; message?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const normalizeUser = (user: any) => {
  if (!user) return null;
  return {
    ...user,
    id: user.id || user._id || user.userId || null,
    balanceUSD: typeof user.balanceUSD === 'number' ? user.balanceUSD : 0,
  };
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      hasHydrated: false,

      setUser: (user) => set({ user }),
      setToken: (token) => {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        set({ token });
      },
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),

      login: async (identifier, password, turnstileToken, browserLanguage, timezone, portal, twoFactorToken, twoFactorChallengeId) => {
        set({ isLoading: true });
        try {
          const res = await api.post('/auth/login', {
            identifier,
            password,
            turnstileToken,
            browser_language: browserLanguage,
            timezone,
            portal,
            twoFactorToken,
            twoFactorChallengeId,
          });
          const payload = res.data;
          if (payload?.requires2FA && !payload?.token) {
            set({ isLoading: false });
            return payload;
          }

          const { token, user } = payload;
          const normalizedUser = normalizeUser(user);
          set({ token, user: normalizedUser, isLoading: false });
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          return normalizedUser;
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      logout: () => {
        api.post('/auth/logout').catch(() => {});
        set({ user: null, token: null });
        delete api.defaults.headers.common['Authorization'];
      },

      refreshUser: async () => {
        try {
          const res = await api.get('/auth/me', { headers: { 'x-background-refresh': 'true' } });
          const normalizedUser = normalizeUser({ ...res.data.user, balanceUSD: res.data.wallet?.balanceUSD || 0 });
          set({ user: normalizedUser });
        } catch (err: any) {
          // Don't clear session on background refresh failures. Only redirect if there's truly no user state.
          if (err?.response?.status === 401) {
            const currentUser = useAuthStore.getState().user;
            if (!currentUser && typeof window !== 'undefined') {
              localStorage.removeItem('earnhub-auth');
              window.location.href = '/login';
            }
          }
        }
      },
    }),
    {
      name: 'earnhub-auth',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : safeStorage)),
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state) => {
        if (state?.user) {
          state.setUser(normalizeUser(state.user));
        }
        const token = state?.token;
        if (token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
        // Always mark hydration complete — even when there was no persisted state
        const store = state ?? useAuthStore.getState();
        store?.setHasHydrated(true);
      },
    }
  )
);
