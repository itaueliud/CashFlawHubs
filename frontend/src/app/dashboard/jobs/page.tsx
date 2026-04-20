'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { ExternalLink, Search, Building2, Clock, Plus, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

const EMPTY_FORM = {
  title: '',
  company: '',
  category: 'Other',
  jobType: 'contract',
  location: 'Remote',
  salary: '',
  description: '',
  applicationUrl: '',
  budgetAmount: '',
  budgetCurrency: 'KES',
};

export default function JobsPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<'browse' | 'post'>('browse');
  const [posting, setPosting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', search, category, page],
    queryFn: () => api.get(`/jobs?search=${search}&category=${category}&page=${page}&limit=20`).then((r) => r.data),
  });
  const { data: catData } = useQuery({
    queryKey: ['job-cats'],
    queryFn: () => api.get('/jobs/categories').then((r) => r.data.categories),
  });

  const jobs = data?.jobs || [];
  const pagination = data?.pagination || {};
  const tokenPolicy = data?.tokenPolicy;

  const updateField = (key: string, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const onPostJob = async () => {
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
      setTab('browse');
      toast.success(`Job posted. ${response.data.tokensSpent} tokens were used.`);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to post job');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Remote Jobs</h1>
          <p className="text-slate-400 text-sm mt-1">Browse external jobs or post your own internal listings</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="card px-4 py-3">
            <div className="text-xs text-slate-400">Available Tokens</div>
            <div className="text-2xl font-black text-green-400">{user?.tokenBalance || 0}T</div>
          </div>
          <button onClick={() => setTab('post')} className="btn-primary text-sm flex items-center gap-2">
            <Plus size={16} /> Post Job
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-700 pb-2">
        {(['browse', 'post'] as const).map((tabName) => (
          <button
            key={tabName}
            onClick={() => setTab(tabName)}
            className={`px-4 py-2 rounded-t-xl text-sm font-medium transition-all capitalize ${tab === tabName ? 'text-green-400 border-b-2 border-green-400' : 'text-slate-400 hover:text-white'}`}
          >
            {tabName}
          </button>
        ))}
      </div>

      {tab === 'post' ? (
        <div className="card max-w-3xl space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-300 mb-1 block">Job Title</label>
              <input className="input" value={form.title} onChange={(e) => updateField('title', e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-300 mb-1 block">Company</label>
              <input className="input" value={form.company} onChange={(e) => updateField('company', e.target.value)} />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-slate-300 mb-1 block">Category</label>
              <input className="input" value={form.category} onChange={(e) => updateField('category', e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-300 mb-1 block">Job Type</label>
              <input className="input" value={form.jobType} onChange={(e) => updateField('jobType', e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-300 mb-1 block">Location</label>
              <input className="input" value={form.location} onChange={(e) => updateField('location', e.target.value)} />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-slate-300 mb-1 block">Salary</label>
              <input className="input" value={form.salary} onChange={(e) => updateField('salary', e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-300 mb-1 block">Budget Amount</label>
              <input className="input" type="number" value={form.budgetAmount} onChange={(e) => updateField('budgetAmount', e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-300 mb-1 block">Budget Currency</label>
              <input className="input" value={form.budgetCurrency} onChange={(e) => updateField('budgetCurrency', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-300 mb-1 block">Application URL</label>
            <input className="input" value={form.applicationUrl} onChange={(e) => updateField('applicationUrl', e.target.value)} />
          </div>

          <div>
            <label className="text-sm text-slate-300 mb-1 block">Description</label>
            <textarea className="input min-h-32" value={form.description} onChange={(e) => updateField('description', e.target.value)} />
          </div>

          <button onClick={onPostJob} disabled={posting} className="btn-primary flex items-center gap-2">
            {posting && <Loader2 size={16} className="animate-spin" />}
            Post Job for {tokenPolicy?.postingCost || 50} Tokens
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search jobs..." className="input pl-9" />
            </div>
            <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="input sm:w-48">
              <option value="">All Categories</option>
              {(catData || []).map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {isLoading ? (
            <div className="space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="card h-20 animate-pulse" />)}</div>
          ) : jobs.length === 0 ? (
            <div className="card text-center py-12 text-slate-400">No jobs found. Try a different search.</div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job: any) => (
                <div key={job._id} className="card hover:border-slate-600 transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm">{job.title}</h3>
                        <span className="badge-blue">{job.category}</span>
                        {job.salary && <span className="badge-green">{job.salary}</span>}
                        {job.source === 'internal' && <span className="badge-green">{job.applicationTokenCost}T apply</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><Building2 size={11} />{job.company}</span>
                        <span className="flex items-center gap-1"><Clock size={11} />{new Date(job.publishedAt).toLocaleDateString()}</span>
                        <span className="capitalize">{job.jobType}</span>
                        <span className="capitalize text-slate-500">{job.source}</span>
                      </div>
                    </div>
                    <a href={job.applicationUrl} target="_blank" rel="noopener noreferrer" className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1 flex-shrink-0">
                      Apply <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
          {pagination.pages > 1 && (
            <div className="flex justify-center gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary text-sm py-1.5 px-4 disabled:opacity-40">Prev</button>
              <span className="text-slate-400 text-sm py-1.5 px-3">{page} / {pagination.pages}</span>
              <button disabled={page === pagination.pages} onClick={() => setPage((p) => p + 1)} className="btn-secondary text-sm py-1.5 px-4 disabled:opacity-40">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
