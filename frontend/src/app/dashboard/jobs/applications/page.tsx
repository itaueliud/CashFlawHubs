'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Briefcase, CalendarDays, ExternalLink, Loader2 } from 'lucide-react';
import api from '@/lib/api';

type AppliedJob = {
  _id: string;
  title: string;
  company: string;
  location?: string;
  applicationUrl?: string;
};

type JobApplicationItem = {
  _id: string;
  status: 'submitted' | 'reviewed' | 'shortlisted' | 'rejected';
  tokenCost: number;
  jobAvailable: boolean;
  coverLetter?: string | null;
  appliedAt?: string;
  createdAt: string;
  job: AppliedJob | null;
};

type JobApplicationsResponse = {
  applications: JobApplicationItem[];
  pagination: {
    total: number;
    page: number;
    pages: number;
  };
};

export default function JobApplicationsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['my-job-applications', page],
    queryFn: () => api.get(`/jobs/applications/me?page=${page}&limit=12`).then((r) => r.data as JobApplicationsResponse),
  });

  const applications = data?.applications || [];
  const pagination = data?.pagination || { page: 1, pages: 1 };

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <Link href="/dashboard/jobs" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft size={16} /> Back to jobs
        </Link>
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">My job applications</div>
      </div>

      <div className="rounded-[1.75rem] border border-emerald-500/15 bg-gradient-to-br from-emerald-950/70 via-slate-950 to-slate-900 p-6 shadow-xl shadow-emerald-950/20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">Application Tracker</h1>
            <p className="mt-2 text-sm text-slate-300">
              Track every on-site job application and jump back into active roles.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
            <div className="text-xs text-slate-400">Total applications</div>
            <div className="text-2xl font-black text-emerald-300">{data?.pagination?.total || 0}</div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="card flex h-56 items-center justify-center text-slate-400">
          <Loader2 size={18} className="mr-2 animate-spin" /> Loading applications...
        </div>
      ) : applications.length === 0 ? (
        <div className="card py-16 text-center text-slate-400">
          No applications submitted yet.
        </div>
      ) : (
        <div className="grid gap-3">
          {applications.map((application: JobApplicationItem) => {
            const job = application.job;
            return (
              <div key={application._id} className="rounded-2xl border border-emerald-500/10 bg-slate-900/90 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <span className="badge-blue capitalize">{application.status}</span>
                      {application.tokenCost > 0 ? <span className="badge-yellow">{application.tokenCost}T spent</span> : null}
                      <span className="badge-green">{application.jobAvailable ? 'Open' : 'Closed'}</span>
                    </div>
                    <h2 className="truncate text-lg font-bold text-white">{job?.title || 'Job unavailable'}</h2>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
                      <span className="inline-flex items-center gap-1"><Briefcase size={12} /> {job?.company || 'Unknown company'}</span>
                      <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {new Date(application.appliedAt || application.createdAt).toLocaleString()}</span>
                      <span>{job?.location || 'Remote'}</span>
                    </div>
                    {application.coverLetter ? (
                      <p className="line-clamp-2 text-sm text-slate-300">{application.coverLetter}</p>
                    ) : (
                      <p className="text-sm text-slate-500">No cover letter submitted.</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {job?._id && application.jobAvailable ? (
                      <Link href={`/dashboard/jobs/${job._id}`} className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 hover:border-emerald-300/50 hover:bg-emerald-500/15">
                        Open job <ExternalLink size={14} />
                      </Link>
                    ) : null}
                    {job?.applicationUrl ? (
                      <a href={job.applicationUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white">
                        Source link <ExternalLink size={14} />
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pagination.pages > 1 ? (
        <div className="flex justify-center gap-2">
          <button
            type="button"
            disabled={pagination.page === 1}
            onClick={() => setPage((current) => current - 1)}
            className="btn-secondary px-4 py-2 text-sm disabled:opacity-50"
          >
            Prev
          </button>
          <span className="px-3 py-2 text-sm text-slate-400">{pagination.page} / {pagination.pages}</span>
          <button
            type="button"
            disabled={pagination.page >= pagination.pages}
            onClick={() => setPage((current) => current + 1)}
            className="btn-secondary px-4 py-2 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}