'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { ExternalLink, Search, Building2, Clock } from 'lucide-react';

export default function JobsPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', search, category, page],
    queryFn: () => api.get(`/jobs?search=${search}&category=${category}&page=${page}&limit=20`).then(r => r.data),
  });
  const { data: catData } = useQuery({ queryKey: ['job-cats'], queryFn: () => api.get('/jobs/categories').then(r => r.data.categories) });

  const jobs = data?.jobs || [];
  const pagination = data?.pagination || {};

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black">Remote Jobs</h1>
        <p className="text-slate-400 text-sm mt-1">Synced every 6 hours from Remotive & Jobicy</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search jobs..." className="input pl-9" />
        </div>
        <select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }} className="input sm:w-48">
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
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><Building2 size={11} />{job.company}</span>
                    <span className="flex items-center gap-1"><Clock size={11} />{new Date(job.publishedAt).toLocaleDateString()}</span>
                    <span className="capitalize">{job.jobType}</span>
                    <span className="capitalize text-slate-500">{job.source}</span>
                  </div>
                </div>
                <a href={job.applicationUrl} target="_blank" rel="noopener noreferrer"
                  className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1 flex-shrink-0">
                  Apply <ExternalLink size={12} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-sm py-1.5 px-4 disabled:opacity-40">Prev</button>
          <span className="text-slate-400 text-sm py-1.5 px-3">{page} / {pagination.pages}</span>
          <button disabled={page === pagination.pages} onClick={() => setPage(p => p + 1)} className="btn-secondary text-sm py-1.5 px-4 disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}
