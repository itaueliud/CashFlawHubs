'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Building2, Clock, ExternalLink, Loader2, Plus, Users } from 'lucide-react';
import api from '@/lib/api';

type MyPostedJob = {
  _id: string;
  title: string;
  company: string;
  category?: string;
  categoryOther?: string | null;
  location?: string;
  jobType?: string;
  salary?: string | null;
  publishedAt?: string;
  applicantCount?: number;
};

type MyPostsResponse = {
  success: boolean;
  jobs: MyPostedJob[];
  pagination: {
    total: number;
    page: number;
    pages: number;
  };
};

export default function MyPostedJobsPage() {
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ['my-posted-jobs'],
    queryFn: async () => (await api.get('/jobs/my-posts?limit=50')).data as MyPostsResponse,
  });

  const jobs = data?.jobs || [];
  const pagination = data?.pagination || { total: 0, page: 1, pages: 1 };

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
      <div className="rounded-[1.75rem] border border-emerald-500/15 bg-gradient-to-br from-emerald-950/70 via-slate-950 to-slate-900 p-6 shadow-xl shadow-emerald-950/20">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
              <Plus size={12} /> {t('jobs.myPosts.title')}
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white">{t('jobs.myPosts.title')}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">{t('jobs.myPosts.subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
              <div className="text-xs text-slate-400">{t('jobs.myPosts.applicants')}</div>
              <div className="text-2xl font-black text-emerald-300">{pagination.total}</div>
            </div>
            <Link
              href="/dashboard/jobs?tab=post"
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              <Plus size={15} /> {t('jobs.myPosts.postAnother')}
            </Link>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-[1.5rem] bg-slate-800/50" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-slate-700 bg-slate-900/50 py-16 text-center text-slate-400 text-sm">
          {t('jobs.myPosts.none')}
        </div>
      ) : (
        <div className="grid gap-3">
          {jobs.map((job) => {
            const locationLabel = String(job.location || 'Remote');
            const isOnSite = locationLabel.toLowerCase().includes('on-site') || locationLabel.toLowerCase().includes('onsite');
            const applicantsHref = `/dashboard/jobs/${job._id}/applicants`;
            const listingHref = `/dashboard/jobs/${job._id}`;

            return (
              <article key={job._id} className="rounded-[1.5rem] border border-emerald-500/10 bg-slate-900/90 p-5 shadow-lg shadow-emerald-950/10 transition hover:-translate-y-0.5 hover:border-emerald-400/30">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${isOnSite ? 'border-cyan-400/20 bg-cyan-500/10 text-cyan-300' : 'border-slate-700 bg-slate-800 text-slate-300'}`}>
                        {locationLabel}
                      </span>
                      <span className="badge-blue capitalize">{job.jobType || t('jobs.board.labels.jobType')}</span>
                      <span className="badge-green">{job.applicantCount || 0} {t('jobs.myPosts.applicants')}</span>
                      {job.salary ? <span className="badge-yellow">{job.salary}</span> : null}
                    </div>
                    <h2 className="truncate text-xl font-bold text-white">{job.title}</h2>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
                      <span className="inline-flex items-center gap-1"><Building2 size={12} /> {job.company}</span>
                      {job.publishedAt ? <span className="inline-flex items-center gap-1"><Clock size={12} /> {new Date(job.publishedAt).toLocaleDateString()}</span> : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Link href={applicantsHref} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400">
                      <Users size={14} /> {t('jobs.myPosts.viewApplicants')}
                    </Link>
                    <Link href={listingHref} className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white">
                      {t('jobs.myPosts.viewListing')} <ExternalLink size={14} />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}