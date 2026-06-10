'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { TurnstileWidget } from '@/components/security/TurnstileWidget';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  CheckCircle,
  Clock,
  Info,
  Loader2,
  RefreshCw,
} from 'lucide-react';

const TOKEN_PURCHASE_STORAGE_KEY = 'cashflawhubs-pending-token-purchase';
const WALLET_DEPOSIT_STORAGE_KEY = 'cashflawhubs-pending-wallet-deposit';

type PendingTokenPurchase = {
  reference: string;
  tokens: number;
  provider: string;
  checkoutUrl?: string | null;
};

type PendingWalletDeposit = {
  reference: string;
  amount: number;
  currency: string;
  provider: string;
  checkoutUrl?: string | null;
};

export default function WalletPage() {
  const [withdrawing, setWithdrawing] = useState(false);
  const [depositing, setDepositing] = useState(false);
  const [buyingTokens, setBuyingTokens] = useState<number | null>(null);
  const [redeemingXp, setRedeemingXp] = useState(false);
  const [verifyingPurchase, setVerifyingPurchase] = useState(false);
  const [pendingPurchase, setPendingPurchase] = useState<PendingTokenPurchase | null>(null);
  const [pendingDeposit, setPendingDeposit] = useState<PendingWalletDeposit | null>(null);
  const queryClient = useQueryClient();
  const { user, refreshUser, setUser } = useAuthStore();

  const { data: walletData } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => api.get('/wallet').then((response) => response.data.wallet),
    refetchInterval: 60000,
  });

  const { data: transactionData } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => api.get('/wallet/transactions?limit=30').then((response) => response.data.transactions),
  });

  const formatPhone = (phone: string | undefined) => {
    if (!phone) return '';
    return phone.replace(/^(\+\d{1,3})0+/, '$1');
  };

  const { register, handleSubmit, reset } = useForm<{ amountUSD: number; phoneNumber: string }>();
  const { register: registerDeposit, handleSubmit: handleDepositSubmit, reset: resetDeposit } = useForm<{ amountLocal: number; phoneNumber: string }>({
    defaultValues: { phoneNumber: formatPhone(user?.phone) || '' },
  });
  const wallet = walletData || {};
  const transactions = transactionData || [];
  const tokenPackages = user?.tokenPackages || [];
  const pendingReference = pendingPurchase?.reference || null;
  const pendingDepositReference = pendingDeposit?.reference || null;
  const withdrawalOpen = Boolean(wallet.withdrawalOpen);
  const xpBlocksAvailable = Math.floor((user?.xpPoints || 0) / 20000);
  const xpRedeemable = xpBlocksAvailable * 20000;
  const xpCashLocal = xpBlocksAvailable * 1000;
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || '';

  const persistPendingPurchase = (payload: PendingTokenPurchase | null) => {
    if (typeof window === 'undefined') return;
    if (!payload) {
      localStorage.removeItem(TOKEN_PURCHASE_STORAGE_KEY);
      return;
    }
    localStorage.setItem(TOKEN_PURCHASE_STORAGE_KEY, JSON.stringify(payload));
  };

  const verifyPendingPurchase = async (reference: string, silent = false) => {
    setVerifyingPurchase(true);
    try {
      const response = await api.get(`/payments/verify/${encodeURIComponent(reference)}`);
      if (!response.data.verified) {
        return false;
      }

      await refreshUser();
      await queryClient.invalidateQueries({ queryKey: ['wallet'] });
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setPendingPurchase(null);
      persistPendingPurchase(null);

      if (!silent) {
        toast.success(`Tokens credited successfully. Balance: ${response.data.tokenBalance ?? user?.tokenBalance ?? 0}T`);
      }
      return true;
    } catch (error: any) {
      if (error?.response?.status === 404) {
        setPendingPurchase(null);
        persistPendingPurchase(null);
        if (!silent) {
          toast.error('Payment reference was not found. Please start the purchase again.');
        }
        return false;
      }
      if (!silent) {
        toast.error(error.response?.data?.message || 'Unable to verify token purchase yet');
      }
      return false;
    } finally {
      setVerifyingPurchase(false);
    }
  };

  const persistPendingDeposit = (payload: PendingWalletDeposit | null) => {
    if (typeof window === 'undefined') return;
    if (!payload) {
      localStorage.removeItem(WALLET_DEPOSIT_STORAGE_KEY);
      return;
    }
    localStorage.setItem(WALLET_DEPOSIT_STORAGE_KEY, JSON.stringify(payload));
  };

  const verifyPendingDeposit = async (reference: string, silent = false) => {
    setVerifyingPurchase(true);
    try {
      const response = await api.get(`/payments/verify/${encodeURIComponent(reference)}`);
      if (!response.data.verified) {
        return false;
      }

      await refreshUser();
      await queryClient.invalidateQueries({ queryKey: ['wallet'] });
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setPendingDeposit(null);
      persistPendingDeposit(null);

      if (!silent) {
        toast.success(`Deposit credited successfully. Wallet balance: $${Number(response.data.walletBalanceUSD || 0).toFixed(2)}`);
      }
      return true;
    } catch (error: any) {
      if (error?.response?.status === 404) {
        setPendingDeposit(null);
        persistPendingDeposit(null);
        if (!silent) {
          toast.error('Payment reference was not found. Please start the deposit again.');
        }
        return false;
      }
      if (!silent) {
        toast.error(error.response?.data?.message || 'Unable to verify deposit yet');
      }
      return false;
    } finally {
      setVerifyingPurchase(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(TOKEN_PURCHASE_STORAGE_KEY);
    if (!raw) return;

    try {
      setPendingPurchase(JSON.parse(raw));
    } catch {
      localStorage.removeItem(TOKEN_PURCHASE_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(WALLET_DEPOSIT_STORAGE_KEY);
    if (!raw) return;

    try {
      setPendingDeposit(JSON.parse(raw));
    } catch {
      localStorage.removeItem(WALLET_DEPOSIT_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!pendingReference) return undefined;

    const interval = window.setInterval(() => {
      verifyPendingPurchase(pendingReference, true);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [pendingReference]);

  useEffect(() => {
    if (!pendingDepositReference) return undefined;

    const interval = window.setInterval(() => {
      verifyPendingDeposit(pendingDepositReference, true);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [pendingDepositReference]);

  const pendingPurchaseLabel = useMemo(() => {
    if (!pendingPurchase) return null;
    return `${pendingPurchase.tokens} tokens via ${pendingPurchase.provider}`;
  }, [pendingPurchase]);

  const pendingDepositLabel = useMemo(() => {
    if (!pendingDeposit) return null;
    return `${pendingDeposit.amount} ${pendingDeposit.currency} via ${pendingDeposit.provider}`;
  }, [pendingDeposit]);

  const onWithdraw = async (data: { amountUSD: number }) => {
    if (!withdrawalOpen) {
      toast.error('Withdrawals are only available on Fridays');
      return;
    }

    if (turnstileSiteKey && !turnstileToken) {
      toast.error('Please complete the security check');
      return;
    }

    setWithdrawing(true);

    try {
      const response = await api.post('/withdrawals/request', { ...data, turnstileToken: turnstileToken || undefined });
      toast.success(
        `Withdrawal of ${response.data.amountLocal} ${response.data.currency} submitted. It will be included in Friday payout.`
      );
      reset();
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Withdrawal failed');
    } finally {
      setWithdrawing(false);
    }
  };

  const onDeposit = async (data: { amountLocal: number; phoneNumber: string }) => {
    setDepositing(true);
    try {
      const response = await api.post('/payments/deposits/initiate', data);
      const pending = {
        reference: response.data.reference,
        amount: Number(response.data.amount),
        currency: response.data.currency,
        provider: response.data.provider,
        checkoutUrl: response.data.checkoutUrl,
      };

      setPendingDeposit(pending);
      persistPendingDeposit(pending);

      if (response.data.checkoutUrl) {
        window.location.assign(response.data.checkoutUrl);
        return;
      }

      toast.success(`Deposit started for ${pending.amount} ${pending.currency}. We'll keep checking for confirmation.`);
      resetDeposit({ amountLocal: undefined as unknown as number, phoneNumber: data.phoneNumber });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Deposit failed');
    } finally {
      setDepositing(false);
    }
  };

  const onRedeemXp = async () => {
    if (xpRedeemable < 20000) {
      toast.error('You need at least 20,000 XP to redeem cash.');
      return;
    }

    setRedeemingXp(true);
    try {
      const response = await api.post('/wallet/xp/redeem', { xpPoints: xpRedeemable });
      toast.success(response.data.message || 'XP redeemed successfully');
      await refreshUser();
      await queryClient.invalidateQueries({ queryKey: ['wallet'] });
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Unable to redeem XP right now');
    } finally {
      setRedeemingXp(false);
    }
  };

  const onBuyTokens = async (tokens: number) => {
    setBuyingTokens(tokens);
    try {
      const response = await api.post('/wallet/tokens/purchase', { packageTokens: tokens });
      toast.success(response.data.message || `${tokens} tokens purchased successfully!`);
      if (user) {
        setUser({
          ...user,
          tokenBalance: response.data.tokenBalance !== undefined ? response.data.tokenBalance : (user.tokenBalance || 0) + tokens,
          balanceUSD: response.data.balanceUSD !== undefined ? response.data.balanceUSD : user.balanceUSD
        });
      }
      await refreshUser();
      await queryClient.invalidateQueries({ queryKey: ['wallet'] });
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
    } catch (error: any) {
      if (error.response?.status === 400 && error.response?.data?.message?.includes('Insufficient balance')) {
        toast.error('Insufficient wallet balance. Please deposit funds first.');
        document.getElementById('deposit')?.scrollIntoView({ behavior: 'smooth' });
      } else {
        toast.error(error.response?.data?.message || 'Token purchase failed');
      }
    } finally {
      setBuyingTokens(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black">Wallet</h1>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="card border-green-800/50 bg-gradient-to-br from-green-900/40 to-green-800/20">
          <div className="mb-1 text-xs text-slate-400">Available Balance</div>
          <div className="text-4xl font-black text-green-400">${(wallet.balanceUSD || 0).toFixed(2)}</div>
          <div className="mt-1 text-xs text-slate-500">{wallet.symbol}{wallet.balanceLocal} {wallet.currency}</div>
        </div>

        <div className="card border-cyan-500/30 bg-cyan-500/5">
          <div className="mb-1 text-xs text-cyan-300">Token Balance</div>
          <div className="text-3xl font-black text-cyan-300">{user?.tokenBalance || 0}T</div>
          <div className="mt-1 text-xs text-slate-500">Used for job and gig posting</div>
        </div>

        <div className="card border-yellow-500/30 bg-yellow-500/5">
          <div className="mb-1 flex items-center gap-1 text-xs text-yellow-400">
            <Clock size={11} />
            Pending Friday Payout
          </div>
          <div className="text-3xl font-black text-yellow-400">${(wallet.pendingBalanceUSD || 0).toFixed(2)}</div>
          <div className="mt-1 text-xs text-slate-500">{wallet.symbol}{wallet.pendingBalanceLocal} {wallet.currency}</div>
        </div>

        <div className="card">
          <div className="mb-1 text-xs text-slate-400">Total Earned</div>
          <div className="text-2xl font-black">${(wallet.totalEarned || 0).toFixed(2)}</div>
          <div className="mt-0.5 text-xs text-slate-500">All time</div>
        </div>
      </div>

      <div className="card border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-slate-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-300">
              <BadgeCheck size={16} />
              <span className="text-sm font-semibold uppercase tracking-[0.16em]">XP Cashout</span>
            </div>
            <div className="mt-2 text-2xl font-black text-white">{(user?.xpPoints || 0).toLocaleString()} XP Total</div>
            <div className="mt-1 text-sm text-slate-400">
              {xpRedeemable.toLocaleString()} XP is currently redeemable. 20,000 XP = KSh 1,000. You can redeem cash once you have a full block available.
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-400/20 bg-slate-950/50 px-4 py-3 text-right">
            <div className="text-xs text-slate-400">Estimated cash value</div>
            <div className="text-2xl font-black text-emerald-300">KSh {xpCashLocal.toLocaleString()}</div>
            <div className="text-xs text-slate-500">${Number(wallet.xpCashUSD || 0).toFixed(2)} USD equivalent</div>
            <button
              type="button"
              onClick={() => void onRedeemXp()}
              disabled={redeemingXp || xpRedeemable < 20000}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {redeemingXp && <Loader2 size={14} className="animate-spin" />}
              Redeem XP Cash
            </button>
          </div>
        </div>
      </div>

      <div className="card" id="deposit">
        <h3 className="mb-4 font-bold">Deposit Funds</h3>
        {pendingDeposit && (
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm">
            <div>
              <div className="font-semibold text-green-300">Deposit in progress</div>
              <div className="text-slate-400">{pendingDepositLabel}</div>
            </div>
            <button
              onClick={() => verifyPendingDeposit(pendingDeposit.reference)}
              disabled={verifyingPurchase}
              className="inline-flex items-center gap-2 rounded-xl border border-green-400/40 px-3 py-2 text-green-300"
            >
              {verifyingPurchase ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Check status
            </button>
          </div>
        )}

        <form onSubmit={handleDepositSubmit(onDeposit)} className="max-w-sm space-y-4">
          <div>
            <label className="mb-1.5 block text-sm text-slate-300">Amount ({wallet.currency || user?.country || 'Local'})</label>
            <input {...registerDeposit('amountLocal', { required: true, min: 100 })} type="number" step="0.01" placeholder="e.g. 100" className="input" />
            <p className="mt-1 text-xs text-slate-400">Minimum deposit is KSh 100 or your local equivalent.</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-slate-300">Payment Number</label>
            <input {...registerDeposit('phoneNumber', { required: true })} placeholder="+254712345678" className="input" />
          </div>

          <button type="submit" disabled={depositing} className="btn-primary flex items-center gap-2">
            {depositing && <Loader2 size={16} className="animate-spin" />}
            Deposit to Wallet
          </button>

        </form>
      </div>

      <div className="card">
        <h3 className="mb-4 font-bold">Buy Tokens</h3>
        {pendingPurchase && (
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-cyan-500/30 bg-cyan-500/5 px-4 py-3 text-sm">
            <div>
              <div className="font-semibold text-cyan-300">Pending token purchase</div>
              <div className="text-slate-400">{pendingPurchaseLabel}</div>
            </div>
            <button
              onClick={() => verifyPendingPurchase(pendingPurchase.reference)}
              disabled={verifyingPurchase}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/40 px-3 py-2 text-cyan-300"
            >
              {verifyingPurchase ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Check status
            </button>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-3">
          {tokenPackages.map((pkg) => (
            <button
              key={pkg.tokens}
              onClick={() => onBuyTokens(pkg.tokens)}
              disabled={buyingTokens === pkg.tokens}
              className="rounded-2xl border border-slate-700 bg-slate-900 p-4 text-left transition hover:border-cyan-500/40"
            >
              <div className="text-sm text-slate-400">{pkg.tokens} Tokens</div>
              <div className="mt-1 text-2xl font-black text-cyan-300">KSh {pkg.amountKES}</div>
              <div className="mt-3 text-xs text-slate-500">
                {buyingTokens === pkg.tokens ? 'Starting payment...' : 'Tap to purchase'}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div
        className={`card flex items-start gap-3 ${
          wallet.withdrawalOpen ? 'border-green-500/40 bg-green-500/5' : 'border-blue-500/30 bg-blue-500/5'
        }`}
      >
        {wallet.withdrawalOpen ? (
          <CheckCircle size={18} className="mt-0.5 flex-shrink-0 text-green-400" />
        ) : (
          <Info size={18} className="mt-0.5 flex-shrink-0 text-blue-400" />
        )}

        <div>
          <div className={`text-sm font-semibold ${wallet.withdrawalOpen ? 'text-green-400' : 'text-blue-400'}`}>
            {wallet.withdrawalOpen ? 'Payouts are processing today' : 'Friday payout system'}
          </div>
          <div className="mt-0.5 text-xs text-slate-400">
            {wallet.nextPayoutDate} {wallet.payoutNote ? `- ${wallet.payoutNote}` : ''}
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-3 font-bold">Earnings Breakdown</h3>
        <div className="space-y-2">
          {Object.entries(wallet.breakdown || {}).map(([key, value]: [string, any]) => (
            <div key={key} className="flex items-center justify-between border-b border-slate-700/50 py-1.5 last:border-0">
              <span className="text-sm capitalize text-slate-400">{key}</span>
              <span className="text-sm font-semibold">${Number(value || 0).toFixed(4)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" id="withdraw">
        <h3 className="mb-4 font-bold">Withdraw Earnings</h3>
        <form onSubmit={handleSubmit(onWithdraw)} className="max-w-sm space-y-4">
          <div>
            <label className="mb-1.5 block text-sm text-slate-300">Amount (USD)</label>
            <input {...register('amountUSD', { required: true })} type="number" step="0.01" placeholder="e.g. 5.00" className="input" />
          </div>

          <button
            type="submit"
            disabled={withdrawing || !withdrawalOpen}
            className={`flex items-center gap-2 ${withdrawalOpen ? 'btn-primary' : 'cursor-not-allowed bg-slate-700 text-slate-400'}`}
          >
            {withdrawing && <Loader2 size={16} className="animate-spin" />}
            {withdrawalOpen ? 'Request Withdrawal' : 'Withdrawals Open Friday'}
          </button>

          {turnstileSiteKey && (
            <div className="mt-3">
              <TurnstileWidget
                siteKey={turnstileSiteKey}
                onToken={setTurnstileToken}
                onExpire={() => setTurnstileToken('')}
                onError={() => setTurnstileToken('')}
                className="flex justify-center"
              />
            </div>
          )}

        </form>
      </div>

      <div className="card">
        <h3 className="mb-4 font-bold">Transaction History</h3>
        {transactions.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">No transactions yet. Start earning.</div>
        ) : (
          <div className="space-y-1">
            {transactions.map((tx: any) => (
              <div key={tx._id} className="flex items-center gap-3 border-b border-slate-700/50 py-2.5 last:border-0">
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${tx.direction === 'credit' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {tx.direction === 'credit' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium capitalize">{tx.type.replace('_', ' ')}</div>
                  <div className="text-xs text-slate-500">
                    {new Date(tx.createdAt).toLocaleDateString()} -{' '}
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${tx.status === 'successful' ? 'bg-green-500/10 text-green-300' : tx.status === 'failed' ? 'bg-red-500/10 text-red-300' : tx.status === 'reversed' ? 'bg-orange-500/10 text-orange-300' : 'bg-yellow-500/10 text-yellow-300'}`}>
                      {tx.status}
                    </span>
                    {tx.type === 'withdrawal' && tx.status === 'pending' && (
                      <span className="ml-2 rounded-full bg-blue-500/10 px-2 py-0.5 font-semibold text-blue-300">
                        Friday payout
                      </span>
                    )}
                  </div>
                </div>

                <div className={`flex-shrink-0 text-sm font-semibold ${tx.direction === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
                  {tx.currency === 'TOKEN'
                    ? `${tx.metadata?.tokensSpent || tx.amountLocal || 0}T`
                    : `${tx.direction === 'credit' ? '+' : '-'}$${Number(tx.amountUSD || 0).toFixed(4)}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
