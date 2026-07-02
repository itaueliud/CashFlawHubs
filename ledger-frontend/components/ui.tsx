import React from 'react';
import { Loader2 } from 'lucide-react';

export const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse rounded bg-white/5 ${className}`} />
);

type StatAccent = 'emerald' | 'cyan' | 'amber' | 'red' | 'violet';

const accentStyles: Record<StatAccent, string> = {
  emerald: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.08),0_16px_48px_rgba(16,185,129,0.08)]',
  cyan: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-300 shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_16px_48px_rgba(34,211,238,0.08)]',
  amber: 'border-amber-400/20 bg-amber-400/10 text-amber-300 shadow-[0_0_0_1px_rgba(251,191,36,0.08),0_16px_48px_rgba(251,191,36,0.08)]',
  red: 'border-red-400/20 bg-red-400/10 text-red-300 shadow-[0_0_0_1px_rgba(248,113,113,0.08),0_16px_48px_rgba(248,113,113,0.08)]',
  violet: 'border-violet-400/20 bg-violet-400/10 text-violet-300 shadow-[0_0_0_1px_rgba(167,139,250,0.08),0_16px_48px_rgba(167,139,250,0.08)]',
};

export const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    successful: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
    pending: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
    failed: 'bg-red-500/15 text-red-300 border-red-500/20',
    verified: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/20',
    rejected: 'bg-red-500/15 text-red-300 border-red-500/20',
    banned: 'bg-red-500/15 text-red-300 border-red-500/20',
    open: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
    resolved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
    clean: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
    warning: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
    critical: 'bg-red-500/15 text-red-300 border-red-500/20',
    active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  };
  const cls = map[status] || 'bg-white/5 text-slate-200 border-white/8';
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs capitalize ${cls}`}>
      {status}
    </span>
  );
};

export const ConfirmModal = ({
  open, title, description, confirmLabel = 'Confirm',
  danger = false, onConfirm, onClose, children
}: {
  open: boolean; title: string; description: string;
  confirmLabel?: string; danger?: boolean;
  onConfirm: () => void; onClose: () => void;
  children?: React.ReactNode;
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[var(--bg-surface)] p-6 shadow-2xl shadow-black/40">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="mt-2 text-sm text-slate-400">{description}</p>
        {children}
        <div className="mt-4 flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="rounded-md border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5">Cancel</button>
          <button type="button" onClick={onConfirm} className={`rounded-md px-4 py-2 text-sm font-bold ${danger ? 'bg-red-500 text-white' : 'bg-cyan-500 text-white'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

export const PageHeader = ({ title, description }: { title: string; description?: string }) => (
  <div className="mb-6">
    <h1 className="text-2xl font-black text-white">{title}</h1>
    {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
  </div>
);

export const StatCard = ({
  label, value, accent = 'emerald', sub
}: { label: string; value: string; accent?: StatAccent; sub?: string }) => {
  const accentClass = accentStyles[accent];
  return (
    <div className={`stat-card group relative overflow-hidden rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${accentClass}`}>
      <div className="absolute inset-x-0 top-0 h-1 bg-current opacity-30" />
      <div className="text-xs font-medium uppercase tracking-[0.22em] text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-black tracking-tight text-white">{value}</div>
      {sub && <div className="mt-1 text-sm text-slate-400">{sub}</div>}
    </div>
  );
};

export const InlineSpinner = ({ label = 'Loading' }: { label?: string }) => (
  <div className="inline-flex items-center gap-2 text-sm text-slate-400">
    <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
    <span>{label}</span>
  </div>
);

export const LoadingSpinner = () => (
  <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-5 text-center">
    <InlineSpinner label="Loading dashboard data" />
  </div>
);

export const ErrorBanner = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) => (
  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
    <span>{message}</span>
    {onRetry && (
      <button
        onClick={onRetry}
        className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/20"
      >
        Retry
      </button>
    )}
  </div>
);

