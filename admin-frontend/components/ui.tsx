import React from 'react';
import { Loader2 } from 'lucide-react';

export const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse bg-white/5 rounded ${className}`} />
);

export const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    successful: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
    pending:    'bg-amber-500/15   text-amber-300   border-amber-500/20',
    failed:     'bg-red-500/15     text-red-300     border-red-500/20',
    verified:   'bg-cyan-500/15    text-cyan-300    border-cyan-500/20',
    rejected:   'bg-red-500/15     text-red-300     border-red-500/20',
    banned:     'bg-red-500/15     text-red-300     border-red-500/20',
    open:       'bg-blue-500/15    text-blue-300    border-blue-500/20',
    resolved:   'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
    clean:      'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
    warning:    'bg-amber-500/15   text-amber-300   border-amber-500/20',
    critical:   'bg-red-500/15     text-red-300     border-red-500/20',
    active:     'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  };
  const cls = map[status] || 'bg-white/5 text-slate-200 border-white/8';
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${cls}`}>{status}</span>
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
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl bg-[var(--bg-surface)] p-6">
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="mt-2 text-sm text-slate-400">{description}</p>
        {children}
        <div className="mt-4 flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 border">Cancel</button>
          <button type="button" onClick={onConfirm} className={`rounded-md px-4 py-2 font-bold ${danger ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

export const PageHeader = ({ title, description }: { title: string; description?: string }) => (
  <div className="mb-6">
    <h1 className="text-2xl font-black">{title}</h1>
    {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
  </div>
);

export const StatCard = ({
  label, value, accent = 'emerald', sub
}: { label: string; value: string; accent?: string; sub?: string }) => (
  <div className="rounded-2xl border border-white/6 p-4">
    <div className="text-xs text-slate-400">{label}</div>
    <div className="mt-2 text-2xl font-black">{value}</div>
    {sub && <div className="mt-1 text-sm text-slate-400">{sub}</div>}
  </div>
);

export const LoadingSpinner = () => (
  <div className="flex items-center justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
);

export const ErrorBanner = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) => (
  <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
    <div>{message}</div>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-200 transition hover:bg-red-500/20"
      >
        Retry
      </button>
    )}
  </div>
);
