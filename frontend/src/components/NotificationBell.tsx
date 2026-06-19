'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Bell, CheckCheck, Dot, Loader2 } from 'lucide-react';
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

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount ?? notifications.filter((notification) => !notification.readAt).length;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-300 transition hover:border-emerald-400/40 hover:text-white"
        aria-label={t('notifications.notifications')}
      >
        <Bell size={18} />
        {unreadCount > 0 ? (
          <span
            className={`absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white ${
              notifications.some((n) => !n.readAt && n.type === 'system') ? 'bg-red-500' : 'bg-emerald-500'
            }`}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-[min(calc(100vw-1rem),22rem)] overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl shadow-black/40">
          <div className="flex flex-col items-start justify-between gap-2 border-b border-slate-800 px-3 py-3 sm:flex-row sm:items-center sm:gap-0 sm:px-4">
            <div>
              <div className="text-sm font-semibold text-white">{t('notifications.notifications')}</div>
              <div className="text-xs text-slate-500">{t('notifications.unread', { count: unreadCount })}</div>
            </div>
            <button
              type="button"
              disabled={readAllMutation.isPending || unreadCount === 0}
              onClick={() => readAllMutation.mutate()}
              className="w-full whitespace-nowrap rounded-full border border-slate-700 px-2 py-1 text-[11px] font-semibold text-slate-300 transition disabled:opacity-50 sm:w-auto sm:px-3 sm:text-xs"
            >
              {readAllMutation.isPending ? <Loader2 size={12} className="mr-1 inline-block animate-spin" /> : <CheckCheck size={12} className="mr-1 inline-block" />}
              {t('notifications.markAllRead')}
            </button>
          </div>

          <div className="max-h-[calc(100vh-10rem)] divide-y divide-slate-800 overflow-y-auto sm:max-h-[24rem]">
            {isLoading ? (
              <div className="flex items-center justify-center px-4 py-10 text-sm text-slate-400">
                <Loader2 size={14} className="mr-2 animate-spin" /> {t('notifications.loadingNotifications')}
              </div>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-slate-400">{t('notifications.noNotifications')}</div>
              ) : (
                notifications.map((notification) => {
                  const unread = !notification.readAt;
                  const isAdminMessage = notification.type === 'system';
                  return (
                    <button
                      key={notification._id}
                    type="button"
                    onClick={() => {
                      if (unread) readOneMutation.mutate(notification._id);
                      setOpen(false);
                    }}
                      className={`w-full px-3 py-3 text-left transition hover:bg-slate-900 sm:px-4 ${unread ? 'bg-slate-950' : 'bg-slate-950/60'}`}
                    >
                      <div className="flex items-start gap-2 sm:gap-3">
                      <div
                        className={`mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full sm:h-8 sm:w-8 ${
                          isAdminMessage
                            ? 'bg-red-500/15 text-red-400'
                            : unread
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        <Dot size={18} className="sm:block hidden" />
                        <Dot size={16} className="sm:hidden block" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col items-start justify-between gap-1 sm:flex-row sm:items-center sm:gap-2">
                          <div className={`truncate text-xs font-semibold sm:text-sm ${isAdminMessage ? 'text-red-400' : 'text-white'}`}>
                            {notification.title}
                          </div>
                          <span
                            className={`whitespace-nowrap text-[9px] uppercase tracking-[0.12em] sm:text-[10px] sm:tracking-[0.18em] ${
                              isAdminMessage ? 'text-red-400' : 'text-slate-500'
                            }`}
                          >
                            {isAdminMessage ? 'Admin' : notification.type}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-400 sm:text-sm">{notification.message}</div>
                        <div className="mt-2 text-[10px] text-slate-600 sm:text-[11px]">{new Date(notification.createdAt).toLocaleString()}</div>
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
