'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
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
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-[min(92vw,22rem)] overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-white">Notifications</div>
              <div className="text-xs text-slate-500">{unreadCount} unread</div>
            </div>
            <button
              type="button"
              disabled={readAllMutation.isPending || unreadCount === 0}
              onClick={() => readAllMutation.mutate()}
              className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-300 disabled:opacity-50"
            >
              {readAllMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} />}
              Mark all read
            </button>
          </div>

          <div className="max-h-[24rem] divide-y divide-slate-800 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center px-4 py-10 text-sm text-slate-400">
                <Loader2 size={14} className="mr-2 animate-spin" /> Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-400">No notifications yet.</div>
            ) : (
              notifications.map((notification) => {
                const unread = !notification.readAt;
                return (
                  <button
                    key={notification._id}
                    type="button"
                    onClick={() => {
                      if (unread) readOneMutation.mutate(notification._id);
                      setOpen(false);
                    }}
                    className={`w-full px-4 py-3 text-left transition hover:bg-slate-900 ${unread ? 'bg-slate-950' : 'bg-slate-950/60'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 flex h-8 w-8 items-center justify-center rounded-full ${unread ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
                        <Dot size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate text-sm font-semibold text-white">{notification.title}</div>
                          <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{notification.type}</span>
                        </div>
                        <div className="mt-1 text-sm text-slate-400">{notification.message}</div>
                        <div className="mt-2 text-[11px] text-slate-600">{new Date(notification.createdAt).toLocaleString()}</div>
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
