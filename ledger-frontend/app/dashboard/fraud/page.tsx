'use client';

import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';
import { ConfirmModal, ErrorBanner, LoadingSpinner, PageHeader, StatCard, StatusBadge } from '../../../components/ui';
import { AlertTriangle, Fingerprint, RefreshCw, ShieldAlert, Users } from 'lucide-react';

type FraudAction =
  | { type: 'clear'; item: any }
  | { type: 'ban'; item: any; reason: string }
  | null;

export default function FraudPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [action, setAction] = useState<FraudAction>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/admin/fraud/overview');
      setData(response.data || null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load fraud overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const flagged = data?.flagged || [];
  const chargebacks = data?.chargebacks || [];

  const riskSummary = useMemo(
    () => ({
      high: flagged.filter((item: any) => item.riskLevel === 'high').length,
      medium: flagged.filter((item: any) => item.riskLevel === 'medium').length,
      low: flagged.filter((item: any) => item.riskLevel === 'low').length,
    }),
    [flagged]
  );

  const applyClear = async (item: any) => {
    const userId = item.user?._id || item.user?.id || item.userId;
    if (!userId) return;
    setBusyId(String(userId));
    try {
      await api.post(`/admin/fraud/${userId}/clear`, { reason: 'Reviewed and cleared from ledger console' });
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to clear fraud flag');
    } finally {
      setBusyId(null);
      setAction(null);
    }
  };

  const applyBan = async (item: any, reason: string) => {
    const userId = item.user?._id || item.user?.id || item.userId;
    if (!userId) return;
    setBusyId(String(userId));
    try {
      await api.post(`/admin/fraud/${userId}/ban`, { reason });
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to ban user');
    } finally {
      setBusyId(null);
      setAction(null);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fraud Center"
        description="Spot duplicate devices, repeated IPs, fast withdrawals, and chargeback activity at a glance."
      />

      {error && <ErrorBanner message={error} />}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Flagged Users" value={String(flagged.length)} sub="Active fraud queue" />
        <StatCard label="High Risk" value={String(riskSummary.high)} sub="Immediate review" />
        <StatCard label="Medium Risk" value={String(riskSummary.medium)} sub="Needs triage" />
        <StatCard label="Chargebacks" value={String(chargebacks.length)} sub="Manual follow-up" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldAlert className="h-4 w-4 text-cyan-300" />
              Risk overview
            </div>
            <button onClick={load} className="ledger-button">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="ledger-card p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Duplicate phones</div>
              <div className="mt-2 text-3xl font-black text-red-300">{Number(data?.duplicatePhones || 0)}</div>
            </div>
            <div className="ledger-card p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Duplicate IPs</div>
              <div className="mt-2 text-3xl font-black text-amber-300">{Number(data?.duplicateIps || 0)}</div>
            </div>
            <div className="ledger-card p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Device matches</div>
              <div className="mt-2 text-3xl font-black text-cyan-300">{Number(data?.duplicateFingerprints || 0)}</div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/8 bg-white/5 p-4 text-sm text-slate-300">
            Recent withdrawal clusters: {Number(data?.recentWithdrawalClusters || 0)}.
            Users with duplicate phones, IPs, or fingerprints are scored automatically and surfaced here for review.
          </div>
        </div>

        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Fingerprint className="h-4 w-4 text-cyan-300" />
            Chargeback tracker
          </div>
          <div className="mt-4 space-y-3">
            {chargebacks.length ? chargebacks.map((row: any) => (
              <div key={row._id} className="rounded-2xl border border-white/8 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">{row.user?.name || 'Unknown user'}</div>
                    <div className="mt-1 text-xs text-slate-500">{row.user?.email || row.user?.phone || row.user?.userId || 'n/a'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-red-300">${Number(row.amountUSD || 0).toFixed(2)}</div>
                    <div className="mt-1 text-xs text-slate-500">{row.createdAt ? new Date(row.createdAt).toLocaleString() : 'n/a'}</div>
                  </div>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-white/8 bg-white/5 p-6 text-sm text-slate-500">No chargebacks have been recorded yet.</div>
            )}
          </div>
        </div>
      </section>

      <section className="card-surface soft-up rounded-[24px] p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Users className="h-4 w-4 text-cyan-300" />
          Flagged users
        </div>
        <div className="mt-4 space-y-3">
          {flagged.length ? flagged.map((item: any) => {
            const level = item.riskLevel || (item.riskScore >= 80 ? 'high' : item.riskScore >= 45 ? 'medium' : 'low');
            const color =
              level === 'high'
                ? 'text-red-300 border-red-400/20 bg-red-500/10'
                : level === 'medium'
                  ? 'text-amber-300 border-amber-400/20 bg-amber-500/10'
                  : 'text-emerald-300 border-emerald-400/20 bg-emerald-500/10';
            return (
              <div key={item.user?._id || item.user?.id} className="rounded-2xl border border-white/8 bg-white/5 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-lg font-bold text-white">{item.user?.name || 'Unknown user'}</div>
                      <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.22em] ${color}`}>{level} risk</span>
                      <StatusBadge status={item.reviewStatus || 'cleared'} />
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {item.user?.email || item.user?.phone || 'No contact'} · {item.user?.country || 'n/a'} · {item.user?.userId || 'n/a'}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-right">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Risk score</div>
                    <div className={`mt-1 text-3xl font-black ${level === 'high' ? 'text-red-300' : level === 'medium' ? 'text-amber-300' : 'text-emerald-300'}`}>
                      {Number(item.riskScore || 0)}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/8 bg-[#050b17] p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    <AlertTriangle className="h-4 w-4 text-amber-300" />
                    Reasons
                  </div>
                  <ul className="space-y-1 text-sm text-slate-300">
                    {(item.reasons || []).map((reason: string) => <li key={reason}>• {reason}</li>)}
                  </ul>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => setAction({ type: 'clear', item })}
                    disabled={busyId === (item.user?._id || item.user?.id)}
                    className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/15 disabled:opacity-50"
                  >
                    Clear review
                  </button>
                  <button
                    onClick={() => setAction({ type: 'ban', item, reason: '' })}
                    disabled={busyId === (item.user?._id || item.user?.id)}
                    className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/15 disabled:opacity-50"
                  >
                    Ban user
                  </button>
                </div>
              </div>
            );
          }) : (
            <div className="rounded-2xl border border-white/8 bg-white/5 p-8 text-center text-slate-500">No users are currently flagged.</div>
          )}
        </div>
      </section>

      <ConfirmModal
        open={Boolean(action)}
        title={action?.type === 'clear' ? 'Clear fraud review' : 'Ban flagged user'}
        description={
          action?.type === 'clear'
            ? 'This will mark the selected user as reviewed and clear the active fraud score.'
            : `This will ban ${action?.item?.user?.name || 'the selected user'} from the ledger console.`
        }
        confirmLabel={busyId ? 'Working...' : 'Confirm'}
        danger={action?.type === 'ban'}
        onClose={() => action && !busyId && setAction(null)}
        onConfirm={() => {
          if (action?.type === 'clear') {
            void applyClear(action.item);
          } else if (action?.type === 'ban') {
            void applyBan(action.item, action.reason || 'Fraud risk detected');
          }
        }}
      >
        {action?.type === 'ban' && (
          <div className="mt-4">
            <label className="mb-2 block text-xs uppercase tracking-[0.24em] text-slate-500">Ban reason</label>
            <textarea
              autoFocus
              value={action.reason}
              onChange={(e) =>
                setAction((current) => (current && current.type === 'ban' ? { ...current, reason: e.target.value } : current))
              }
              rows={4}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
              placeholder="Describe why this account is being banned"
            />
          </div>
        )}
      </ConfirmModal>
    </div>
  );
}
