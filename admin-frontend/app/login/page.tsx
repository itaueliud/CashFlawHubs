'use client';

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

function AlertIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10.3 4.3 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L14.7 4.3a2 2 0 0 0-4.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export default function AdminLogin() {
  const { login, logout, verify2FA, pending2FA, isLoading, user, hasHydrated } = useAuthStore();
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const portalTarget = String(process.env.NEXT_PUBLIC_ROLE_PORTAL_TARGET || 'admin').toLowerCase().trim();

  useEffect(() => {
    if (!hasHydrated || !user) return;
    if (['admin', 'superadmin'].includes(user.role || '')) {
      window.location.assign('/dashboard');
    }
  }, [hasHydrated, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const result = await login(identifier, password);
      if (result?.requires2FA) {
        return;
      }
      router.replace('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Login failed';
      setError(msg);
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
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <aside className="hidden flex-col justify-between border-r border-[var(--border)] p-10 lg:flex" style={{ background: 'radial-gradient(circle at top left, rgba(30,144,255,0.12), transparent 28%), radial-gradient(circle at top right, rgba(0,200,150,0.08), transparent 24%), linear-gradient(180deg, #091426 0%, #060C1A 100%)' }}>
          <div className="space-y-10">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-[rgba(30,144,255,0.18)] text-xl font-black text-white shadow-[0_10px_30px_rgba(30,144,255,0.18)]">C</div>
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-[var(--text-muted)]">Admin Portal</p>
                <p className="text-xs text-[var(--text-subtle)]">CashFlowHubs</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="inline-flex items-center rounded-full border border-[rgba(30,144,255,0.2)] bg-[rgba(30,144,255,0.08)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent-blue)]">
                Staff Operations
              </div>

              <div className="space-y-4">
                <h1 className="text-5xl font-black tracking-tight text-white">
                  Revenue
                  <br />
                  <span className="text-[var(--accent-blue)]">Operations</span>
                  <br />
                  Portal
                </h1>
                <p className="max-w-md text-sm leading-7 text-[var(--text-muted)]">
                  Secure access for platform operators, revenue staff, and moderation teams.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-3xl border border-[var(--border)] bg-[rgba(255,255,255,0.04)] p-5">
                  <p className="text-3xl font-black text-[var(--accent-blue)]">KES</p>
                  <p className="mt-2 text-sm text-[var(--text-subtle)]">Primary Currency</p>
                </div>
                <div className="rounded-3xl border border-[var(--border)] bg-[rgba(255,255,255,0.04)] p-5">
                  <p className="text-3xl font-black text-[var(--accent-green)]">M-Pesa</p>
                  <p className="mt-2 text-sm text-[var(--text-subtle)]">Payment rail</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-[var(--border)] bg-[rgba(255,255,255,0.04)] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.28)]">
            <div className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--text-muted)]">Live Posture</div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl bg-[rgba(255,255,255,0.03)] p-4">
                <p className="text-2xl font-black text-white">24/7</p>
                <p className="mt-2 text-xs text-[var(--text-subtle)]">Operations visibility</p>
              </div>
              <div className="rounded-3xl bg-[rgba(255,255,255,0.03)] p-4">
                <p className="text-2xl font-black text-white">Safe</p>
                <p className="mt-2 text-xs text-[var(--text-subtle)]">Session handling</p>
              </div>
              <div className="rounded-3xl bg-[rgba(255,255,255,0.03)] p-4">
                <p className="text-2xl font-black text-white">Live</p>
                <p className="mt-2 text-xs text-[var(--text-subtle)]">Mongo-backed data</p>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex items-center justify-center px-6 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-xl">
            <div className="mb-8 rounded-[28px] border border-[var(--border)] bg-[rgba(255,255,255,0.04)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.25)] backdrop-blur-xl">
              <div className="flex items-center justify-between gap-4 text-sm text-[var(--text-muted)]">
                <span className="inline-flex items-center gap-2 rounded-full bg-[rgba(30,144,255,0.08)] px-3 py-2 text-[var(--accent-blue)]">Admin Dashboard</span>
                <span className="rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.02)] px-3 py-2">Secure login</span>
              </div>

              <div className="mt-8 space-y-4">
                <h2 className="text-4xl font-black tracking-tight text-white">Welcome back</h2>
                <p className="max-w-lg text-sm leading-7 text-[var(--text-muted)]">
                  Log in to your CashFlowHubs admin portal and manage platform operations, support workflows, and user controls.
                </p>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--accent-green)]">{portalTarget || 'admin'} portal</p>
              </div>
            </div>

            <div className="card-surface rounded-[32px] p-8 shadow-[0_40px_120px_rgba(30,144,255,0.12)]">
              {error && (
                <div className="mb-5 rounded-3xl border border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.08)] p-4 text-sm text-[var(--danger)]">
                  <div className="flex items-center gap-3">
                    <AlertIcon className="h-4 w-4 text-[var(--danger)]" />
                    <p>{error}</p>
                  </div>
                </div>
              )}

              {!pending2FA ? (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-subtle)]">Email or Phone</label>
                    <input
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      required
                      autoComplete="username"
                      placeholder="name@example.com or +254712345678"
                      className="input-field w-full rounded-[20px] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition-all duration-200 focus:border-[rgba(30,144,255,0.65)]"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-subtle)]">Password</label>
                    <div className="relative">
                      <input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        className="input-field w-full rounded-[20px] px-4 py-3 pr-12 text-sm text-[var(--text-primary)] outline-none transition-all duration-200 focus:border-[rgba(30,144,255,0.65)]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-[var(--text-muted)] transition-colors hover:text-white"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn-primary w-full rounded-[20px] px-5 py-3 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Signing in...
                      </span>
                    ) : (
                      'Sign in to Portal'
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handle2FASubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-subtle)]">Two-Factor Code</label>
                    <input
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                      required
                      autoFocus
                      placeholder="000000"
                      maxLength={6}
                      className="input-field w-full rounded-[20px] px-4 py-3 text-center text-sm tracking-[0.28em] text-[var(--text-primary)] outline-none transition-all duration-200 focus:border-[rgba(30,144,255,0.65)]"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button type="submit" className="btn-primary w-full rounded-[20px] px-5 py-3 text-sm font-semibold">Verify & Continue</button>
                    <button
                      type="button"
                      onClick={() => logout()}
                      className="rounded-[20px] border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-5 py-3 text-sm font-semibold text-[var(--text-muted)] transition hover:border-[rgba(255,255,255,0.14)]"
                    >
                      Back to login
                    </button>
                  </div>
                </form>
              )}

              <div className="mt-8 flex flex-col gap-3 rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4 text-sm text-[var(--text-subtle)]">
                <div className="flex flex-wrap gap-2">
                  <span className="status-chip">Secure access</span>
                  <span className="status-chip green">Fast auth</span>
                </div>
                <p>Use your admin credentials and the dedicated portal to keep platform access separated from consumer accounts.</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
