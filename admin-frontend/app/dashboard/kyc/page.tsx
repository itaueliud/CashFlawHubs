'use client';

import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';
import { CheckCircle, XCircle, ChevronDown, Clock, Search, Filter, ShieldAlert, Wallet, Users } from 'lucide-react';
import { ErrorBanner, LoadingSpinner, PageHeader, StatCard } from '../../../components/ui';

interface KycUser {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  country?: string;
  userId?: string;
  referralCode?: string;
  createdAt: string;
  identityVerificationStatus: string;
  idNumber?: string;
  idDocumentImage?: string;
  faceVerificationImage?: string;
  balanceUSD?: number;
  fraudRiskScore?: number;
  fraudRiskLevel?: 'low' | 'medium' | 'high';
  registrationContext?: {
    ipAddress?: string;
    deviceFingerprint?: string;
  };
}

interface PaginationData {
  total: number;
  page: number;
  limit: number;
}

const API_BASE = api.defaults.baseURL?.replace(/\/api$/, '') || 'http://localhost:5000';
const docUrl = (filename?: string) => (filename ? `${API_BASE}/uploads/registrations/${filename}` : null);

function RiskBadge({ user }: { user: KycUser }) {
  const level = user.fraudRiskLevel || (Number(user.fraudRiskScore || 0) >= 80 ? 'high' : Number(user.fraudRiskScore || 0) >= 45 ? 'medium' : 'low');
  const classes = {
    high: 'border-red-400/20 bg-red-500/10 text-red-300',
    medium: 'border-amber-400/20 bg-amber-500/10 text-amber-300',
    low: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300',
  }[level];

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.22em] ${classes}`}>
      <ShieldAlert className="h-3 w-3" />
      {level} risk
    </span>
  );
}

function KycUserRow({ user, onRefresh }: { user: KycUser; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const handleApprove = async () => {
    if (!confirm(`Approve KYC for ${user.name}?`)) return;
    setProcessing(true);
    try {
      await api.patch(`/admin/users/${user._id}/kyc`, { status: 'verified' });
      onRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to approve KYC');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    setProcessing(true);
    try {
      await api.patch(`/admin/users/${user._id}/kyc`, { status: 'rejected', rejectionReason: rejectReason });
      onRefresh();
      setShowRejectForm(false);
      setRejectReason('');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to reject KYC');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <tr className="border-b border-white/5 hover:bg-white/[0.03]">
        <td className="px-4 py-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="rounded p-1 hover:bg-white/10"
          >
            <ChevronDown className={`h-4 w-4 transform transition ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </td>
        <td className="px-4 py-3">
          <div className="font-semibold text-white">{user.name}</div>
          <div className="mt-1 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.22em] text-slate-500">
            <span className="rounded-full border border-white/8 px-2 py-1">{user.userId || 'n/a'}</span>
            <span className="rounded-full border border-white/8 px-2 py-1">{user.referralCode || 'no-ref'}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-slate-400">{user.email || user.phone || 'No contact'}</td>
        <td className="px-4 py-3 text-sm text-slate-400">{user.country || 'n/a'}</td>
        <td className="px-4 py-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3" />
            {new Date(user.createdAt).toLocaleDateString()}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <RiskBadge user={user} />
            {!expanded && (
              <button
                onClick={() => setExpanded(true)}
                className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20"
              >
                View details
              </button>
            )}
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-white/5 bg-white/5">
          <td colSpan={6} className="px-4 py-4">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Full Name</div>
                  <div className="mt-1 text-white">{user.name}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Email</div>
                  <div className="mt-1 text-white">{user.email || '—'}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Phone</div>
                  <div className="mt-1 text-white">{user.phone || '—'}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Country</div>
                  <div className="mt-1 text-white">{user.country || '—'}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Balance</div>
                  <div className="mt-1 flex items-center gap-2 text-white">
                    <Wallet className="h-4 w-4 text-cyan-300" />
                    ${Number(user.balanceUSD || 0).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Fraud Score</div>
                  <div className="mt-1 text-white">{user.fraudRiskScore ?? 0}</div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Registration IP</div>
                  <div className="mt-1 text-sm text-white">{user.registrationContext?.ipAddress || 'Not captured'}</div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Device Fingerprint</div>
                  <div className="mt-1 text-sm text-white break-all">{user.registrationContext?.deviceFingerprint || 'Not captured'}</div>
                </div>
              </div>

              <div className="rounded border border-white/10 bg-white/5 p-3 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Submitted KYC Documents</div>

                <div>
                  <div className="text-xs text-slate-500">ID Number</div>
                  <div className="mt-1 text-sm text-white">{user.idNumber || 'Not provided'}</div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="mb-1 text-xs text-slate-500">ID Document</div>
                    {docUrl(user.idDocumentImage) ? (
                      <a href={docUrl(user.idDocumentImage)!} target="_blank" rel="noreferrer">
                        <img src={docUrl(user.idDocumentImage)!} alt="ID document" className="max-h-56 rounded-lg border border-white/10 object-contain" />
                      </a>
                    ) : (
                      <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-xs text-slate-500">Not submitted</div>
                    )}
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-slate-500">Selfie / Face Verification</div>
                    {docUrl(user.faceVerificationImage) ? (
                      <a href={docUrl(user.faceVerificationImage)!} target="_blank" rel="noreferrer">
                        <img src={docUrl(user.faceVerificationImage)!} alt="Selfie" className="max-h-56 rounded-lg border border-white/10 object-contain" />
                      </a>
                    ) : (
                      <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-xs text-slate-500">Not submitted</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleApprove}
                  disabled={processing}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  <CheckCircle className="h-4 w-4" /> Approve KYC
                </button>
                <button
                  onClick={() => setShowRejectForm(!showRejectForm)}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-400/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20"
                >
                  <XCircle className="h-4 w-4" /> Reject KYC
                </button>
              </div>

              {showRejectForm && (
                <div className="rounded border border-red-500/20 bg-red-500/10 p-3 space-y-2">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection..."
                    className="w-full px-3 py-2 rounded text-sm bg-red-500/20 text-white placeholder-slate-400 outline-none"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleReject}
                      disabled={processing}
                      className="rounded-lg bg-red-600 px-3 py-1 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Reject KYC
                    </button>
                    <button
                      onClick={() => setShowRejectForm(false)}
                      className="rounded-lg border border-white/10 px-3 py-1 text-sm text-slate-300 hover:bg-white/10"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function KycQueuePage() {
  const [queue, setQueue] = useState<KycUser[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({ total: 0, page: 1, limit: 25 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const loadQueue = async (page = pagination.page, nextSearch = search, nextCountry = country) => {
    setLoading(true);
    try {
      const response = await api.get('/admin/kyc/queue', {
        params: {
          page,
          limit: pagination.limit,
          search: nextSearch.trim(),
          country: nextCountry.trim(),
        },
      });
      setQueue(response.data?.queue || []);
      setPagination(response.data?.pagination || { total: response.data?.count || 0, page, limit: pagination.limit });
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load KYC queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue(1, search, country);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pendingCount = pagination.total;
  const reviewedToday = useMemo(() => queue.filter((item) => item.identityVerificationStatus !== 'pending').length, [queue]);

  const totalPages = Math.max(Math.ceil(pagination.total / pagination.limit), 1);

  return (
    <div className="space-y-6">
      <PageHeader title="KYC Queue" description="Review identity verification requests with search, risk context, and quick approve/reject actions." />

      {error && <ErrorBanner message={error} />}

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Pending KYC" value={String(pendingCount)} sub="Awaiting approval" />
        <StatCard label="Loaded now" value={String(queue.length)} sub="Current page items" />
        <StatCard label="Reviewed" value={String(reviewedToday)} sub="Available on this page" />
      </section>

      <section className="card-surface soft-up rounded-[24px] p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/8 bg-white/5 px-4 py-3">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  loadQueue(1, e.currentTarget.value, country);
                }
              }}
              placeholder="Search by name, email, phone, userId, or referral code"
              className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none"
            />
          </div>
          <button
            onClick={() => setFiltersOpen((value) => !value)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white"
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
          <button
            onClick={() => loadQueue(1, search, country)}
            className="rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-500"
          >
            Refresh
          </button>
        </div>

        {filtersOpen && (
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="rounded-xl border border-white/8 bg-white/5 px-4 py-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Country filter</div>
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                onBlur={() => loadQueue(1, search, country)}
                placeholder="KE, UG, TZ, NG..."
                className="w-full bg-transparent text-sm text-white placeholder-slate-500 outline-none"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearch('');
                  setCountry('');
                  loadQueue(1, '', '');
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10"
              >
                Clear filters
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="card-surface soft-up overflow-hidden rounded-[24px]">
        {loading ? (
          <LoadingSpinner />
        ) : queue.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No pending KYC requests.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/8 bg-white/5">
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  <th className="px-4 py-3 w-8"></th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Country</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((user) => (
                  <KycUserRow key={user._id} user={user} onRefresh={() => loadQueue(pagination.page, search, country)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/8 bg-white/5 px-5 py-4 text-sm text-slate-300">
        <div>
          Page <span className="font-semibold text-white">{pagination.page}</span> of <span className="font-semibold text-white">{totalPages}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadQueue(Math.max(1, pagination.page - 1), search, country)}
            disabled={pagination.page <= 1 || loading}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-semibold text-white disabled:opacity-40"
          >
            Previous
          </button>
          <button
            onClick={() => loadQueue(Math.min(totalPages, pagination.page + 1), search, country)}
            disabled={pagination.page >= totalPages || loading}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-semibold text-white disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}

