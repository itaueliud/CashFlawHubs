'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
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
  postedBy?: string;
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
  trackingEmail?: string | null;
  statusDescription?: string;
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
    trackingEmail?: string | null;
    status?: JobApplicationStatus;
    appliedAt?: string;
  };
};

const STATUS_OPTIONS: JobApplicationStatus[] = ['applied', 'interviewing', 'offered', 'rejected', 'withdrawn'];

type ApplicationFlowState = {
  phase: 'idle' | 'countdown' | 'waiting';
  countdown: number;
  applicationId?: string;
  redirectUrl?: string | null;
  status?: JobApplicationStatus;
  jobTitle?: string;
  company?: string;
  source?: string;
};

export default function JobDetailsPage() {
  const { t } = useTranslation();
  const params = useParams<{ id?: string | string[]; slug?: string[] }>();
  const router = useRouter();
  const applicationWindowRef = useRef<Window | null>(null);
  const directId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const slugId = Array.isArray(params?.slug) && params.slug[0] === 'jobs' ? params.slug[1] : undefined;
  const jobId = directId || slugId;
  const [coverLetter, setCoverLetter] = useState('');
  const [trackingEmail, setTrackingEmail] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [applicationFlow, setApplicationFlow] = useState<ApplicationFlowState | null>(null);
  const [handoffDismissed, setHandoffDismissed] = useState(false);
  const { user, setUser, refreshUser, hasHydrated } = useAuthStore();
  const flowStorageKey = jobId ? `cfh-job-application-flow:${jobId}` : '';
  const dismissedFlowKey = jobId ? `cfh-job-handoff-dismissed:${jobId}` : '';

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
  const isExternalJob = Boolean(job?.source && job.source !== 'internal');
  const canOpenJobChat =
    Boolean(job && job.source === 'internal' && user && job.postedBy && String(job.postedBy) === String(user.id || user.userId || ''));
  const shouldShowRedirectFlow = Boolean(isExternalJob && !handoffDismissed && (applicationFlow || userApplication?.status === 'redirected'));
  const isValidEmail = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim().toLowerCase());

  const closeExternalWindow = () => {
    try {
      if (applicationWindowRef.current && !applicationWindowRef.current.closed) {
        applicationWindowRef.current.close();
      }
    } catch {
      // Ignore popup window cleanup failures.
    }
    applicationWindowRef.current = null;
  };

  const clearRedirectHandoff = (options?: { keepOnPage?: boolean }) => {
    closeExternalWindow();
    if (typeof window !== 'undefined') {
      if (flowStorageKey) window.sessionStorage.removeItem(flowStorageKey);
      if (dismissedFlowKey) window.sessionStorage.setItem(dismissedFlowKey, '1');
    }
    setHandoffDismissed(true);
    setApplicationFlow(null);
    if (!options?.keepOnPage) {
      router.push('/dashboard/jobs/applications');
    }
  };

  const openApplicationDestination = (destination?: string | null) => {
    if (!destination || typeof window === 'undefined') return false;

    try {
      if (applicationWindowRef.current && !applicationWindowRef.current.closed) {
        applicationWindowRef.current.location.href = destination;
        applicationWindowRef.current.focus();
        return true;
      }
    } catch {
      // If the pre-opened window became inaccessible, fall back below.
    }

    const openedWindow = window.open(destination, '_blank', 'noopener,noreferrer');
    applicationWindowRef.current = openedWindow;
    return Boolean(openedWindow);
  };

  useEffect(() => {
    if (isExternalJob && userApplication?.status === 'redirected' && !applicationFlow) {
      if (typeof window !== 'undefined' && dismissedFlowKey) {
        const dismissed = window.sessionStorage.getItem(dismissedFlowKey) === '1';
        if (dismissed) {
          setHandoffDismissed(true);
          return;
        }
      }

      const restoredFlow = {
        phase: 'waiting',
        countdown: 0,
        applicationId: userApplication._id,
        redirectUrl: job?.applicationUrl || null,
        status: 'redirected',
        jobTitle: job?.title,
        company: job?.company,
        source: job?.source,
      } as const;
      setApplicationFlow(restoredFlow);
    }
  }, [applicationFlow, dismissedFlowKey, isExternalJob, job?.applicationUrl, userApplication?._id, userApplication?.status]);

  useEffect(() => {
    if (typeof window === 'undefined' || !flowStorageKey) return;

    if (applicationFlow) {
      window.sessionStorage.setItem(flowStorageKey, JSON.stringify(applicationFlow));
    } else {
      window.sessionStorage.removeItem(flowStorageKey);
    }
  }, [applicationFlow, flowStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !flowStorageKey || applicationFlow || !job) return;

    try {
      const savedFlow = window.sessionStorage.getItem(flowStorageKey);
      if (!savedFlow) return;
      const parsed = JSON.parse(savedFlow) as Partial<ApplicationFlowState> | null;
      if (!parsed || typeof parsed !== 'object') return;
      if (parsed.phase !== 'countdown' && parsed.phase !== 'waiting') return;
      const savedPhase = parsed.phase as 'countdown' | 'waiting';
      if (parsed.applicationId) {
        setApplicationFlow({
          phase: savedPhase,
          countdown: savedPhase === 'countdown' ? Math.max(Number(parsed.countdown) || 0, 0) : 0,
          applicationId: parsed.applicationId,
          redirectUrl: parsed.redirectUrl || job.applicationUrl || null,
          status: parsed.status || 'redirected',
          jobTitle: parsed.jobTitle || job.title,
          company: parsed.company || job.company,
          source: parsed.source || job.source,
        });
      }
    } catch {
      window.sessionStorage.removeItem(flowStorageKey);
    }
  }, [applicationFlow, flowStorageKey, job]);

  useEffect(() => {
    if (typeof window === 'undefined' || !dismissedFlowKey) return;
    const dismissed = window.sessionStorage.getItem(dismissedFlowKey) === '1';
    setHandoffDismissed(dismissed);
  }, [dismissedFlowKey]);

  useEffect(() => {
    if (!shouldShowRedirectFlow || !applicationFlow || applicationFlow.phase !== 'countdown') return;
    if (applicationFlow.countdown <= 0) {
      const redirectUrl = applicationFlow.redirectUrl || job?.applicationUrl;
      if (redirectUrl) openApplicationDestination(redirectUrl);
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
  }, [applicationFlow, job?.applicationUrl, shouldShowRedirectFlow]);

  const applyMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append('coverLetter', coverLetter.trim());
      if (isExternalJob) {
        formData.append('trackingEmail', trackingEmail.trim());
      }
      if (cvFile) formData.append('cv', cvFile);
      const response = await api.post(`/jobs/${jobId}/apply`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data as ApplyResponse;
    },
    onSuccess: async (response) => {
      toast.success(response.message || t('jobs.detail.flow.tracked'));
      if (typeof response?.tokenBalance === 'number' && user) {
        setUser({ ...user, tokenBalance: response.tokenBalance });
      }
      if (typeof response?.xpPoints === 'number' && user) {
        setUser({ ...user, xpPoints: response.xpPoints });
      }
      await refreshUser();
      const redirectUrl = response.redirectUrl || job?.applicationUrl || null;
      const applicationId = response.application?._id || userApplication?._id;
      if (isExternalJob && redirectUrl) {
        openApplicationDestination(redirectUrl);
        setApplicationFlow({
          phase: 'countdown',
          countdown: 4,
          applicationId,
          redirectUrl,
          status: response.application?.status || 'redirected',
          jobTitle: job?.title,
          company: job?.company,
          source: job?.source,
        });
      } else {
        setApplicationFlow(null);
      }
      setCoverLetter('');
      setTrackingEmail('');
      setCvFile(null);
      await refetch();
    },
    onError: (error: unknown) => {
      if (isExternalJob && applicationWindowRef.current && !applicationWindowRef.current.closed) {
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
      toast.error(message || t('jobs.detail.apply'));
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ applicationId, status }: { applicationId: string; status: JobApplicationStatus }) => {
      const response = await api.patch(`/jobs/applications/${applicationId}/status`, { status });
      return response.data as { message?: string; xpPoints?: number | null; xpEarned?: number; emailSent?: boolean };
    },
    onSuccess: async (response) => {
      toast.success(response.message || t('jobs.applications.statusUpdated'));
      if (typeof response?.xpPoints === 'number' && user) {
        setUser({ ...user, xpPoints: response.xpPoints });
      } else if (typeof response?.xpEarned === 'number' && response.xpEarned > 0 && user) {
        setUser({ ...user, xpPoints: (user.xpPoints || 0) + response.xpEarned });
      }
      await refreshUser();
      if (updateStatusMutation.variables?.status === 'applied') {
        clearRedirectHandoff({ keepOnPage: true });
      }
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
      toast.error(message || t('jobs.applications.statusUpdateFailed'));
    },
  });

  const handleApplyClick = () => {
    if (isExternalJob && typeof window !== 'undefined') {
      applicationWindowRef.current = window.open('about:blank', '_blank') || null;
    }
    applyMutation.mutate();
  };

  const publishedLabel = useMemo(() => {
    if (!job?.publishedAt) return '';
    return new Date(job.publishedAt).toLocaleString();
  }, [job?.publishedAt]);

  const canSubmitApplication =
    (isExternalJob ? isValidEmail(trackingEmail) : coverLetter.trim().length > 0) &&
    !applyMutation.isPending &&
    !userApplication &&
    (!shouldShowRedirectFlow || (applicationFlow?.phase !== 'countdown' && applicationFlow?.phase !== 'waiting'));

  if (shouldShowRedirectFlow && job) {
    const waitingApplicationId = applicationFlow?.applicationId || userApplication?._id || '';
    const waitingStatus = applicationFlow?.status || userApplication?.status || 'redirected';
    const waitingSource = applicationFlow?.source || job.source || 'the employer site';
    return (
      <div className="space-y-5 animate-fade-in max-w-4xl mx-auto">
        <button onClick={() => router.back()} className="text-sm text-slate-400 hover:text-white flex items-center gap-2">
          <ArrowLeft size={16} /> {t('jobs.detail.backToJobs')}
        </button>

        {applicationFlow?.phase === 'countdown' ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-4 backdrop-blur-xl">
            <div className="w-full max-w-xl rounded-[28px] border border-emerald-400/20 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/70 p-8 text-center shadow-2xl shadow-emerald-950/30">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/10 text-2xl font-black text-emerald-300">
                {applicationFlow.countdown}
              </div>
              <h2 className="text-3xl font-black text-white">{t('jobs.detail.flow.tracked')}</h2>
              <p className="mt-3 text-sm text-slate-300">
                {t('jobs.detail.flow.takingYou', { source: waitingSource })}
              </p>
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                {t('jobs.detail.flow.openingIn', { count: applicationFlow.countdown })}
              </div>
              <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-left text-sm text-amber-100">
                <div className="font-semibold uppercase tracking-wide text-amber-200">{t('jobs.detail.flow.tip')}</div>
                {t('jobs.detail.flow.tipBody')}
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
                <div className="text-sm uppercase tracking-[0.18em] text-emerald-300/80">{t('jobs.detail.flow.handoff')}</div>
                <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
                  {applicationFlow?.phase === 'countdown' ? t('jobs.detail.flow.openingSite') : t('jobs.detail.flow.waiting')}
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-300">
                  {applicationFlow?.phase === 'countdown'
                    ? t('jobs.detail.flow.createdRecord', { source: waitingSource })
                  : t('jobs.detail.flow.redirected', { source: waitingSource })}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-right">
                <div className="text-[11px] uppercase tracking-wide text-emerald-300/80">{t('jobs.detail.flow.status')}</div>
                <div className="text-lg font-bold text-emerald-300 capitalize">{waitingStatus}</div>
                <div className="text-xs text-slate-300">{t('jobs.detail.flow.savedInDashboard')}</div>
                <div className="mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide bg-slate-100/10 text-slate-200 border border-white/10">
                  {t('jobs.detail.flow.reminderSet')}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6 px-6 py-6 sm:px-8 sm:py-8">
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">{t('jobs.detail.flow.job')}</div>
                <div className="font-semibold text-white">{applicationFlow?.jobTitle || job.title}</div>
                <div className="text-slate-400">{applicationFlow?.company || job.company}</div>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">{t('jobs.detail.flow.nextSteps')}</div>
                <p className="text-sm text-slate-300">
                  {t('jobs.detail.flow.nextStepsBody')}
                </p>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5 space-y-3">
                <div className="text-sm font-semibold text-white">{t('jobs.detail.flow.applicationStatus')}</div>
                <div className="grid grid-cols-1 gap-2 text-sm text-slate-300">
                  <div>{t('jobs.detail.flow.status')}: <span className="text-white capitalize">{waitingStatus}</span></div>
                  <div>{t('jobs.detail.flow.applicationId')}: <span className="text-white">{waitingApplicationId || 'N/A'}</span></div>
                  <div>{t('jobs.detail.flow.reminder24')}: <span className="text-white">{userApplication?.status === 'redirected' ? t('jobs.detail.flow.scheduled') : t('jobs.detail.flow.trackingActive')}</span></div>
                  <div>{t('jobs.detail.flow.reminder7')}: <span className="text-white">{userApplication?.status === 'redirected' ? t('jobs.detail.flow.scheduled') : t('jobs.detail.flow.trackingActive')}</span></div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5 space-y-3">
                <div className="text-sm font-semibold text-white">{t('jobs.detail.flow.nextSteps')}</div>
                <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-4 space-y-3">
                  <p className="text-sm text-slate-300">
                    {t('jobs.detail.flow.nextStepsBody')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="badge-blue">{t('jobs.detail.flow.reminder24')}</span>
                    <span className="badge-blue">{t('jobs.detail.flow.reminder7')}</span>
                    <span className="badge-green">{t('jobs.detail.flow.savedInDashboard')}</span>
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
                <Send size={16} /> {t('jobs.detail.flow.completed')}
              </button>
              <button
                type="button"
                onClick={() => {
                  toast.success(t('jobs.detail.flow.savedReminder'));
                  clearRedirectHandoff();
                }}
                className="btn-secondary inline-flex items-center gap-2"
              >
                <ArrowLeft size={16} /> {t('jobs.detail.flow.later')}
              </button>
              <Link
                href="/dashboard/jobs/applications"
                onClick={() => clearRedirectHandoff({ keepOnPage: true })}
                className="btn-secondary inline-flex items-center gap-2"
              >
                <ExternalLink size={16} /> {t('jobs.detail.flow.viewApplications')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!jobId) {
    return <div className="card text-slate-400">{t('jobs.detail.missingId')}</div>;
  }

  return (
    <div className="space-y-5 animate-fade-in max-w-5xl mx-auto">
      <button onClick={() => router.back()} className="text-sm text-slate-400 hover:text-white flex items-center gap-2">
        <ArrowLeft size={16} /> {t('jobs.detail.backToJobs')}
      </button>

      {isLoading ? (
        <div className="card h-80 animate-pulse" />
      ) : !job ? (
        <div className="card text-center py-16 text-slate-400">{t('jobs.detail.notFound')}</div>
      ) : (
        <div className="grid lg:grid-cols-[1.6fr_1fr] gap-5">
          <div className="card space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="badge-blue">{job.category === 'Other' && job.categoryOther ? t('jobs.board.badges.other', { category: job.categoryOther }) : job.category}</span>
                  {isStaff && <span className="badge-green capitalize">{job.source}</span>}
                  {job.jobType && <span className="badge-yellow capitalize">{job.jobType}</span>}
                </div>
                <h1 className="text-3xl font-black leading-tight">{job.title}</h1>
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-400">
                  <span className="flex items-center gap-2"><Building2 size={15} /> {job.company}</span>
                  <span className="flex items-center gap-2"><CalendarDays size={15} /> {publishedLabel}</span>
                  <span className="flex items-center gap-2"><Globe2 size={15} /> {job.location || t('jobs.board.badges.remote')}</span>
                </div>
              </div>
              {job.salary && <div className="badge-green text-sm">{job.salary}</div>}
            </div>

            <div className="space-y-3">
              <h2 className="font-bold text-lg">{t('jobs.detail.description')}</h2>
              <p className="text-sm leading-7 text-slate-300 whitespace-pre-line">{job.description}</p>
            </div>

            {(job.tags?.length ?? 0) > 0 && (
              <div className="space-y-3">
                <h2 className="font-bold text-lg">{t('jobs.detail.skills')}</h2>
                <div className="flex flex-wrap gap-2">
                  {(job.tags || []).map((tag: string) => (
                    <span key={tag} className="badge-blue flex items-center gap-1"><Tag size={12} /> {tag}</span>
                  ))}
                </div>
              </div>
            )}

            {isStaff && job.applicationUrl && (
              <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-300">
                {t('jobs.detail.sourceNote')}
                <a href={job.applicationUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-green-400 hover:text-green-300">
                  {t('jobs.detail.sourceLink')} <ExternalLink size={14} />
                </a>
              </div>
            )}
          </div>

          <div className="card space-y-4 h-fit sticky top-24">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">{t('jobs.detail.applyInSite')}</div>
              <h2 className="text-xl font-bold">{t('jobs.detail.submitTitle')}</h2>
              <p className="text-sm text-slate-400 mt-2">{t('jobs.detail.submitSubtitle')}</p>
            </div>

            <div className="space-y-2 text-sm text-slate-300">
              <div className="rounded-xl bg-slate-900 px-4 py-3">
                <div className="text-slate-500 text-xs mb-1">{t('jobs.detail.company')}</div>
                <div>{job.company}</div>
              </div>
              <div className="rounded-xl bg-slate-900 px-4 py-3">
                <div className="text-slate-500 text-xs mb-1">{t('jobs.detail.location')}</div>
                <div>{job.location || t('jobs.board.badges.remote')}</div>
              </div>
              <div className="rounded-xl bg-slate-900 px-4 py-3">
                <div className="text-slate-500 text-xs mb-1">{t('jobs.detail.applyMethod')}</div>
                <div>{isExternalJob ? t('jobs.detail.sourceLink') : t('jobs.detail.onSite')}</div>
              </div>
              {typeof job.applicationTokenCost === 'number' && job.applicationTokenCost > 0 ? (
                <div className="rounded-xl bg-slate-900 px-4 py-3">
                  <div className="text-slate-500 text-xs mb-1">{t('jobs.detail.applicationTokenCost')}</div>
                  <div>{job.applicationTokenCost} tokens</div>
                </div>
              ) : null}
            </div>

            {isExternalJob ? (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 space-y-3">
                <div className="text-sm font-semibold text-emerald-200">{t('jobs.detail.sourceNote')}</div>
                <p className="text-sm text-slate-300">
                  This is an external listing. Enter the email address where you want recruiter feedback sent, then continue to the source job post.
                </p>
                <div>
                  <label className="text-sm text-slate-300 mb-1 block">Feedback email</label>
                  <input
                    className="input"
                    type="email"
                    value={trackingEmail}
                    onChange={(e) => setTrackingEmail(e.target.value)}
                    placeholder={user?.email || 'you@example.com'}
                    required
                  />
                  <p className="mt-2 text-xs text-slate-500">Replies and updates will be tracked against this email address.</p>
                </div>
                <button
                  type="button"
                  onClick={handleApplyClick}
                  disabled={!canSubmitApplication}
                  className="btn-primary w-full inline-flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {applyMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
                  Continue to source
                </button>
                <p className="text-xs text-slate-500">
                  We&apos;ll save this as a redirected application so you can track feedback later.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-sm text-slate-300 mb-1 block">{t('jobs.detail.coverLetter')} <span className="text-rose-400">*</span></label>
                  <textarea
                    className="input min-h-40"
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    placeholder={t('jobs.detail.coverLetterPlaceholder')}
                    maxLength={2000}
                    required
                  />
                  <p className="mt-2 text-xs text-slate-500">{coverLetter.length}/2000 | {t('jobs.detail.coverLetterRequired')}</p>
                </div>

                <div>
                  <label className="text-sm text-slate-300 mb-1 block">{t('jobs.detail.uploadCv')}</label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="input file:mr-4 file:rounded-lg file:border-0 file:bg-slate-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-600"
                    onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                  />
                  <p className="mt-2 text-xs text-slate-500">{t('jobs.detail.cvHint')}</p>
                  {cvFile ? <p className="mt-2 text-xs text-emerald-300">{t('jobs.detail.selectedFile', { file: cvFile.name })}</p> : null}
                </div>

                <button
                  onClick={handleApplyClick}
                  disabled={!canSubmitApplication}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {applyMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {userApplication ? t('jobs.detail.applied') : t('jobs.detail.apply')}
                </button>
                {userApplication ? (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                    {t('jobs.detail.applicationStatus')}: <span className="font-semibold capitalize">{t(`jobs.applications.statuses.${userApplication.status}`)}</span>
                    {userApplication.statusDescription ? <div className="mt-1 text-xs text-emerald-100/80">{userApplication.statusDescription}</div> : null}
                  </div>
                ) : null}
                {canManageApplications ? (
                  <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-white">{t('jobs.detail.manageApplications')}</div>
                      <span className="text-xs text-slate-400">{t('jobs.detail.totalApplications', { count: managedApplications.length })}</span>
                    </div>
                    <Link
                      href={`/dashboard/jobs/${jobId}/applicants`}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 hover:border-emerald-300/50 hover:bg-emerald-500/15"
                    >
                      {t('jobs.detail.openApplicants')} <ExternalLink size={14} />
                    </Link>
                    {managedApplications.length === 0 ? (
                      <div className="text-sm text-slate-400">{t('jobs.detail.noApplicationsYet')}</div>
                    ) : (
                      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                        {managedApplications.map((application) => {
                          const fullName = [application.applicant?.firstName, application.applicant?.lastName].filter(Boolean).join(' ').trim();
                          const applicantName = application.applicant?.name || fullName || application.applicant?.email || t('jobs.applicants.table.applicant');
                          return (
                            <div key={application._id} className="rounded-xl border border-slate-700 bg-slate-950/80 p-3 space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="text-sm font-medium text-white">{applicantName}</div>
                                  {application.applicant?.email ? <div className="text-xs text-slate-400">{application.applicant.email}</div> : null}
                                  {application.appliedAt ? (
                                    <div className="text-xs text-slate-500 mt-1">{t('jobs.detail.appliedAt', { date: new Date(application.appliedAt).toLocaleString() })}</div>
                                  ) : null}
                                </div>
                                <span className="badge-blue capitalize">{t(`jobs.applications.statuses.${application.status}`)}</span>
                              </div>
                              {application.coverLetter ? (
                                <p className="text-xs text-slate-300 whitespace-pre-line line-clamp-4">{application.coverLetter}</p>
                              ) : (
                                <p className="text-xs text-slate-500">{t('jobs.detail.noCoverLetter')}</p>
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
                                        const confirmed = window.confirm(t('jobs.detail.confirmStatus', { status: statusValue }));
                                        if (!confirmed) return;
                                        updateStatusMutation.mutate({ applicationId: application._id, status: statusValue });
                                      }}
                                      className={`rounded-lg px-2 py-1.5 text-xs font-medium capitalize transition ${isCurrent ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 disabled:opacity-50'}`}
                                    >
                                      {isUpdatingThis ? t('jobs.detail.updating') : statusValue}
                                    </button>
                                  );
                                })}
                              </div>
                              {canOpenJobChat && (application.applicant?.id || application.applicant?.userId) ? (
                                <Link
                                  href={`/dashboard/chat?jobId=${jobId}&applicantId=${application.applicant?.id || application.applicant?.userId}`}
                                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-200 hover:border-emerald-300/50 hover:bg-emerald-500/15"
                                >
                                  <MessageSquare size={14} /> {t('jobs.detail.openJobChat')}
                                </Link>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
              </>
            )}
            <Link href="/dashboard/jobs/applications" className="btn-secondary w-full flex items-center justify-center gap-2">
              <ExternalLink size={16} /> {t('jobs.detail.myApplications')}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
