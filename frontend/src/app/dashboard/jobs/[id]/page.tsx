'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Building2, CalendarDays, ExternalLink, Globe2, Loader2, Send, Tag } from 'lucide-react';
import { MessageSquare } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

type JobDetails = {
  _id: string;
  title: string;
  company: string;
  category: string;
  categoryOther?: string | null;
  source: string;
  jobType?: string;
  location?: string;
  salary?: string;
  description: string;
  tags?: string[];
  applicationUrl?: string;
  applicationTokenCost?: number;
  publishedAt?: string;
};

type JobApplicationStatus = 'submitted' | 'reviewed' | 'shortlisted' | 'rejected';

type JobApplicationState = {
  status: JobApplicationStatus;
};

type ManagedJobApplication = {
  _id: string;
  status: JobApplicationStatus;
  coverLetter?: string;
  tokenCost?: number;
  appliedAt?: string;
  applicant?: {
    id?: string;
    userId?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
};

type JobDetailsResponse = {
  job: JobDetails;
  userApplication?: JobApplicationState | null;
  canManageApplications?: boolean;
  applications?: ManagedJobApplication[];
};

type ApplyResponse = {
  message?: string;
  tokenBalance?: number;
};

const STATUS_OPTIONS: JobApplicationStatus[] = ['submitted', 'reviewed', 'shortlisted', 'rejected'];

export default function JobDetailsPage() {
  const params = useParams<{ id?: string | string[]; slug?: string[] }>();
  const router = useRouter();
  const directId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const slugId = Array.isArray(params?.slug) && params.slug[0] === 'jobs' ? params.slug[1] : undefined;
  const jobId = directId || slugId;
  const [coverLetter, setCoverLetter] = useState('');
  const { user, setUser } = useAuthStore();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['job', jobId],
    enabled: Boolean(jobId),
    queryFn: async () => {
      const response = await api.get(`/jobs/${jobId}`);
      return response.data as JobDetailsResponse;
    },
  });

  const job = data?.job;
  const userApplication = data?.userApplication;
  const canManageApplications = Boolean(data?.canManageApplications);
  const managedApplications = data?.applications || [];

  const applyMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/jobs/${jobId}/apply`, { coverLetter });
      return response.data as ApplyResponse;
    },
    onSuccess: async (response) => {
      toast.success(response.message || 'Application submitted');
      if (typeof response?.tokenBalance === 'number' && user) {
        setUser({ ...user, tokenBalance: response.tokenBalance });
      }
      setCoverLetter('');
      await refetch();
    },
    onError: (error: unknown) => {
      const message =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      toast.error(message || 'Failed to submit application');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ applicationId, status }: { applicationId: string; status: JobApplicationStatus }) => {
      const response = await api.patch(`/jobs/${jobId}/applications/${applicationId}/status`, { status });
      return response.data as { message?: string };
    },
    onSuccess: async (response) => {
      toast.success(response.message || 'Application status updated');
      await refetch();
    },
    onError: (error: unknown) => {
      const message =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      toast.error(message || 'Failed to update status');
    },
  });

  const publishedLabel = useMemo(() => {
    if (!job?.publishedAt) return '';
    return new Date(job.publishedAt).toLocaleString();
  }, [job?.publishedAt]);

  if (!jobId) {
    return <div className="card text-slate-400">Missing job id.</div>;
  }

  return (
    <div className="space-y-5 animate-fade-in max-w-5xl mx-auto">
      <button onClick={() => router.back()} className="text-sm text-slate-400 hover:text-white flex items-center gap-2">
        <ArrowLeft size={16} /> Back to jobs
      </button>

      {isLoading ? (
        <div className="card h-80 animate-pulse" />
      ) : !job ? (
        <div className="card text-center py-16 text-slate-400">Job not found.</div>
      ) : (
        <div className="grid lg:grid-cols-[1.6fr_1fr] gap-5">
          <div className="card space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="badge-blue">{job.category === 'Other' && job.categoryOther ? `Other (${job.categoryOther})` : job.category}</span>
                  <span className="badge-green capitalize">{job.source}</span>
                  {job.jobType && <span className="badge-yellow capitalize">{job.jobType}</span>}
                </div>
                <h1 className="text-3xl font-black leading-tight">{job.title}</h1>
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-400">
                  <span className="flex items-center gap-2"><Building2 size={15} /> {job.company}</span>
                  <span className="flex items-center gap-2"><CalendarDays size={15} /> {publishedLabel}</span>
                  <span className="flex items-center gap-2"><Globe2 size={15} /> {job.location || 'Remote'}</span>
                </div>
              </div>
              {job.salary && <div className="badge-green text-sm">{job.salary}</div>}
            </div>

            <div className="space-y-3">
              <h2 className="font-bold text-lg">Job Description</h2>
              <p className="text-sm leading-7 text-slate-300 whitespace-pre-line">{job.description}</p>
            </div>

            {(job.tags?.length ?? 0) > 0 && (
              <div className="space-y-3">
                <h2 className="font-bold text-lg">Skills</h2>
                <div className="flex flex-wrap gap-2">
                  {job.tags.map((tag: string) => (
                    <span key={tag} className="badge-blue flex items-center gap-1"><Tag size={12} /> {tag}</span>
                  ))}
                </div>
              </div>
            )}

            {job.applicationUrl && (
              <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-300">
                The original posting source is still available, but applying happens here in CashFlowConnect.
                <a href={job.applicationUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-green-400 hover:text-green-300">
                  View original source <ExternalLink size={14} />
                </a>
              </div>
            )}
          </div>

          <div className="card space-y-4 h-fit sticky top-24">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Apply in site</div>
              <h2 className="text-xl font-bold">Submit your application</h2>
              <p className="text-sm text-slate-400 mt-2">Your application is recorded inside the platform, so you stay here while applying.</p>
            </div>

            <div className="space-y-2 text-sm text-slate-300">
              <div className="rounded-xl bg-slate-900 px-4 py-3">
                <div className="text-slate-500 text-xs mb-1">Company</div>
                <div>{job.company}</div>
              </div>
              <div className="rounded-xl bg-slate-900 px-4 py-3">
                <div className="text-slate-500 text-xs mb-1">Location</div>
                <div>{job.location || 'Remote'}</div>
              </div>
              <div className="rounded-xl bg-slate-900 px-4 py-3">
                <div className="text-slate-500 text-xs mb-1">Apply method</div>
                <div>On-site application</div>
              </div>
              {typeof job.applicationTokenCost === 'number' && job.applicationTokenCost > 0 ? (
                <div className="rounded-xl bg-slate-900 px-4 py-3">
                  <div className="text-slate-500 text-xs mb-1">Application token cost</div>
                  <div>{job.applicationTokenCost} tokens</div>
                </div>
              ) : null}
            </div>

            <div>
              <label className="text-sm text-slate-300 mb-1 block">Cover Letter</label>
              <textarea
                className="input min-h-40"
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                placeholder="Tell the employer why you are a fit for this role..."
              />
            </div>

            <button
              onClick={() => applyMutation.mutate()}
              disabled={applyMutation.isPending || Boolean(userApplication)}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {applyMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {userApplication ? 'Applied' : 'Apply on site'}
            </button>
            {userApplication ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                Application status: <span className="font-semibold capitalize">{userApplication.status}</span>
              </div>
            ) : null}
            {canManageApplications ? (
              <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-white">Manage applications</div>
                  <span className="text-xs text-slate-400">{managedApplications.length} total</span>
                </div>
                <Link
                  href={`/dashboard/jobs/${jobId}/applicants`}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 hover:border-emerald-300/50 hover:bg-emerald-500/15"
                >
                  Open applicants table <ExternalLink size={14} />
                </Link>
                {managedApplications.length === 0 ? (
                  <div className="text-sm text-slate-400">No applications yet.</div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {managedApplications.map((application) => {
                      const fullName = [application.applicant?.firstName, application.applicant?.lastName].filter(Boolean).join(' ').trim();
                      const applicantName = application.applicant?.name || fullName || application.applicant?.email || 'Applicant';
                      return (
                        <div key={application._id} className="rounded-xl border border-slate-700 bg-slate-950/80 p-3 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-sm font-medium text-white">{applicantName}</div>
                              {application.applicant?.email ? <div className="text-xs text-slate-400">{application.applicant.email}</div> : null}
                              {application.appliedAt ? (
                                <div className="text-xs text-slate-500 mt-1">Applied {new Date(application.appliedAt).toLocaleString()}</div>
                              ) : null}
                            </div>
                            <span className="badge-blue capitalize">{application.status}</span>
                          </div>
                          {application.coverLetter ? (
                            <p className="text-xs text-slate-300 whitespace-pre-line line-clamp-4">{application.coverLetter}</p>
                          ) : (
                            <p className="text-xs text-slate-500">No cover letter provided.</p>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            {STATUS_OPTIONS.map((statusValue) => {
                              const isCurrent = application.status === statusValue;
                              const isUpdatingThis =
                                updateStatusMutation.isPending &&
                                updateStatusMutation.variables?.applicationId === application._id &&
                                updateStatusMutation.variables?.status === statusValue;
                              return (
                                <button
                                  key={statusValue}
                                  type="button"
                                  disabled={isCurrent || updateStatusMutation.isPending}
                                  onClick={() => {
                                    const confirmed = window.confirm(`Set this application to ${statusValue}?`);
                                    if (!confirmed) return;
                                    updateStatusMutation.mutate({ applicationId: application._id, status: statusValue });
                                  }}
                                  className={`rounded-lg px-2 py-1.5 text-xs font-medium capitalize transition ${isCurrent ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 disabled:opacity-50'}`}
                                >
                                  {isUpdatingThis ? 'Updating...' : statusValue}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
            <Link href="/dashboard/jobs/applications" className="btn-secondary w-full flex items-center justify-center gap-2">
              <ExternalLink size={16} /> My Applications
            </Link>
            <Link href={`/dashboard/chat?jobId=${jobId}`} className="btn-secondary w-full flex items-center justify-center gap-2">
              <MessageSquare size={16} /> Open job chat
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
