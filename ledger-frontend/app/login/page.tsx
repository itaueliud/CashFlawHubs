'use client';

import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, Shield, LockKeyhole, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/authStore';

function AlertIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10.3 4.3 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L14.7 4.3a2 2 0 0 0-4.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.32em] text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-black text-white">{value}</div>
    </div>
  );
}

export default function LedgerLogin() {
  const { login, logout, verify2FA, pending2FA, isLoading, user, hasHydrated } = useAuthStore();
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');

  useEffect(() => {
    if (!hasHydrated || !user) return;
    if (user.role === 'ledger') {
      router.replace('/dashboard');
    }
  }, [hasHydrated, router, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const result = await login(identifier, password);
      if (result?.requires2FA) return;
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Login failed');
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await verify2FA(twoFactorCode);
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Invalid code');
      setTwoFactorCode('');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-slate-100">
      <div className="grid min-h-screen lg:grid-cols-[1fr_1.02fr]">
        <aside className="hidden flex-col justify-between border-r border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_32%),linear-gradient(180deg,#06101f_0%,#02040a_100%)] p-10 lg:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500 font-black text-white shadow-lg shadow-cyan-500/25">C</div>
            <div>
              <div className="text-sm font-bold text-white">CashFlowHubs</div>
              <div className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Ledger Portal</div>
            </div>
          </div>

          <div className="max-w-md space-y-6">
            <div className="ledger-chip">Ledger operations</div>
            <h1 className="text-5xl font-black leading-[0.92] text-white">
              Revenue
              <br />
              <span className="text-cyan-300">control</span>
              <br />
              center
            </h1>
            <p className="max-w-sm text-sm leading-6 text-slate-400">
              Secure access for payout execution, reconciliation, admin governance, and treasury review.
            </p>

            <div className="grid max-w-lg grid-cols-2 gap-4">
              <StatPill label="Primary rail" value="M-Pesa" />
              <StatPill label="Currency" value="KES" />
            </div>
          </div>

          <div className="ledger-card p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Live posture</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <div className="text-2xl font-black text-white">Ops</div>
                <div className="text-xs text-slate-500">Payout control</div>
              </div>
              <div>
                <div className="text-2xl font-black text-white">Safe</div>
                <div className="text-xs text-slate-500">Session handling</div>
              </div>
              <div>
                <div className="text-2xl font-black text-white">Live</div>
                <div className="text-xs text-slate-500">Mongo-backed data</div>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-md">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 pulse-dot" />
              Ledger Portal
            </div>

            <h2 className="text-3xl font-black tracking-tight text-white">Welcome back</h2>
            <p className="mt-2 text-sm text-slate-400">Sign in to your CashFlowHubs ledger workspace.</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.32em] text-emerald-300">Ledger operator access</p>
            {!hasHydrated && <p className="mt-3 text-sm text-amber-300">Restoring session...</p>}

            <div className="card-surface soft-up mt-8 rounded-[28px] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
              {error && (
                <div className="mb-4 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                  <span>{error}</span>
                </div>
              )}

              {!pending2FA ? (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Email or phone number</label>
                    <input
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      required
                      autoComplete="username"
                      placeholder="ledger@cashflawhubs.app or +254700000002"
                      className="w-full rounded-xl border border-white/10 bg-[var(--bg-surface)] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-slate-600 hover:border-white/20 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Password</label>
                    <div className="relative">
                      <input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        className="w-full rounded-xl border border-white/10 bg-[var(--bg-surface)] px-4 py-3 pr-11 text-sm text-white outline-none transition-all placeholder:text-slate-600 hover:border-white/20 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 transition-colors hover:text-slate-300"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-bold text-white transition-all duration-200 hover:bg-cyan-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Signing in...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <LockKeyhole className="h-4 w-4" />
                        Sign in to portal
                      </span>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handle2FASubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Two-factor code</label>
                    <input
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                      required
                      autoFocus
                      placeholder="000000"
                      maxLength={6}
                      className="w-full rounded-xl border border-white/10 bg-[var(--bg-surface)] px-4 py-3 text-center text-sm tracking-widest text-white outline-none transition-all placeholder:text-slate-600 hover:border-white/20 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button type="submit" className="flex-1 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-bold text-white hover:bg-cyan-400">
                      Verify & continue
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        setTwoFactorCode('');
                      }}
                      className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300 hover:bg-white/5"
                    >
                      Back
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="ledger-card p-4 text-sm text-slate-300">
                <Shield className="mb-2 h-4 w-4 text-cyan-300" />
                Restricted access
              </div>
              <div className="ledger-card p-4 text-sm text-slate-300">
                <TrendingUp className="mb-2 h-4 w-4 text-emerald-300" />
                Revenue visibility
              </div>
              <div className="ledger-card p-4 text-sm text-slate-300">
                <LockKeyhole className="mb-2 h-4 w-4 text-amber-300" />
                Secure sign-in
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
