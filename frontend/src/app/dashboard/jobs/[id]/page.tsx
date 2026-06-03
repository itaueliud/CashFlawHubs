'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

type JobApplicationStatus = 'redirected' | 'applied' | 'interviewing' | 'offered' | 'rejected' | 'withdrawn';

type JobApplicationState = {
  _id?: string;
  status: JobApplicationStatus;
  appliedAt?: string;
  createdAt?: string;
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
  emailSent?: boolean;
  xpEarned?: number;
  xpPoints?: number | null;
  redirectUrl?: string | null;
  application?: {
    _id?: string;
    coverLetter?: string | null;
    cvOriginalName?: string | null;
    cvFileName?: string | null;
    cvUrl?: string | null;
    status?: JobApplicationStatus;
    appliedAt?: string;
  };
};

const STATUS_OPTIONS: JobApplicationStatus[] = ['applied', 'interviewing', 'offered', 'rejected', 'withdrawn'];

export default function JobDetailsPage() {
  const params = useParams<{ id?: string | string[]; slug?: string[] }>();
  const router = useRouter();
  const applicationWindowRef = useRef<Window | null>(null);
  const directId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const slugId = Array.isArray(params?.slug) && params.slug[0] === 'jobs' ? params.slug[1] : undefined;
  const jobId = directId || slugId;
  const [coverLetter, setCoverLetter] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [applicationFlow, setApplicationFlow] = useState<{
    phase: 'idle' | 'countdown' | 'waiting';
    countdown: number;
    applicationId?: string;
    redirectUrl?: string | null;
    status?: JobApplicationStatus;
  } | null>(null);
  const { user, setUser, refreshUser, hasHydrated } = useAuthStore();

  useEffect(() => {
    if (!hasHydrated || !user || user.email) return;
    refreshUser();
  }, [hasHydrated, refreshUser, user]);

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
  const isStaff = ['admin', 'superadmin', 'ledger'].includes(user?.role || '');

  useEffect(() => {
    if (userApplication?.status === 'redirected' && !applicationFlow) {
      setApplicationFlow({
        phase: 'waiting',
        countdown: 0,
        applicationId: userApplication._id,
        redirectUrl: job?.applicationUrl || null,
        status: 'redirected',
      });
    }
  }, [applicationFlow, job?.applicationUrl, userApplication?._id, userApplication?.status]);

  useEffect(() => {
    if (!applicationFlow || applicationFlow.phase !== 'countdown') return;
    if (applicationFlow.countdown <= 0) {
      const redirectUrl = applicationFlow.redirectUrl || job?.applicationUrl;
      if (redirectUrl) {
        if (applicationWindowRef.current && !applicationWindowRef.current.closed) {
          applicationWindowRef.current.location.href = redirectUrl;
          applicationWindowRef.current.focus();
        } else {
          window.open(redirectUrl, '_blank', 'noopener,noreferrer');
        }
      }
      setApplicationFlow((current) => current ? { ...current, phase: 'waiting', countdown: 0 } : current);
      return;
    }

    const timer = window.setTimeout(() => {
      setApplicationFlow((current) => {
        if (!current || current.phase !== 'countdown') return current;
        return { ...current, countdown: Math.max(current.countdown - 1, 0) };
      });
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [applicationFlow, job?.applicationUrl]);

  const applyMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append('coverLetter', coverLetter.trim());
      if (cvFile) formData.append('cv', cvFile);
      const response = await api.post(`/jobs/${jobId}/apply`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data as ApplyResponse;
    },
    onSuccess: async (response) => {
      toast.success(response.message || 'Application started');
      if (typeof response?.tokenBalance === 'number' && user) {
        setUser({ ...user, tokenBalance: response.tokenBalance });
      }
      if (typeof response?.xpPoints === 'number' && user) {
        setUser({ ...user, xpPoints: response.xpPoints });
      }
      await refreshUser();
      const applicationId = response.application?._id || userApplication?._id;
      setApplicationFlow({
        phase: 'countdown',
        countdown: 5,
        applicationId,
        redirectUrl: response.redirectUrl || job?.applicationUrl || null,
        status: response.application?.status || 'redirected',
      });
      setCoverLetter('');
      setCvFile(null);
      await refetch();
    },
    onError: (error: unknown) => {
      if (applicationWindowRef.current && !applicationWindowRef.current.closed) {
        applicationWindowRef.current.close();
      }
      applicationWindowRef.current = null;
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
      const response = await api.patch(`/jobs/applications/${applicationId}/status`, { status });
      return response.data as { message?: string; xpPoints?: number | null; xpEarned?: number; emailSent?: boolean };
    },
    onSuccess: async (response) => {
      toast.success(response.message || 'Application status updated');
      if (typeof response?.xpPoints === 'number' && user) {
        setUser({ ...user, xpPoints: response.xpPoints });
      } else if (typeof response?.xpEarned === 'number' && response.xpEarned > 0 && user) {
        setUser({ ...user, xpPoints: (user.xpPoints || 0) + response.xpEarned });
      }
      await refreshUser();
      if (updateStatusMutation.variables?.status === 'applied') {
        setApplicationFlow(null);
      }
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

  const handleApplyClick = () => {
    if (typeof window !== 'undefined') {
      applicationWindowRef.current = window.open('about:blank', '_blank') || null;
    }
    applyMutation.mutate();
  };

  const publishedLabel = useMemo(() => {
    if (!job?.publishedAt) return '';
    return new Date(job.publishedAt).toLocaleString();
  }, [job?.publishedAt]);

  const canSubmitApplication =
    coverLetter.trim().length > 0 &&
    !applyMutation.isPending &&
    !userApplication &&
    applicationFlow?.phase !== 'countdown' &&
    applicationFlow?.phase !== 'waiting';

  if ((applicationFlow || userApplication?.status === 'redirected') && job) {
    const waitingApplicationId = applicationFlow?.applicationId || userApplication?._id || '';
    const waitingStatus = applicationFlow?.status || userApplication?.status || 'redirected';
    return (
      <div className="space-y-5 animate-fade-in max-w-4xl mx-auto">
        <button onClick={() => router.back()} className="text-sm text-slate-400 hover:text-white flex items-center gap-2">
          <ArrowLeft size={16} /> Back to jobs
        </button>

        {applicationFlow?.phase === 'countdown' ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-4 backdrop-blur-xl">
            <div className="w-full max-w-xl rounded-[28px] border border-emerald-400/20 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/70 p-8 text-center shadow-2xl shadow-emerald-950/30">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/10 text-2xl font-black text-emerald-300">
                {applicationFlow.countdown}
              </div>
              <h2 className="text-3xl font-black text-white">Taking you to the employer site</h2>
              <p className="mt-3 text-sm text-slate-300">
                We created the application, awarded your XP, and will open the external page in a few seconds.
              </p>
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                Please keep this tab open. Your waiting screen will be ready when you return.
              </div>
            </div>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-[28px] border border-slate-700 bg-slate-950/80 shadow-2xl shadow-emerald-950/10">
          <div className="bg-gradient-to-br from-emerald-500/20 via-slate-950 to-slate-900 px-6 py-7 sm:px-8 sm:py-8 border-b border-slate-700/80">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-300 uppercase">
              CashFlawHubs
            </div>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-sm uppercase tracking-[0.18em] text-emerald-300/80">Application handoff</div>
                <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
                  {applicationFlow?.phase === 'countdown' ? 'Opening application site' : 'Waiting for you to return'}
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-300">
                  {applicationFlow?.phase === 'countdown'
                    ? 'We created the application record, awarded XP, and are taking you to the employer site in a moment.'
                  : 'The application is redirected. Come back here when you finish, then confirm the result or update the status.'}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-right">
                <div className="text-[11px] uppercase tracking-wide text-emerald-300/80">Status</div>
                <div className="text-lg font-bold text-emerald-300 capitalize">{waitingStatus}</div>
                <div className="text-xs text-slate-300">Application saved in your dashboard</div>
                <div className="mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide bg-slate-100/10 text-slate-200 border border-white/10">
                  Reminder set
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6 px-6 py-6 sm:px-8 sm:py-8">
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Job</div>
                <div className="font-semibold text-white">{job.title}</div>
                <div className="text-slate-400">{job.company}</div>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">What happens next</div>
                <p className="text-sm text-slate-300">
                  The application page is open externally. When you're done, come back and confirm the result here.
                </p>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5 space-y-3">
                <div className="text-sm font-semibold text-white">Application status</div>
                <div className="grid grid-cols-1 gap-2 text-sm text-slate-300">
                  <div>Status: <span className="text-white capitalize">{waitingStatus}</span></div>
                  <div>Application ID: <span className="text-white">{waitingApplicationId || 'N/A'}</span></div>
                  <div>Reminder 24h: <span className="text-white">{userApplication?.status === 'redirected' ? 'Scheduled' : 'Tracking active'}</span></div>
                  <div>Reminder 7d: <span className="text-white">{userApplication?.status === 'redirected' ? 'Scheduled' : 'Tracking active'}</span></div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5 space-y-3">
                <div className="text-sm font-semibold text-white">Next steps</div>
                <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-4 space-y-3">
                  <p className="text-sm text-slate-300">
                    You can confirm the application immediately after you submit it on the employer site.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="badge-blue">24h reminder</span>
                    <span className="badge-blue">7-day nudge</span>
                    <span className="badge-green">Source of truth saved</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  const applicationId = waitingApplicationId;
                  if (!applicationId) return;
                  updateStatusMutation.mutate({ applicationId, status: 'applied' });
                }}
                className="btn-primary inline-flex items-center gap-2"
                disabled={updateStatusMutation.isPending}
              >
                <Send size={16} /> I completed the application
              </button>
              <button
                type="button"
                onClick={() => {
                  toast.success('Reminder saved. We will nudge you again in 24 hours.');
                  setApplicationFlow((current) => current ? { ...current, phase: 'waiting', countdown: 0 } : current);
                }}
                className="btn-secondary inline-flex items-center gap-2"
              >
                <ArrowLeft size={16} /> I will do it later
              </button>
              <Link href="/dashboard/jobs/applications" className="btn-secondary inline-flex items-center gap-2">
                <ExternalLink size={16} /> View my applications
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
                  {isStaff && <span className="badge-green capitalize">{job.source}</span>}
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
                  {(job.tags || []).map((tag: string) => (
                    <span key={tag} className="badge-blue flex items-center gap-1"><Tag size={12} /> {tag}</span>
                  ))}
                </div>
              </div>
            )}

            {isStaff && job.applicationUrl && (
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
              <label className="text-sm text-slate-300 mb-1 block">Cover Letter <span className="text-rose-400">*</span></label>
              <textarea
                className="input min-h-40"
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                placeholder="Tell the employer why you are a fit for this role..."
                required
              />
              <p className="mt-2 text-xs text-slate-500">Required. Please enter a cover letter before applying.</p>
            </div>

            <div>
              <label className="text-sm text-slate-300 mb-1 block">Upload CV / Resume</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="input file:mr-4 file:rounded-lg file:border-0 file:bg-slate-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-600"
                onChange={(e) => setCvFile(e.target.files?.[0] || null)}
              />
              <p className="mt-2 text-xs text-slate-500">PDF, DOC, or DOCX. Optional, but recommended.</p>
              {cvFile ? <p className="mt-2 text-xs text-emerald-300">Selected: {cvFile.name}</p> : null}
            </div>

            <button
              onClick={handleApplyClick}
              disabled={!canSubmitApplication}
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
