'use client';

import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';
import { PageHeader, LoadingSpinner, ErrorBanner, StatCard } from '../../../components/ui';
import { Pencil, Save, X, Plus, Trash2, ToggleLeft, ToggleRight, Search } from 'lucide-react';

type Challenge = {
  _id: string;
  title: string;
  description?: string;
  type?: string;
  eventType?: string;
  targetCount?: number;
  rewardUSD?: number;
  xpReward?: number;
  isActive: boolean;
  resetDaily: boolean;
  isDaily: boolean;
  sortOrder?: number;
  createdAt: string;
};

type ChallengeForm = {
  title: string;
  description: string;
  type: string;
  eventType: string;
  targetCount: number;
  rewardUSD: number;
  xpReward: number;
  isDaily: boolean;
  resetDaily: boolean;
  isActive: boolean;
  sortOrder: number;
};

const emptyForm: ChallengeForm = {
  title: '',
  description: '',
  type: 'mixed',
  eventType: 'task_complete',
  targetCount: 1,
  rewardUSD: 0,
  xpReward: 20,
  isDaily: true,
  resetDaily: true,
  isActive: true,
  sortOrder: 0,
};

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Challenge | null>(null);
  const [form, setForm] = useState<ChallengeForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const loadChallenges = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/challenges');
      setChallenges(res.data?.challenges || []);
      setError(null);
    } catch (err: any) {
      setError(String(err?.response?.data?.message || err.message || 'Failed to load challenges'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChallenges();
  }, []);

  const filteredChallenges = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return challenges;
    return challenges.filter((challenge) =>
      [challenge.title, challenge.description, challenge.type, challenge.eventType]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [challenges, search]);

  const activeChallenges = useMemo(
    () => filteredChallenges.filter((challenge) => challenge.isActive),
    [filteredChallenges]
  );

  const dailyChallenges = useMemo(
    () => filteredChallenges.filter((challenge) => challenge.isDaily),
    [filteredChallenges]
  );

  const startCreate = () => {
    setEditing({ ...emptyForm, _id: 'new' } as Challenge);
    setForm(emptyForm);
  };

  const startEdit = (challenge: Challenge) => {
    setEditing(challenge);
    setForm({
      title: challenge.title || '',
      description: challenge.description || '',
      type: challenge.type || 'mixed',
      eventType: challenge.eventType || 'task_complete',
      targetCount: challenge.targetCount || 1,
      rewardUSD: challenge.rewardUSD || 0,
      xpReward: challenge.xpReward || 20,
      isDaily: challenge.isDaily,
      resetDaily: challenge.resetDaily,
      isActive: challenge.isActive,
      sortOrder: challenge.sortOrder || 0,
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      if (editing._id === 'new') {
        await api.post('/admin/challenges', form);
      } else {
        await api.patch(`/admin/challenges/${editing._id}`, form);
      }
      await loadChallenges();
      setEditing(null);
      setForm(emptyForm);
    } catch (err: any) {
      setError(String(err?.response?.data?.message || err.message || 'Failed to save challenge'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (challenge: Challenge) => {
    try {
      await api.patch(`/admin/challenges/${challenge._id}`, { isActive: !challenge.isActive });
      await loadChallenges();
    } catch (err: any) {
      setError(String(err?.response?.data?.message || err.message || 'Failed to toggle challenge'));
    }
  };

  const deleteChallenge = async (challenge: Challenge) => {
    if (!confirm(`Delete challenge "${challenge.title}"?`)) return;
    try {
      await api.delete(`/admin/challenges/${challenge._id}`);
      await loadChallenges();
    } catch (err: any) {
      setError(String(err?.response?.data?.message || err.message || 'Failed to delete challenge'));
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Challenges" description="Create, tune, activate, and remove challenge tasks for the reward engine." />

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total" value={String(challenges.length)} sub="Configured challenges" />
        <StatCard label="Active" value={String(activeChallenges.length)} sub="Currently running" />
        <StatCard label="Daily" value={String(dailyChallenges.length)} sub="Resets every day" />
        <StatCard label="Inactive" value={String(challenges.length - activeChallenges.length)} sub="Paused challenges" />
      </section>

      <section className="card-surface soft-up rounded-[24px] p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-semibold text-white">Challenge library</div>
            <div className="text-xs text-slate-400">Search, create, toggle, and delete challenge definitions.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/5 px-4 py-2">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search challenges..."
                className="bg-transparent text-sm text-white placeholder-slate-500 outline-none"
              />
            </div>
            <button
              onClick={startCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
            >
              <Plus className="h-4 w-4" /> New challenge
            </button>
          </div>
        </div>
      </section>

      <section className="card-surface soft-up rounded-[24px] p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredChallenges.slice(0, 6).map((challenge) => (
            <div key={challenge._id} className="rounded-2xl border border-white/8 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-white">{challenge.title}</div>
                  <div className="mt-1 text-xs text-slate-400">{challenge.description || 'No description'}</div>
                </div>
                <button onClick={() => toggleActive(challenge)} className="text-slate-300 hover:text-white" title="Toggle active">
                  {challenge.isActive ? <ToggleRight className="h-5 w-5 text-emerald-300" /> : <ToggleLeft className="h-5 w-5 text-slate-400" />}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.22em] text-slate-500">
                <span className="rounded-full border border-white/8 px-2 py-1">{challenge.eventType || 'event'}</span>
                <span className="rounded-full border border-white/8 px-2 py-1">{challenge.isDaily ? 'daily' : 'one-off'}</span>
                <span className="rounded-full border border-white/8 px-2 py-1">{challenge.isActive ? 'active' : 'paused'}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="overflow-auto rounded-2xl border border-white/8 bg-white/5">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8 text-left text-xs uppercase tracking-[0.22em] text-slate-500">
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Daily</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3">Reset Daily</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredChallenges.map((challenge) => (
              <tr key={challenge._id} className="hover:bg-white/[0.03]">
                <td className="px-4 py-3 text-slate-200">
                  <div className="font-semibold text-white">{challenge.title || 'Untitled'}</div>
                  <div className="text-xs text-slate-500">{challenge.description || 'No description'}</div>
                </td>
                <td className="px-4 py-3 text-slate-400">{challenge.isDaily ? 'Yes' : 'No'}</td>
                <td className="px-4 py-3 text-slate-400">{challenge.isActive ? 'Yes' : 'No'}</td>
                <td className="px-4 py-3 text-slate-400">{challenge.resetDaily ? 'Yes' : 'No'}</td>
                <td className="px-4 py-3 text-slate-200">{new Date(challenge.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => startEdit(challenge)}
                      className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/15"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => toggleActive(challenge)}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
                    >
                      {challenge.isActive ? <ToggleLeft className="h-3.5 w-3.5 text-emerald-300" /> : <ToggleRight className="h-3.5 w-3.5 text-slate-400" />}
                      {challenge.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => deleteChallenge(challenge)}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/15"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredChallenges.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">No challenges available.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl rounded-[28px] border border-white/10 bg-slate-950 p-5 shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between gap-4 border-b border-white/8 pb-4">
              <div>
                <h3 className="text-xl font-black text-white">{editing._id === 'new' ? 'Create Challenge' : 'Edit Challenge'}</h3>
                <p className="text-sm text-slate-400">Configure the challenge safely and save it to the reward engine.</p>
              </div>
              <button onClick={() => setEditing(null)} className="rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/5">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Title</span>
                <input className="input w-full" value={form.title} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Description</span>
                <input className="input w-full" value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Type</span>
                <input className="input w-full" value={form.type} onChange={(e) => setForm((c) => ({ ...c, type: e.target.value }))} />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Event Type</span>
                <input className="input w-full" value={form.eventType} onChange={(e) => setForm((c) => ({ ...c, eventType: e.target.value }))} />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Target Count</span>
                <input type="number" min={1} className="input w-full" value={form.targetCount} onChange={(e) => setForm((c) => ({ ...c, targetCount: Number(e.target.value) }))} />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">XP Reward</span>
                <input type="number" min={0} className="input w-full" value={form.xpReward} onChange={(e) => setForm((c) => ({ ...c, xpReward: Number(e.target.value) }))} />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">USD Reward</span>
                <input type="number" min={0} step="0.01" className="input w-full" value={form.rewardUSD} onChange={(e) => setForm((c) => ({ ...c, rewardUSD: Number(e.target.value) }))} />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Sort Order</span>
                <input type="number" className="input w-full" value={form.sortOrder} onChange={(e) => setForm((c) => ({ ...c, sortOrder: Number(e.target.value) }))} />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={form.isDaily} onChange={(e) => setForm((c) => ({ ...c, isDaily: e.target.checked }))} />
                Daily
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={form.resetDaily} onChange={(e) => setForm((c) => ({ ...c, resetDaily: e.target.checked }))} />
                Reset Daily
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((c) => ({ ...c, isActive: e.target.checked }))} />
                Active
              </label>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={saveEdit}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save changes'}
              </button>
              <button onClick={() => setEditing(null)} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/5">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
