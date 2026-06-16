'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  const MIN_DEPOSIT_LOCAL = 100;
  const XP_REDEMPTION_BLOCK = 20000;
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

  const { data: tokenPackageData } = useQuery({
    queryKey: ['token-packages'],
    queryFn: () => api.get('/wallet/token-packages').then((r) => r.data),
    staleTime: 5 * 60_000,
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
  const {
    register: registerDeposit,
    handleSubmit: handleDepositSubmit,
    reset: resetDeposit,
    formState: { errors: depositErrors },
  } = useForm<{ amountLocal: number; phoneNumber: string }>({
    defaultValues: { phoneNumber: formatPhone(user?.phone) || '' },
  });
  const wallet = walletData || {};
  const transactions = transactionData || [];
  const tokenPackages = user?.tokenPackages || [];
  const fetchedTokenPackages = tokenPackageData?.packages || [];
  const tokenPackagesList = fetchedTokenPackages.length ? fetchedTokenPackages : (user?.tokenPackages || []);
  const pkgSymbol = tokenPackageData?.symbol || wallet.symbol || 'KSh';
  const pkgCurrency = tokenPackageData?.currency || wallet.currency || 'KES';
  const pendingReference = pendingPurchase?.reference || null;
  const pendingDepositReference = pendingDeposit?.reference || null;
  const withdrawalOpen = Boolean(wallet.withdrawalOpen);
  const walletBalanceUSD = Number(wallet.balanceUSD || 0);
  const xpPoints = Number(user?.xpPoints || 0);
  const xpRedeemable = Math.floor(xpPoints / XP_REDEMPTION_BLOCK) * XP_REDEMPTION_BLOCK;
  const xpCashLocal = Number(((xpPoints / XP_REDEMPTION_BLOCK) * (wallet.xpPerBlockLocal || 1000)).toFixed(2));
  const currencyRate = Number(wallet.currencyRate || 0);
  const xpCashUSD = currencyRate > 0
    ? Number((xpCashLocal / currencyRate).toFixed(4))
    : Number(wallet.xpEstimatedUSD || 0);
  const xpPerBlockLocal = wallet.xpPerBlockLocal || 1000;
  const symbol = wallet.symbol || '';
  const currency = wallet.currency || '';
  const formatNumber = (value: number | string | undefined | null) =>
    Number(value ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
  const formatDate = (value: string | number | Date | undefined | null) =>
    value ? new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value)) : '';
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || '';
  const [selectedPkg, setSelectedPkg] = useState<number | null>(null);
  const [payMethod, setPayMethod] = useState<string | null>(null);
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const previousXpPoints = useRef<number | null>(null);

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
        if (['failed', 'cancelled'].includes(String(response.data.status || '').toLowerCase())) {
          setPendingDeposit(null);
          persistPendingDeposit(null);
          if (!silent) {
            toast.error(response.data.message || 'Deposit was not completed. Please try again.');
          }
          return false;
        }
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
    if (previousXpPoints.current === null) {
      previousXpPoints.current = xpPoints;
      return;
    }

    if (previousXpPoints.current !== xpPoints) {
      previousXpPoints.current = xpPoints;
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
    }
  }, [queryClient, xpPoints]);

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
    if (Number(data.amountLocal) < MIN_DEPOSIT_LOCAL) {
      toast.error(`Minimum amount to deposit is ${MIN_DEPOSIT_LOCAL}`);
      return;
    }

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

  const onDepositInvalid = (errors: { amountLocal?: { message?: string } }) => {
    const message = errors.amountLocal?.message || `Minimum amount to deposit is ${MIN_DEPOSIT_LOCAL}`;
    toast.error(message);
  };

  const onRedeemXp = async () => {
    if (xpRedeemable < XP_REDEMPTION_BLOCK) {
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
          <div className="text-3xl font-black text-cyan-300">{wallet.tokenBalance || 0}T</div>
          <div className="mt-1 text-xs text-slate-500">Used for job and gig posting</div>
        </div>

        <div className="card border-yellow-500/30 bg-yellow-500/5">
          <div className="mb-1 flex items-center gap-1 text-xs text-yellow-400">
            <Clock size={11} />
            Pending Friday Payout
          </div>
          <div className="text-3xl font-black text-yellow-400">${(wallet.pendingBalanceUSD || 0).toFixed(2)}</div>
          <div className="mt-1 text-xs text-slate-500">{symbol}{formatNumber(wallet.pendingBalanceLocal)} {currency}</div>
        </div>

        <div className="card">
          <div className="mb-1 text-xs text-slate-400">Total Earned</div>
          <div className="text-2xl font-black">${(wallet.totalEarned || 0).toFixed(2)}</div>
          <div className="mt-1 text-sm text-slate-400">{symbol}{formatNumber(wallet.totalEarnedLocal)} {currency}</div>
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
            <div className="mt-2 text-2xl font-black text-white">{formatNumber(xpPoints)} XP Total</div>
            <div className="mt-1 text-sm text-slate-400">
              {xpRedeemable > 0
                ? `${formatNumber(xpRedeemable)} XP is currently redeemable. 20,000 XP = ${symbol}${formatNumber(xpPerBlockLocal)} ${currency}. You can redeem cash once you have a full block available.`
                : 'No XP is currently redeemable. Earn more XP to reach the redemption threshold.'}
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-400/20 bg-slate-950/50 px-4 py-3 text-right">
            <div className="text-xs text-slate-400">Estimated cash value</div>
            <div className="text-2xl font-black text-emerald-300">{symbol}{formatNumber(xpCashLocal)} {currency}</div>
            <div className="text-xs text-slate-500">${Number(xpCashUSD).toFixed(2)} USD equivalent</div>
            <button
              type="button"
              onClick={() => void onRedeemXp()}
              disabled={redeemingXp || xpRedeemable < XP_REDEMPTION_BLOCK}
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

        <form onSubmit={handleDepositSubmit(onDeposit, onDepositInvalid)} className="max-w-sm space-y-4">
          <div>
            <label className="mb-1.5 block text-sm text-slate-300">Amount ({wallet.currency || user?.country || 'Local'})</label>
            <input
              {...registerDeposit('amountLocal', {
                required: 'Minimum amount to deposit is 100',
                min: {
                  value: MIN_DEPOSIT_LOCAL,
                  message: 'Minimum amount to deposit is 100',
                },
                validate: (value) => Number(value) > 0 || 'Amount must be positive',
              })}
              type="number"
              min={MIN_DEPOSIT_LOCAL}
              step="0.01"
              placeholder="e.g. 100"
              className="input"
            />
            <p className="mt-1 text-xs text-slate-400">Minimum deposit is KSh 100 or your local equivalent.</p>
            {depositErrors.amountLocal && (
              <p className="mt-1 text-xs font-medium text-red-300">{depositErrors.amountLocal.message}</p>
            )}
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
        <div className="mb-2 text-sm text-slate-400">Tokens are used for job posting and gig applications</div>
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
          {tokenPackagesList.map((pkg: any) => {
            const displaySymbol = pkg.symbol || pkgSymbol;
            const displayAmount = pkg.amountLocal ?? pkg.amountKES;
            const perToken = displayAmount && pkg.tokens ? (Number(displayAmount) / pkg.tokens).toFixed(2) : '';
            const isBestValue = pkg.tokens === 100;
            const isPopular = pkg.tokens === 50;

            return (
              <button
                key={pkg.tokens}
                onClick={() => { setSelectedPkg(pkg.tokens); setPayMethod(null); setTokenModalOpen(true); }}
                disabled={!!buyingTokens}
                className={`relative rounded-2xl border p-4 text-left transition-all duration-150 ${selectedPkg === pkg.tokens ? 'border-cyan-400 bg-cyan-500/15' : 'border-slate-700 bg-slate-900 hover:border-cyan-500/50'}`}
              >
                {isBestValue && <div className="absolute -top-2 right-3 rounded-full bg-amber-400/90 px-3 py-1 text-xs font-semibold text-slate-900">Best Value</div>}
                {isPopular && !isBestValue && <div className="absolute -top-2 right-3 rounded-full bg-emerald-400/90 px-3 py-1 text-xs font-semibold text-slate-900">Popular</div>}

                <div className="text-sm text-slate-400">{pkg.tokens} Tokens</div>
                <div className="mt-1 text-2xl font-black text-cyan-300">{displaySymbol}{Number(displayAmount).toLocaleString()} </div>
                <div className="mt-1 text-xs text-slate-400">{displaySymbol}{perToken}/ token · {pkg.currency || pkgCurrency}</div>
                <div className="mt-3 text-xs text-slate-500">Tap to purchase</div>
              </button>
            );
          })}
        </div>

        {/* Token purchase modal */}
        {tokenModalOpen && selectedPkg !== null && (() => {
          const pkg = tokenPackagesList.find((p: any) => p.tokens === selectedPkg);
          if (!pkg) return null;
          const displaySymbol = pkg.symbol || pkgSymbol;
          const displayAmount = pkg.amountLocal ?? pkg.amountKES;
          const displayCurrency = pkg.currency || pkgCurrency;
          const walletBalanceLocal = Number(wallet.balanceLocal || 0);
          const canAffordWithWallet = walletBalanceUSD >= Number(pkg.amountUSD ?? 0);

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60" onClick={() => { setTokenModalOpen(false); setSelectedPkg(null); setPayMethod(null); }} />
              <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-lg font-bold">Buy {pkg.tokens} Tokens</div>
                    <div className="text-sm text-slate-400 mt-1">{displaySymbol}{Number(displayAmount).toLocaleString()} {displayCurrency} {pkg.amountUSD ? `· $${pkg.amountUSD.toFixed(2)} USD` : ''}</div>
                  </div>
                  <button onClick={() => { setTokenModalOpen(false); setSelectedPkg(null); setPayMethod(null); }} className="rounded-xl bg-slate-800 p-2 text-slate-400">✕</button>
                </div>

                {!payMethod && (
                  <div className="mt-6 grid gap-3">
                    <div className="text-sm text-slate-400">Choose how to pay:</div>
                    <button onClick={() => setPayMethod('mpesa')} className="flex w-full items-center gap-4 rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-4 text-left">
                      <div className="text-2xl">📱</div>
                      <div className="flex-1">
                        <div className="font-semibold">{user?.country === 'KE' ? 'M-Pesa' : user?.country === 'UG' ? 'MTN MoMo' : user?.country === 'GH' ? 'MTN MoMo / Paystack' : user?.country === 'NG' ? 'Card / Paystack' : user?.country === 'ET' ? 'Telebirr' : 'Mobile Money'}</div>
                        <div className="text-xs text-slate-400">You'll receive a payment prompt on your phone</div>
                      </div>
                      <div className="text-slate-400">›</div>
                    </button>

                    <button onClick={() => setPayMethod('wallet')} disabled={!canAffordWithWallet} className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left ${canAffordWithWallet ? 'border-slate-700 bg-slate-950/50' : 'cursor-not-allowed border-slate-800 bg-slate-950/30 opacity-60'}`}>
                      <div className="text-2xl">💰</div>
                      <div className="flex-1">
                        <div className="font-semibold">Wallet Balance</div>
                        <div className="text-xs text-slate-400">Available: {wallet.symbol}{Number(wallet.balanceLocal || 0).toFixed(2)} {wallet.currency} { !canAffordWithWallet && '· Insufficient balance' }</div>
                      </div>
                      <div className="text-slate-400">›</div>
                    </button>
                  </div>
                )}

                {payMethod === 'mpesa' && (
                  <div className="mt-6">
                    <div className="text-sm text-slate-400">A payment prompt will be sent to</div>
                    <div className="mt-2 font-semibold">{user?.phone}</div>
                    <div className="mt-2">Amount: {displaySymbol}{Number(displayAmount).toLocaleString()} {displayCurrency}</div>
                    <div className="mt-6 flex gap-3">
                      <button onClick={() => setPayMethod(null)} className="flex-1 rounded-xl border border-slate-700 py-2.5 text-sm text-slate-400">Back</button>
                      <button onClick={async () => {
                        setBuyingTokens(pkg.tokens);
                        try {
                          const { data } = await api.post('/payments/tokens/purchase', { tokens: pkg.tokens });
                          persistPendingPurchase({ reference: data.reference, tokens: pkg.tokens, provider: data.provider, checkoutUrl: data.checkoutUrl });
                          setPendingPurchase({ reference: data.reference, tokens: pkg.tokens, provider: data.provider, checkoutUrl: data.checkoutUrl });
                          setTokenModalOpen(false);
                          setSelectedPkg(null);
                          setPayMethod(null);
                          if (data.checkoutUrl) {
                            window.location.assign(data.checkoutUrl);
                            return;
                          }
                          toast.success(data.message || 'Payment prompt sent to your phone. Enter your PIN.');
                        } catch (err: any) {
                          toast.error(err.response?.data?.message || 'Payment initiation failed');
                        } finally {
                          setBuyingTokens(null);
                        }
                      }} className="flex-1 rounded-xl bg-green-500 py-2.5 text-sm font-semibold text-slate-900">{buyingTokens === pkg.tokens ? 'Sending…' : 'Send Payment Prompt'}</button>
                    </div>
                  </div>
                )}

                {payMethod === 'wallet' && (
                  <div className="mt-6">
                    <div className="text-sm text-slate-400">Deducting from your wallet</div>
                    <div className="mt-2">Cost: {displaySymbol}{Number(displayAmount).toLocaleString()} {displayCurrency}</div>
                    <div className="mt-2">Balance after: {wallet.symbol}{Math.max(0, walletBalanceLocal - Number(displayAmount)).toFixed(2)} {wallet.currency}</div>
                    <div className="mt-2">Tokens received: +{pkg.tokens}T</div>
                    <div className="mt-6 flex gap-3">
                      <button onClick={() => setPayMethod(null)} className="flex-1 rounded-xl border border-slate-700 py-2.5 text-sm text-slate-400">Back</button>
                      <button onClick={async () => {
                        setBuyingTokens(pkg.tokens);
                        try {
                          const { data } = await api.post('/wallet/tokens/purchase', { packageTokens: pkg.tokens });
                          toast.success(data.message || `${pkg.tokens} tokens added to your account`);
                          if (user) {
                            setUser({ ...user, tokenBalance: data.tokenBalance ?? (user.tokenBalance || 0) + pkg.tokens, balanceUSD: data.balanceUSD ?? user.balanceUSD });
                          }
                          await refreshUser();
                          await queryClient.invalidateQueries({ queryKey: ['wallet'] });
                          await queryClient.invalidateQueries({ queryKey: ['transactions'] });
                          setTokenModalOpen(false);
                          setSelectedPkg(null);
                          setPayMethod(null);
                        } catch (err: any) {
                          toast.error(err.response?.data?.message || 'Purchase failed');
                        } finally {
                          setBuyingTokens(null);
                        }
                      }} className="flex-1 rounded-xl bg-cyan-500 py-2.5 text-sm font-semibold text-slate-900">{buyingTokens === pkg.tokens ? 'Processing…' : 'Confirm Purchase'}</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
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
            {wallet.withdrawalOpen ? 'Withdrawals are open today (Friday only)' : 'Withdrawals are only on Friday'}
          </div>
          <div className="mt-0.5 text-xs text-slate-400">
            {wallet.withdrawalOpen ? 'Available now' : `${wallet.nextPayoutDate}${wallet.payoutNote ? ` - ${wallet.payoutNote}` : ''}`}
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
            <input
              {...register('amountUSD', {
                required: true,
                min: { value: 0.01, message: 'Amount must be greater than zero' },
                validate: (value) => Number(value) > 0 || 'Amount must be greater than zero',
              })}
              type="number"
              min="0.01"
              step="0.01"
              placeholder="e.g. 5.00"
              className="input"
            />
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
                    {formatDate(tx.createdAt)} -{' '}
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
