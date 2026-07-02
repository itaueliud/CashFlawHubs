'use client';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import ThemeToggle from '@/components/ThemeToggle';
import { useLocalTheme } from '@/components/ThemeProvider';
import { Search, Building2, Clock, Plus, Loader2, ArrowRight, Briefcase, SearchCheck, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

const EMPTY_FORM = {
  title: '',
  company: '',
  category: '',
  jobType: 'contract',
  salary: '',
  description: '',
  applicationUrl: '',
  budgetAmount: '',
  budgetCurrency: 'KES',
  categoryOther: '',
};
const JOB_TYPES = ['full-time', 'part-time', 'contract', 'internship'];
const BUDGET_CURRENCIES = ['KES', 'USD', 'UGX', 'TZS', 'GHS', 'NGN', 'ETB', 'XOF', 'XAF', 'CDF', 'LSL', 'MWK', 'MZN', 'RWF', 'SLL', 'ZMW'];

export default function JobsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, toggleTheme } = useLocalTheme('cfh-jobs-theme', 'light');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [view, setView] = useState<'unique' | 'all' | 'duplicates'>('unique');
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<'browse' | 'recent' | 'post' | 'onsite'>('browse');
  const [posting, setPosting] = useState(false);
  const [syncingJobs, setSyncingJobs] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    const nextTab = searchParams?.get('tab');
    if (nextTab === 'browse' || nextTab === 'recent' || nextTab === 'post' || nextTab === 'onsite') {
      setTab(nextTab);
    }
  }, [searchParams]);
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();
  const isStaff = ['admin', 'superadmin', 'ledger'].includes(user?.role || '');

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', search, category, page, view],
    queryFn: () =>
      api.get(`/jobs?search=${search}&category=${category}&page=${page}&limit=20&view=${view}`).then((r) => r.data),
  });
  const { data: catData } = useQuery({
    queryKey: ['job-cats'],
    queryFn: async () => {
      try {
        const response = await api.get('/jobs/categories');
        return response.data.categories || [];
      } catch {
        return [];
      }
    },
  });

  const { data: recentData, isLoading: recentLoading } = useQuery({
    queryKey: ['jobs-recent'],
    queryFn: () => api.get(`/jobs?limit=20&page=1&view=unique&sort=newest`).then((r) => r.data),
    enabled: tab === 'recent',
    staleTime: 60_000,
  });
  const recentJobs: any[] = recentData?.jobs || [];

  const { data: onsiteData, isLoading: onsiteLoading } = useQuery({
    queryKey: ['jobs-onsite', search, category],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '50', page: '1', view: 'unique', sort: 'newest', location: 'onsite' });
      if (search.trim()) params.set('search', search.trim());
      if (category) params.set('category', category);
      return api.get(`/jobs?${params.toString()}`).then((r) => r.data);
    },
    enabled: tab === 'onsite',
    staleTime: 60_000,
  });
  const onsiteJobs: any[] = onsiteData?.jobs || [];



  const jobs = data?.jobs || [];
  const pagination = data?.pagination || {};
  const visibleJobs = jobs;
  const visibleRecentJobs = recentJobs;
  const tokenPolicy = data?.tokenPolicy;
  const availableCategories: string[] = (catData && catData.length > 0) ? catData : ['Other'];

  const updateField = (key: string, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const onPostJob = async () => {
    if (!form.category) {
      toast.error(t('jobs.board.labels.category'));
      return;
    }

    if (form.category === 'Other') {
      const custom = String(form.categoryOther || '').trim();
      if (custom.length < 3 || custom.length > 60) {
        toast.error(t('jobs.board.labels.otherCategory'));
        return;
      }
    }

    setPosting(true);
    try {
      const payload = {
        ...form,
        budgetAmount: form.budgetAmount ? Number(form.budgetAmount) : undefined,
        tags: [],
      };
      const response = await api.post('/jobs', payload);
      if (user) {
        setUser({ ...user, tokenBalance: response.data.tokenBalance });
      }
      setForm(EMPTY_FORM);
      setTab('recent');
      toast.success(t('jobs.board.actions.postJob', { tokens: response.data.tokensSpent }));
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs-recent'] });
      queryClient.invalidateQueries({ queryKey: ['my-posted-jobs'] });
      window.dispatchEvent(new Event('dashboard-my-posts-updated'));
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('jobs.board.actions.postJobShort'));
    } finally {
      setPosting(false);
    }
  };

  const onSyncJobs = async () => {
    setSyncingJobs(true);
    try {
      // Job sync can take longer than typical API calls (multiple providers + DB writes).
      const response = await api.post('/jobs/sync-now', {}, { timeout: 120000 });
      const adzuna = response.data?.providers?.adzuna;
      const adzunaText = adzuna ? ` Adzuna: ${adzuna.status}${typeof adzuna.synced === 'number' ? ` (${adzuna.synced})` : ''}.` : '';
      const jsearch = response.data?.providers?.jsearch;
      const jsearchText = jsearch ? ` JSearch: ${jsearch.status}${typeof jsearch.synced === 'number' ? ` (${jsearch.synced})` : ''}.` : '';
      const careerjet = response.data?.providers?.careerjet;
      const careerjetText = careerjet ? ` Careerjet: ${careerjet.status}${typeof careerjet.synced === 'number' ? ` (${careerjet.synced})` : ''}.` : '';
      toast.success(`${response.data?.message || t('jobs.board.actions.syncSources')}${adzunaText}${jsearchText}${careerjetText}`);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job-cats'] });
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('jobs.board.actions.syncSources'));
    } finally {
      setSyncingJobs(false);
    }
  };


  return (
    <div className={`space-y-6 ${theme}`}>
      <div className="overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-gradient-to-br from-emerald-50 via-white to-slate-50 shadow-2xl shadow-emerald-950/5 dark:from-emerald-950 dark:via-slate-950 dark:to-slate-900 dark:shadow-emerald-950/20">
        <div className="grid gap-8 p-6 lg:grid-cols-[1.4fr_0.8fr] lg:p-8">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
              <Sparkles size={12} /> {t('jobs.board.badge')}
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white sm:text-5xl">{t('jobs.board.title')}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
                {t('jobs.board.description')}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                <div className="text-xs text-slate-500 dark:text-slate-400">{t('jobs.board.tokenBalance')}</div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">{user?.tokenBalance || 0}T</div>
              </div>
              <div className="rounded-2xl border border-cyan-400/15 bg-cyan-50 px-4 py-3 dark:bg-cyan-500/10">
                <div className="text-xs text-slate-500 dark:text-slate-400">Total Jobs</div>
                <div className="text-2xl font-black text-cyan-600 dark:text-cyan-300">{isLoading ? '…' : (data?.pagination?.total ?? jobs.length)}</div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {[
              { label: t('jobs.board.fastApply'), value: t('jobs.board.fastApplyValue'), icon: SearchCheck },
              { label: t('jobs.board.remoteFirst'), value: t('jobs.board.remoteFirstValue'), icon: Briefcase },
              { label: t('jobs.board.trustedFlow'), value: t('jobs.board.trustedFlowValue'), icon: ShieldCheck },
              { label: t('jobs.board.marketplaceFeel'), value: t('jobs.board.marketplaceFeelValue'), icon: TrendingUp },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950/70">
                <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <item.icon size={18} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">{item.label}</div>
                  <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-emerald-500/10 dark:bg-slate-900/90">
        <div className="flex items-center gap-2">
          {(['browse', 'recent', 'post', 'onsite'] as const).map((tabName) => (
            <button
              key={tabName}
              onClick={() => setTab(tabName)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${tab === tabName ? 'bg-emerald-500 text-slate-950' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'}`}
            >
              {tabName === 'recent' ? '🕐 Recent' : tabName === 'onsite' ? '🏢 On-site' : tabName === 'post' ? 'Post' : 'Browse'}
            </button>
          ))}
        </div>
        <ThemeToggle className="h-9 w-9" theme={theme} toggleTheme={toggleTheme} />
      </div>

      {tab === 'recent' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-500/10 bg-slate-900/90 p-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-white">Recently Posted Jobs</h2>
              <p className="text-xs text-slate-400 mt-0.5">Latest opportunities added to the platform</p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
              <Clock size={11} /> Live feed
            </div>
          </div>

          {recentLoading ? (
            <div className="space-y-3">
              {Array(6).fill(0).map((_, i) => (
                <div key={i} className="h-24 rounded-2xl bg-slate-800/50 animate-pulse" />
              ))}
            </div>
          ) : visibleRecentJobs.length === 0 ? (
            <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 py-16 text-center text-slate-400 text-sm">
              No jobs match the current filters. Try clearing location filters.
            </div>
          ) : (
            <div className="grid gap-3">
              {visibleRecentJobs.map((job: any) => {
                const postedAt = new Date(job.publishedAt);
                const now = new Date();
                const diffMs = now.getTime() - postedAt.getTime();
                const diffMins = Math.floor(diffMs / 60000);
                const diffHours = Math.floor(diffMins / 60);
                const diffDays = Math.floor(diffHours / 24);

                const timeAgo =
                  diffMins < 1   ? 'Just now' :
                  diffMins < 60  ? `${diffMins}m ago` :
                  diffHours < 24 ? `${diffHours}h ago` :
                  diffDays < 7   ? `${diffDays}d ago` :
                  postedAt.toLocaleDateString();

                const isNew = diffHours < 24;
                const locationLabel = String(job.location || 'Remote');
                const isOnSite = locationLabel.toLowerCase().includes('on-site') || locationLabel.toLowerCase().includes('onsite');

                return (
                  <div
                    key={job._id}
                    className="group rounded-[1.5rem] border border-slate-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-emerald-400/40 hover:shadow-xl hover:shadow-slate-200/60 dark:border-emerald-500/10 dark:bg-slate-900/90 dark:hover:border-emerald-400/30 dark:hover:shadow-emerald-950/15"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {isNew && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300 uppercase tracking-wider">
                              ✦ New
                            </span>
                          )}
                          <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-[11px] text-slate-300 capitalize">
                            {job.jobType}
                          </span>
                          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] ${isOnSite ? 'border-cyan-400/20 bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300' : 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                            {locationLabel}
                          </span>
                          {job.category && (
                            <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-[11px] text-blue-300">
                              {job.category === 'Other' && job.categoryOther ? job.categoryOther : job.category}
                            </span>
                          )}
                          {job.salary && (
                            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] text-emerald-300">
                              {job.salary}
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-slate-900 leading-snug dark:text-white">{job.title}</h3>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <Building2 size={11} /> {job.company || 'Unknown company'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            <span className={isNew ? 'text-emerald-400 font-semibold' : ''}>{timeAgo}</span>
                          </span>
                          {job.location && (
                            <span className="capitalize">{job.location}</span>
                          )}
                        </div>

                        {job.description && (
                          <p className="text-xs text-slate-500 leading-5 line-clamp-2 max-w-xl">
                            {job.description}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                        <button
                          type="button"
                          onClick={() => {
                            if (!job?._id) return;
                            router.push(`/dashboard/jobs/${job._id}`);
                          }}
                          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
                        >
                          {isOnSite ? 'Apply On Site' : 'View Job'} <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="rounded-2xl border border-dashed border-emerald-500/20 bg-emerald-500/5 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-white">Have a remote role to fill?</div>
              <div className="text-xs text-slate-400 mt-0.5">Post it here and reach the CashFlawHubs community</div>
            </div>
            <button
              onClick={() => setTab('post')}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition shrink-0"
            >
              <Plus size={15} /> Post a Job
            </button>
          </div>
        </div>
      )}

      {tab === 'post' ? (
        <div className="mx-auto max-w-4xl space-y-4 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-xl dark:border-emerald-500/10 dark:bg-slate-900/90 md:p-6">
          <div className="mb-2">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">{t('jobs.board.postRole')}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('jobs.board.postRoleDescription')}</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-600 mb-1 block dark:text-slate-300">{t('jobs.board.labels.jobTitle')}</label>
              <input className="input" value={form.title} onChange={(e) => updateField('title', e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-300 mb-1 block">{t('jobs.board.labels.company')}</label>
              <input className="input" value={form.company} onChange={(e) => updateField('company', e.target.value)} />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-slate-300 mb-1 block">{t('jobs.board.labels.category')}</label>
              <select className="input" value={form.category} onChange={(e) => updateField('category', e.target.value)}>
                <option value="">{t('jobs.board.filters.allCategories')}</option>
                {availableCategories.map((option: string) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-300 mb-1 block">{t('jobs.board.labels.jobType')}</label>
              <select className="input" value={form.jobType} onChange={(e) => updateField('jobType', e.target.value)}>
                {JOB_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-300 mb-1 block">Location</label>
              <div className="input cursor-not-allowed opacity-80">On-site</div>
              <p className="mt-1 text-xs text-slate-500">All posted jobs are saved as on-site automatically.</p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-slate-300 mb-1 block">{t('jobs.board.labels.salary')}</label>
              <input className="input" value={form.salary} onChange={(e) => updateField('salary', e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-300 mb-1 block">{t('jobs.board.labels.budgetAmount')}</label>
              <input className="input" type="number" value={form.budgetAmount} onChange={(e) => updateField('budgetAmount', e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-300 mb-1 block">{t('jobs.board.labels.budgetCurrency')}</label>
              <select className="input" value={form.budgetCurrency} onChange={(e) => updateField('budgetCurrency', e.target.value)}>
                {BUDGET_CURRENCIES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
          </div>

          {form.category === 'Other' && (
            <div>
              <label className="text-sm text-slate-300 mb-1 block">{t('jobs.board.labels.otherCategory')}</label>
              <input
                className="input"
                maxLength={60}
                value={form.categoryOther}
                onChange={(e) => updateField('categoryOther', e.target.value)}
                placeholder={t('jobs.board.placeholders.otherCategory')}
              />
              <div className="mt-1 text-xs text-slate-500">{form.categoryOther.length}/60</div>
            </div>
          )}

          <div>
            <label className="text-sm text-slate-300 mb-1 block">{t('jobs.board.labels.applicationUrl')}</label>
            <input className="input" value={form.applicationUrl} onChange={(e) => updateField('applicationUrl', e.target.value)} />
          </div>

          <div>
            <label className="text-sm text-slate-300 mb-1 block">{t('jobs.board.labels.description')}</label>
            <textarea className="input min-h-32" value={form.description} onChange={(e) => updateField('description', e.target.value)} />
          </div>

          <button onClick={onPostJob} disabled={posting} className="btn-primary flex items-center gap-2">
            {posting && <Loader2 size={16} className="animate-spin" />}
            {t('jobs.board.actions.postJob', { tokens: tokenPolicy?.postingCost || 10 })}
          </button>
        </div>
      ) : tab === 'browse' ? (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-emerald-500/10 dark:bg-slate-900/90">
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('jobs.board.placeholders.search')} className="input border-slate-300 bg-white text-slate-900 placeholder-slate-400 pl-9 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
              </div>
              <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="input border-slate-300 bg-white text-slate-900 lg:w-56 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                <option value="">{t('jobs.board.filters.allCategories')}</option>
                {availableCategories.map((c: string) => <option key={c} value={c}>{c}</option>)}
              </select>
              {isStaff && (
                <select
                  value={view}
                  onChange={(e) => {
                    setView(e.target.value as 'unique' | 'all' | 'duplicates');
                    setPage(1);
                  }}
                  className="input border-slate-300 bg-white text-slate-900 lg:w-56 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                >
                  <option value="unique">{t('jobs.board.filters.uniqueJobs')}</option>
                  <option value="all">{t('jobs.board.filters.rawFeed')}</option>
                  <option value="duplicates">{t('jobs.board.filters.duplicateGroups')}</option>
                </select>
              )}
              <button onClick={() => setTab('post')} className="btn-primary inline-flex items-center gap-2 lg:shrink-0">
                <Plus size={16} /> {t('jobs.board.actions.postJobShort')}
              </button>
              {isStaff && (
                <button
                  onClick={onSyncJobs}
                  disabled={syncingJobs}
                  className="btn-secondary inline-flex items-center gap-2 lg:shrink-0 disabled:opacity-60"
                >
                  {syncingJobs && <Loader2 size={16} className="animate-spin" />}
                  {t('jobs.board.actions.syncSources')}
                </button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="card h-20 animate-pulse" />)}</div>
          ) : visibleJobs.length === 0 ? (
            <div className="card text-center py-12 text-slate-400">{t('jobs.board.filters.noJobs')}</div>
          ) : (
            <div className="grid gap-3">
              {visibleJobs.map((job: any) => {
                const locationLabel = String(job.location || 'Remote');
                const isOnSite = locationLabel.toLowerCase().includes('on-site') || locationLabel.toLowerCase().includes('onsite');
                return (
                <div key={job._id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 transition-all hover:-translate-y-1 hover:border-emerald-400/40 hover:shadow-xl hover:shadow-slate-200/60 dark:border-emerald-500/10 dark:bg-slate-900/90 dark:hover:border-emerald-400/30 dark:hover:shadow-emerald-950/15">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${isOnSite ? 'border-cyan-400/20 bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300' : 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                          {locationLabel}
                        </span>
                        <span className="badge-blue">{job.category === 'Other' && job.categoryOther ? t('jobs.board.badges.other', { category: job.categoryOther }) : job.category}</span>
                        {isStaff && Number(job.duplicateCount || 1) > 1 && (
                          <span className="rounded-full border border-yellow-400/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-200">
                            {t('jobs.board.badges.duplicates', { count: job.duplicateCount })}
                          </span>
                        )}
                        {job.salary && <span className="badge" style={{ background: 'rgba(16,185,129,0.14)', color: '#6ee7b7' }}>{job.salary}</span>}
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">{job.title}</h3>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1"><Building2 size={12} />{job.company}</span>
                          <span className="flex items-center gap-1"><Clock size={12} />{new Date(job.publishedAt).toLocaleDateString()}</span>
                          <span className="capitalize">{job.jobType}</span>
                          </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-start gap-3 lg:items-end">
                        <button
                          type="button"
                          onClick={() => {
                            if (!job?._id) {
                              toast.error(t('jobs.board.actions.openThisJob'));
                              return;
                            }
                            router.push(`/dashboard/jobs/${job._id}`);
                          }}
                          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
                        >
                          {isOnSite ? t('jobs.board.actions.applyOnSite') : 'View Job'} <ArrowRight size={14} />
                        </button>
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('jobs.board.badge')}</div>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
          {pagination.pages > 1 && (
            <div className="flex justify-center gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary text-sm py-1.5 px-4 disabled:opacity-40">{t('common.previous')}</button>
              <span className="text-slate-400 text-sm py-1.5 px-3">{page} / {pagination.pages}</span>
              <button disabled={page === pagination.pages} onClick={() => setPage((p) => p + 1)} className="btn-secondary text-sm py-1.5 px-4 disabled:opacity-40">{t('common.next')}</button>
            </div>
          )}
        </>      ) : tab === 'onsite' ? (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-emerald-500/10 dark:bg-slate-900/90">
            <h2 className="text-lg font-black text-slate-900 dark:text-white">On-site Jobs</h2>
            <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">Positions requiring in-office or on-location work</p>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array(6).fill(0).map((_, i) => (
                <div key={i} className="h-24 rounded-2xl bg-slate-800/50 animate-pulse" />
              ))}
            </div>
          ) : onsiteLoading ? (
            <div className="space-y-3">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="h-24 rounded-2xl bg-slate-800/50 animate-pulse" />
              ))}
            </div>
          ) : onsiteJobs.length === 0 ? (
            <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 py-16 text-center text-slate-400 text-sm">
              No on-site jobs found. Try browsing all jobs or check back soon.
            </div>
          ) : (
            <div className="grid gap-3"> 
              {onsiteJobs.map((job: any) => {
                const locationLabel = String(job.location || 'Remote');
                return (
                  <div
                    key={job._id}
                    className="rounded-[1.5rem] border border-slate-200 bg-white p-5 transition-all hover:-translate-y-1 hover:border-emerald-400/40 hover:shadow-xl hover:shadow-slate-200/60 dark:border-emerald-500/10 dark:bg-slate-900/90 dark:hover:border-emerald-400/30 dark:hover:shadow-emerald-950/15"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1 space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border px-3 py-1 text-xs font-semibold border-cyan-400/20 bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300">
                            {locationLabel}
                          </span>
                          <span className="badge-blue">{job.category === 'Other' && job.categoryOther ? `Other: ${job.categoryOther}` : job.category}</span>
                          {job.salary && <span className="badge" style={{ background: 'rgba(16,185,129,0.14)', color: '#6ee7b7' }}>{job.salary}</span>}
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-xl font-bold text-slate-900 dark:text-white">{job.title}</h3>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1"><Building2 size={12} />{job.company}</span>
                            <span className="flex items-center gap-1"><Clock size={12} />{new Date(job.publishedAt).toLocaleDateString()}</span>
                            <span className="capitalize">{job.jobType}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-start gap-3 lg:items-end">
                        <button
                          type="button"
                          onClick={() => {
                            if (!job?._id) {
                              toast.error('Unable to open this job');
                              return;
                            }
                            router.push(`/dashboard/jobs/${job._id}`);
                          }}
                          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
                        >
                          Apply on-site <ArrowRight size={14} />
                        </button>
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">On-site position</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>      ) : null}
    </div>
  );
}

