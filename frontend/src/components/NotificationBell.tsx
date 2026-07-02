'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Bell, CheckCheck, Dot, Loader2 } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import api from '@/lib/api';

type NotificationItem = {
  _id: string;
  title: string;
  message: string;
  type: string;
  readAt?: string | null;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

type NotificationsResponse = {
  success: boolean;
  notifications: NotificationItem[];
  unreadCount?: number;
};

const TYPE_META: Record<string, { label: string; iconWrap: string; title: string; tag: string }> = {
  system: {
    label: 'Admin',
    iconWrap: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400',
    title: 'text-red-600 dark:text-red-400',
    tag: 'text-red-600 dark:text-red-400',
  },
  withdrawal_success: {
    label: 'Payout',
    iconWrap: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
    title: 'text-emerald-700 dark:text-emerald-300',
    tag: 'text-emerald-600 dark:text-emerald-400',
  },
  manual_payment: {
    label: 'Payout',
    iconWrap: 'bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400',
    title: 'text-teal-700 dark:text-teal-300',
    tag: 'text-teal-600 dark:text-teal-400',
  },
  activation_success: {
    label: 'Account',
    iconWrap: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
    title: 'text-blue-700 dark:text-blue-300',
    tag: 'text-blue-600 dark:text-blue-400',
  },
  account_suspended: {
    label: 'Account',
    iconWrap: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
    title: 'text-rose-700 dark:text-rose-300',
    tag: 'text-rose-600 dark:text-rose-400',
  },
  account_reactivated: {
    label: 'Account',
    iconWrap: 'bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-400',
    title: 'text-green-700 dark:text-green-300',
    tag: 'text-green-600 dark:text-green-400',
  },
  job_application: {
    label: 'Jobs',
    iconWrap: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
    title: 'text-violet-700 dark:text-violet-300',
    tag: 'text-violet-600 dark:text-violet-400',
  },
  job_status: {
    label: 'Jobs',
    iconWrap: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400',
    title: 'text-indigo-700 dark:text-indigo-300',
    tag: 'text-indigo-600 dark:text-indigo-400',
  },
  job_reminder: {
    label: 'Jobs',
    iconWrap: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
    title: 'text-amber-700 dark:text-amber-300',
    tag: 'text-amber-600 dark:text-amber-400',
  },
  new_application: {
    label: 'Jobs',
    iconWrap: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400',
    title: 'text-cyan-700 dark:text-cyan-300',
    tag: 'text-cyan-600 dark:text-cyan-400',
  },
};

const DEFAULT_META = {
  label: 'Update',
  iconWrap: 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  title: 'text-slate-800 dark:text-white',
  tag: 'text-slate-500 dark:text-slate-500',
};

function getTypeMeta(type: string) {
  return TYPE_META[type] || DEFAULT_META;
}

export default function NotificationBell() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications?limit=8').then((r) => r.data as NotificationsResponse),
    refetchInterval: 30000,
  });

  const readAllMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => refetch(),
  });

  const readOneMutation = useMutation({
    mutationFn: (notificationId: string) => api.patch(`/notifications/${notificationId}/read`),
    onSuccess: () => refetch(),
  });

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount ?? notifications.filter((notification) => !notification.readAt).length;
  const hasUrgentUnread = notifications.some((n) => !n.readAt && n.type === 'system');

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 transition hover:border-emerald-500/50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-emerald-400/40 dark:hover:text-white"
        aria-label={t('notifications.notifications')}
      >
        <Bell size={18} />
        {unreadCount > 0 ? (
          <span
            className={`absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white ${
              hasUrgentUnread ? 'bg-red-500' : 'bg-emerald-500'
            }`}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-x-2 top-16 z-50 max-h-[calc(100vh-5rem)] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/40 sm:absolute sm:right-0 sm:top-12 sm:left-auto sm:w-[min(calc(100vw-1rem),22rem)] dark:border-slate-700 dark:bg-slate-950 dark:shadow-black/50">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 dark:border-slate-800">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">{t('notifications.notifications')}</div>
                <div className="text-xs text-slate-500 dark:text-slate-500">{t('notifications.unread', { count: unreadCount })}</div>
              </div>
              <ThemeToggle className="h-8 w-8 flex-shrink-0" />
            </div>
            <button
              type="button"
              disabled={readAllMutation.isPending || unreadCount === 0}
              onClick={() => readAllMutation.mutate()}
              className="inline-flex w-full items-center justify-center gap-1 rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-400 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500"
            >
              {readAllMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} />}
              {t('notifications.markAllRead')}
            </button>
          </div>

          <div className="max-h-[calc(100vh-11rem)] divide-y divide-slate-200 overflow-y-auto dark:divide-slate-800 sm:max-h-[24rem]">
            {isLoading ? (
              <div className="flex items-center justify-center px-4 py-10 text-sm text-slate-500 dark:text-slate-400">
                <Loader2 size={14} className="mr-2 animate-spin" /> {t('notifications.loadingNotifications')}
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">{t('notifications.noNotifications')}</div>
            ) : (
              notifications.map((notification) => {
                const unread = !notification.readAt;
                const meta = getTypeMeta(notification.type);

                return (
                  <button
                    key={notification._id}
                    type="button"
                    onClick={() => {
                      if (unread) readOneMutation.mutate(notification._id);
                      setOpen(false);
                    }}
                    className={`w-full px-4 py-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900 ${
                      unread ? 'bg-white dark:bg-slate-950' : 'bg-slate-50/60 dark:bg-slate-950/60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${meta.iconWrap}`}>
                        <Dot size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col items-start justify-between gap-1 sm:flex-row sm:items-center sm:gap-2">
                          <div className={`truncate text-sm font-semibold ${meta.title}`}>{notification.title}</div>
                          <span className={`whitespace-nowrap text-[10px] uppercase tracking-[0.16em] ${meta.tag}`}>
                            {meta.label}
                          </span>
                        </div>
                        <div className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{notification.message}</div>
                        <div className="mt-2 text-[11px] text-slate-400 dark:text-slate-600">
                          {new Date(notification.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
