import { create } from 'zustand';
import api from '@/lib/api';

interface WalletState {
  balanceUSD: number;
  balanceLocal: number;
  currency: string;
  symbol: string;
  isLoading: boolean;
  fetchWallet: () => Promise<void>;
}

export const useWalletStore = create<WalletState>((set) => ({
  balanceUSD: 0,
  balanceLocal: 0,
  currency: 'KES',
  symbol: 'KSh',
  isLoading: false,

  fetchWallet: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get('/wallet');
      const w = res.data.wallet;
      set({
        balanceUSD: w.balanceUSD,
        balanceLocal: w.balanceLocal,
        currency: w.currency,
        symbol: w.symbol,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },
}));
