'use client';

import React, { useEffect, useState } from 'react';
import api from '../../../lib/api';
import { Ban, CheckCircle2, Fingerprint, Flame, ShieldAlert, AlertTriangle, RefreshCw } from 'lucide-react';
import { ErrorBanner, LoadingSpinner, PageHeader, StatCard, StatusBadge } from '../../../components/ui';

type FlaggedUser = {
  user: {
    _id: string;
    name: string;
    email?: string;
    phone?: string;
    country?: string;
    userId?: string;
    referralCode?: string;
    activationStatus?: boolean;
    isBanned?: boolean;
    createdAt?: string;
    registrationIp?: string;
    deviceFingerprint?: string;
  };
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  reasons: string[];
  reviewStatus: 'flagged' | 'cleared' | 'banned';
  reviewAt?: string | null;
};

type DuplicateIpGroup = {
  ipAddress: string;
  count: number;
  userIds: string[];
};

type DuplicateFingerprintGroup = {
  fingerprint: string;
  count: number;
  userIds: string[];
  ips: string[];
};

export default function FraudPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/admin/fraud/overview');
      setData(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load fraud overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleClear = async (userId: string) => {
    setActionLoading(userId);
    try {
      await api.post(`/admin/fraud/${userId}/clear`, { reason: 'Reviewed and cleared by admin' });
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to clear flag');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBan = async (userId: string) => {
    setActionLoading(userId);
    try {
      await api.put(`/admin/users/${userId}/ban`, { reason: 'Fraud risk flagged in admin center' });
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to ban user');
    } finally {
      setActionLoading(null);
    }
  };

  const flagged: FlaggedUser[] = data?.flagged || [];
  const chargebacks: any[] = data?.chargebacks || [];
  const duplicateIpDetails: DuplicateIpGroup[] = data?.duplicateIpDetails || [];
  const duplicateFingerprintDetails: DuplicateFingerprintGroup[] = data?.duplicateFingerprintDetails || [];

  return (
    <div className="space-y-6">
      <PageHeader title="Fraud & Risk Center" description="Automatically flagged users, device matches, chargebacks, and branch-risk signals in one place." />

      {error && <ErrorBanner message={error} />}

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="Duplicate Phones" value={String(data?.duplicatePhones ?? 0)} sub="Shared across accounts" />
        <StatCard label="Duplicate IPs" value={String(data?.duplicateIps ?? 0)} sub="Same registration IP" />
        <StatCard label="Device Matches" value={String(data?.duplicateFingerprints ?? 0)} sub="Same fingerprint across users" />
        <StatCard label="Chargebacks" value={String(chargebacks.length)} sub="Manual review queue" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Fingerprint className="h-4 w-4 text-cyan-300" />
            Duplicate IPs
          </div>
          <div className="mt-4 space-y-3">
            {duplicateIpDetails.length === 0 ? (
              <div className="rounded-2xl border border-white/8 bg-white/5 p-4 text-sm text-slate-500">No duplicate IPs found yet.</div>
            ) : (
              duplicateIpDetails.map((row) => (
                <div key={row.ipAddress} className="rounded-2xl border border-white/8 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{row.ipAddress}</div>
                      <div className="mt-1 text-xs text-slate-500">{row.count} account(s) share this IP</div>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                      {row.userIds.length} users
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Fingerprint className="h-4 w-4 text-cyan-300" />
            Duplicate Device Fingerprints
          </div>
          <div className="mt-4 space-y-3">
            {duplicateFingerprintDetails.length === 0 ? (
              <div className="rounded-2xl border border-white/8 bg-white/5 p-4 text-sm text-slate-500">No duplicate device fingerprints found yet.</div>
            ) : (
              duplicateFingerprintDetails.map((row) => (
                <div key={row.fingerprint} className="rounded-2xl border border-white/8 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white break-all">{row.fingerprint}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {row.count} account(s) share this fingerprint
                        {row.ips.length > 0 ? ` · IPs: ${row.ips.filter(Boolean).join(', ')}` : ''}
                      </div>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                      {row.userIds.length} users
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="card-surface soft-up rounded-[24px] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-bold text-white">Flagged users</div>
            <p className="text-sm text-slate-400">Risk score is calculated from shared IPs, shared phones, shared device fingerprints, fast withdrawals, and recent earning spikes.</p>
          </div>
          <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {loading ? (
            <div className="xl:col-span-2"><LoadingSpinner /></div>
          ) : flagged.length === 0 ? (
            <div className="xl:col-span-2 rounded-2xl border border-white/8 bg-white/5 p-8 text-center text-slate-500">No users are currently flagged.</div>
          ) : (
            flagged.map((item) => (
              <div key={item.user._id} className="rounded-2xl border border-white/8 bg-slate-950/70 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-lg font-bold text-white">{item.user.name}</div>
                      <StatusBadge status={item.riskLevel} />
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {item.user.email || item.user.phone || 'No contact'} · {item.user.country || 'n/a'} · {item.user.userId || 'n/a'}
                    </div>
                    {(item.user.registrationIp || item.user.deviceFingerprint) && (
                      <div className="mt-2 space-y-1 text-[11px] text-slate-400">
                        {item.user.registrationIp && <div>Registration IP: {item.user.registrationIp}</div>}
                        {item.user.deviceFingerprint && <div className="break-all">Device fingerprint: {item.user.deviceFingerprint}</div>}
                      </div>
                    )}
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-right">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Risk score</div>
                    <div className={`mt-1 text-3xl font-black ${item.riskLevel === 'high' ? 'text-red-300' : item.riskLevel === 'medium' ? 'text-amber-300' : 'text-emerald-300'}`}>
                      {item.riskScore}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/8 bg-white/5 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    <ShieldAlert className="h-4 w-4 text-amber-300" />
                    Reasons
                  </div>
                  <ul className="space-y-1 text-sm text-slate-300">
                    {item.reasons.map((reason) => <li key={reason}>• {reason}</li>)}
                  </ul>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => handleClear(item.user._id)}
                    disabled={actionLoading === item.user._id}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-200 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Clear
                  </button>
                  <button
                    onClick={() => handleBan(item.user._id)}
                    disabled={actionLoading === item.user._id}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-200 disabled:opacity-50"
                  >
                    <Ban className="h-4 w-4" />
                    Ban
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Fingerprint className="h-4 w-4 text-cyan-300" />
            Chargeback tracker
          </div>
          <div className="mt-4 space-y-3">
            {chargebacks.length === 0 ? (
              <div className="text-sm text-slate-500">No chargebacks recorded yet.</div>
            ) : (
              chargebacks.map((row) => (
                <div key={row._id} className="rounded-2xl border border-white/8 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{row.user?.name || 'Unknown user'}</div>
                      <div className="text-xs text-slate-500">{row.providerTransactionId || row._id}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-red-300">${Number(row.amountUSD || 0).toFixed(2)}</div>
                      <div className="text-xs text-slate-500">{new Date(row.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                  {row.metadata && (
                    <div className="mt-3 text-xs text-slate-400">placement: {row.metadata.placement || 'n/a'} · type: {row.metadata.type || 'n/a'}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card-surface soft-up rounded-[24px] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Flame className="h-4 w-4 text-orange-300" />
            Review guidance
          </div>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4">Medium risk: compare device, IP, and referral chain before clearing.</div>
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4">High risk: same fingerprint plus rapid withdrawals should usually be banned and investigated.</div>
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4">Chargebacks should always be reviewed before reward reversal or account closure.</div>
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4">Use the referral tree to spot branch abuse and clustered fake accounts quickly.</div>
          </div>
        </div>
      </section>
    </div>
  );
}
