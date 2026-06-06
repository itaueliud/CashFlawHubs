'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Loader2, Search } from 'lucide-react';
import ApplicantEmailBadge from '@/components/ApplicantEmailBadge';

type JobApplicationStatus = 'redirected' | 'applied' | 'interviewing' | 'offered' | 'rejected' | 'withdrawn';

type Applicant = {
  id?: string;
  userId?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
};

type ManagedApplication = {
  _id: string;
  status: JobApplicationStatus;
  coverLetter?: string;
  tokenCost?: number;
  appliedAt?: string;
  createdAt?: string;
  applicant?: Applicant;
  applicantEmailSent?: boolean;
  employerDeliveryStatus?: 'pending' | 'processing' | 'delivered' | 'failed';
};

type ApplicantsResponse = {
  success: boolean;
  job?: {
    _id: string;
    title: string;
    company: string;
  };
  applications: ManagedApplication[];
  pagination: {
    total: number;
    page: number;
    pages: number;
  };
};

const STATUS_OPTIONS: JobApplicationStatus[] = ['applied', 'interviewing', 'offered', 'rejected', 'withdrawn'];

export default function JobApplicantsPage() {
  const { t } = useTranslation();
  const params = useParams<{ id?: string | string[]; slug?: string[] }>();
  const directId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const slugId = Array.isArray(params?.slug) && params.slug[0] === 'jobs' ? params.slug[1] : undefined;
  const jobId = directId || slugId;

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const queryString = useMemo(() => {
    const query = new URLSearchParams();
    query.set('page', String(page));
    query.set('limit', '20');
    if (status) query.set('status', status);
    if (search.trim()) query.set('search', search.trim());
    return query.toString();
  }, [page, search, status]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['job-applicants', jobId, page, status, search],
    enabled: Boolean(jobId),
    queryFn: async () => {
      const response = await api.get(`/jobs/${jobId}/applications?${queryString}`);
      return response.data as ApplicantsResponse;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ applicationId, nextStatus }: { applicationId: string; nextStatus: JobApplicationStatus }) => {
      const response = await api.patch(`/jobs/${jobId}/applications/${applicationId}/status`, { status: nextStatus });
      return response.data as { message?: string };
    },
    onSuccess: async (response) => {
      toast.success(response.message || t('jobs.applications.statusUpdated'));
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

  const applications = data?.applications || [];
  const pagination = data?.pagination || { page: 1, pages: 1, total: 0 };

  if (!jobId) {
    return <div className="card text-slate-400">{t('jobs.detail.missingId')}</div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/dashboard/jobs/${jobId}`} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft size={16} /> {t('jobs.applicants.backToJob')}
        </Link>
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('jobs.applicants.heading')}</div>
      </div>

      <div className="rounded-[1.5rem] border border-emerald-500/15 bg-gradient-to-br from-emerald-950/70 via-slate-950 to-slate-900 p-6">
        <h1 className="text-2xl font-black text-white">{t('jobs.applicants.title', { job: data?.job?.title || t('jobs.detail.jobUnavailable') })}</h1>
        <p className="mt-2 text-sm text-slate-300">
          {t('jobs.applicants.subtitle')}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-900/90 p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="input pl-9"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={t('jobs.applicants.searchPlaceholder')}
            />
          </div>
          <select
            className="input"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('jobs.applicants.allStatuses')}</option>
            {STATUS_OPTIONS.map((statusOption) => (
              <option key={statusOption} value={statusOption} className="capitalize">
                {t(`jobs.applications.statuses.${statusOption}`)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setStatus('');
              setPage(1);
            }}
            className="btn-secondary"
          >
            {t('jobs.applicants.clearFilters')}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="card flex h-56 items-center justify-center text-slate-400">
          <Loader2 size={18} className="mr-2 animate-spin" /> {t('jobs.applicants.loading')}
        </div>
      ) : applications.length === 0 ? (
        <div className="card py-16 text-center text-slate-400">{t('jobs.applicants.none')}</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-700 bg-slate-900/90">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-slate-700 text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">{t('jobs.applicants.table.applicant')}</th>
                <th className="px-4 py-3 font-medium">{t('jobs.applicants.table.contact')}</th>
                <th className="px-4 py-3 font-medium">{t('jobs.applicants.table.applied')}</th>
                <th className="px-4 py-3 font-medium">{t('jobs.applicants.table.tokens')}</th>
                <th className="px-4 py-3 font-medium">{t('jobs.applicants.table.coverLetter')}</th>
                <th className="px-4 py-3 font-medium">{t('jobs.applicants.table.status')}</th>
                <th className="px-4 py-3 font-medium">{t('jobs.applicants.table.manage')}</th>
                <th className="px-4 py-3 font-medium">{t('jobs.applicants.table.delivery')}</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => {
                const fullName = [application.applicant?.firstName, application.applicant?.lastName]
                  .filter(Boolean)
                  .join(' ')
                  .trim();
                const applicantName = application.applicant?.name || fullName || t('jobs.applicants.table.applicant');

                return (
                  <tr key={application._id} className="border-b border-slate-800 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{applicantName}</div>
                      {application.applicant?.userId ? (
                        <div className="text-xs text-slate-500">{application.applicant.userId}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      <div>{application.applicant?.email || '-'}</div>
                      <div className="text-xs text-slate-500">{application.applicant?.phone || '-'}</div>
                      <div className="mt-2">
                        <ApplicantEmailBadge sent={Boolean(application.applicantEmailSent)} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {new Date(application.appliedAt || application.createdAt || Date.now()).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{application.tokenCost || 0}</td>
                    <td className="px-4 py-3 text-slate-300 max-w-sm">
                      <p className="line-clamp-3 whitespace-pre-line">{application.coverLetter || t('jobs.applications.noCoverLetter')}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge-blue capitalize">{t(`jobs.applications.statuses.${application.status}`)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select
                          className="input h-9 py-1 text-xs"
                          defaultValue={application.status}
                          onChange={(event) => {
                            const nextStatus = event.target.value as JobApplicationStatus;
                            if (nextStatus === application.status) return;
                            const confirmed = window.confirm(t('jobs.applicants.confirmStatus', { status: nextStatus }));
                            if (!confirmed) {
                              event.target.value = application.status;
                              return;
                            }
                            updateStatusMutation.mutate({
                              applicationId: application._id,
                              nextStatus,
                            });
                          }}
                          disabled={updateStatusMutation.isPending}
                        >
                          {STATUS_OPTIONS.map((statusOption) => (
                            <option key={statusOption} value={statusOption} className="capitalize">
                              {t(`jobs.applications.statuses.${statusOption}`)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {application.employerDeliveryStatus ? (
                        <span className={`text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded-full ${application.employerDeliveryStatus === 'delivered' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-400/20' : application.employerDeliveryStatus === 'failed' ? 'bg-red-500/10 text-red-300 border border-red-400/20' : 'bg-amber-500/10 text-amber-300 border border-amber-400/20'}`}>
                          {application.employerDeliveryStatus}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pagination.pages > 1 ? (
        <div className="flex justify-center gap-2">
          <button
            type="button"
            disabled={pagination.page <= 1}
            onClick={() => setPage((current) => current - 1)}
            className="btn-secondary px-4 py-2 text-sm disabled:opacity-50"
          >
            {t('common.previous')}
          </button>
          <span className="px-3 py-2 text-sm text-slate-400">{pagination.page} / {pagination.pages}</span>
          <button
            type="button"
            disabled={pagination.page >= pagination.pages}
            onClick={() => setPage((current) => current + 1)}
            className="btn-secondary px-4 py-2 text-sm disabled:opacity-50"
          >
            {t('common.next')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
