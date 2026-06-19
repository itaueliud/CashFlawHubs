'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trophy, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, CalendarClock } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

type Challenge = {
  _id: string;
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
  expiresAt?: string | null;
  sortOrder?: number;
};

type FormState = {
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
  expiresAt: string;
};

const emptyForm: FormState = {
  title: '',
  description: '',
  type: 'mixed',
  eventType: 'task_complete',
  targetCount: 1,
  rewardUSD: 0.05,
  xpReward: 20,
  isDaily: true,
  resetDaily: true,
  isActive: true,
  sortOrder: 0,
  expiresAt: '',
};

const datetimeToInput = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 16);
};

export default function AdminChallengesPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const canUsePage = useMemo(() => ['admin', 'superadmin'].includes(String(user?.role || '')), [user?.role]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-challenges'],
    queryFn: () => api.get('/admin/challenges').then((response) => response.data.challenges as Challenge[]),
    enabled: canUsePage,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-challenges'] });

  const saveMutation = useMutation({
    mutationFn: async (payload: FormState) => {
      const body = {
        ...payload,
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt).toISOString() : null,
      };

      if (editing) {
        return api.patch(`/admin/challenges/${editing}`, body);
      }
      return api.post('/admin/challenges', body);
    },
    onSuccess: () => {
      toast.success(editing ? 'Challenge updated' : 'Challenge created');
      refresh();
      setForm(emptyForm);
      setEditing(null);
      setShowForm(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to save challenge');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/challenges/${id}`),
    onSuccess: () => {
      toast.success('Challenge deleted');
      refresh();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete challenge');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/challenges/${id}`, { isActive }),
    onSuccess: refresh,
  });

  const challenges: Challenge[] = data || [];

  const startEdit = (challenge: Challenge) => {
    setEditing(challenge._id);
    setForm({
      title: challenge.title,
      description: challenge.description,
      type: challenge.type,
      eventType: challenge.eventType,
      targetCount: challenge.targetCount,
      rewardUSD: challenge.rewardUSD,
      xpReward: challenge.xpReward,
      isDaily: challenge.isDaily,
      resetDaily: challenge.resetDaily,
      isActive: challenge.isActive,
      sortOrder: challenge.sortOrder || 0,
      expiresAt: datetimeToInput(challenge.expiresAt || null),
    });
    setShowForm(true);
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  if (!canUsePage) {
    return <div className="card text-sm text-slate-400">You do not have access to this page.</div>;
  }

  return (
    <div className="dashboard-shell">
      <div className="card bg-gradient-to-r from-blue-500/10 to-cyan-500/5 border-blue-500/30">
        <div className="dashboard-toolbar">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-2">
              <Trophy size={22} className="text-blue-400" /> Challenge Manager
            </h1>
            <p className="text-sm text-slate-300 mt-1">Manage daily quests and milestone rewards from one place.</p>
          </div>
          <button
            onClick={() => {
              setEditing(null);
              setForm(emptyForm);
              setShowForm(true);
            }}
            className="btn-primary text-sm flex items-center gap-2"
          >
            <Plus size={14} /> New Challenge
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card border-blue-500/20">
          <div className="dashboard-toolbar text-sm text-blue-300 mb-4">
            <CalendarClock size={14} /> {editing ? 'Edit challenge' : 'Create challenge'}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Title</span>
              <input className="input w-full" value={form.title} onChange={(e) => setField('title', e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Event Type</span>
              <select className="input w-full" value={form.eventType} onChange={(e) => setField('eventType', e.target.value)}>
                <option value="login">login</option>
                <option value="survey_complete">survey_complete</option>
                <option value="survey_complete_3">survey_complete_3</option>
                <option value="offerwall_complete">offerwall_complete</option>
                <option value="task_complete">task_complete</option>
                <option value="task_complete_3">task_complete_3</option>
                <option value="task_complete_5">task_complete_5</option>
                <option value="referral">referral</option>
                <option value="referral_3">referral_3</option>
                <option value="share_referral">share_referral</option>
                <option value="daily_login_streak_3">daily_login_streak_3</option>
                <option value="daily_login_streak_7">daily_login_streak_7</option>
                <option value="login_streak_14">login_streak_14</option>
                <option value="login_streak_30">login_streak_30</option>
                <option value="job_apply">job_apply</option>
                <option value="job_post">job_post</option>
                <option value="profile_complete">profile_complete</option>
                <option value="wallet_connect">wallet_connect</option>
                <option value="first_withdrawal">first_withdrawal</option>
                <option value="chat_message">chat_message</option>
                <option value="deposit">deposit</option>
                <option value="earning_milestone_1usd">earning_milestone_1usd</option>
                <option value="earning_milestone_5usd">earning_milestone_5usd</option>
              </select>
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs text-slate-400">Description</span>
              <input className="input w-full" value={form.description} onChange={(e) => setField('description', e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Type</span>
              <select className="input w-full" value={form.type} onChange={(e) => setField('type', e.target.value)}>
                <option value="survey">survey</option>
                <option value="task">task</option>
                <option value="referral">referral</option>
                <option value="login">login</option>
                <option value="mixed">mixed</option>
                <option value="offerwall">offerwall</option>
                <option value="job">job</option>
                <option value="profile">profile</option>
                <option value="wallet">wallet</option>
                <option value="chat">chat</option>
                <option value="withdrawal">withdrawal</option>
                <option value="earnings">earnings</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Target Count</span>
              <input type="number" min={1} className="input w-full" value={form.targetCount} onChange={(e) => setField('targetCount', Number(e.target.value))} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-400">XP Reward</span>
              <input type="number" min={0} className="input w-full" value={form.xpReward} onChange={(e) => setField('xpReward', Number(e.target.value))} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-400">USD Reward</span>
              <input type="number" min={0} step="0.01" className="input w-full" value={form.rewardUSD} onChange={(e) => setField('rewardUSD', Number(e.target.value))} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Sort Order</span>
              <input type="number" className="input w-full" value={form.sortOrder} onChange={(e) => setField('sortOrder', Number(e.target.value))} />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs text-slate-400">Expires At</span>
              <input type="datetime-local" className="input w-full" value={form.expiresAt} onChange={(e) => setField('expiresAt', e.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={form.isDaily} onChange={(e) => setField('isDaily', e.target.checked)} />
              Daily
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={form.resetDaily} onChange={(e) => setField('resetDaily', e.target.checked)} />
              Reset daily
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setField('isActive', e.target.checked)} />
              Active
            </label>
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => saveMutation.mutate(form)}
              disabled={saveMutation.isPending}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Saving...' : editing ? 'Save Changes' : 'Create Challenge'}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setEditing(null);
                setForm(emptyForm);
              }}
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="card text-sm text-slate-400">Loading challenges...</div>
      ) : (
        <div className="space-y-2">
          {challenges.map((challenge) => (
            <div
              key={challenge._id}
              className={`card border flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between ${challenge.isActive ? 'border-green-500/20' : 'border-slate-700/50 opacity-60'}`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <div className="font-semibold text-sm text-white">{challenge.title}</div>
                  {!challenge.resetDaily && (
                    <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-purple-300">
                      Milestone
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">{challenge.description}</div>
                <div className="flex items-center gap-2 mt-1 text-xs flex-wrap">
                  <span className="badge-green">${challenge.rewardUSD}</span>
                  <span className="text-emerald-400">+{challenge.xpReward} XP</span>
                  <span className="text-slate-500">Â· {challenge.eventType}</span>
                  <span className="text-slate-500">Â· {challenge.type}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                <button
                  onClick={() => toggleMutation.mutate({ id: challenge._id, isActive: !challenge.isActive })}
                  title={challenge.isActive ? 'Deactivate' : 'Activate'}
                >
                  {challenge.isActive
                    ? <ToggleRight size={20} className="text-green-400" />
                    : <ToggleLeft size={20} className="text-slate-500" />}
                </button>
                <button onClick={() => startEdit(challenge)} title="Edit">
                  <Pencil size={15} className="text-blue-400" />
                </button>
                <button onClick={() => deleteMutation.mutate(challenge._id)} title="Delete">
                  <Trash2 size={15} className="text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


