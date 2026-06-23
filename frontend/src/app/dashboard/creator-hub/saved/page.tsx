'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Bookmark, Eye, Lock } from 'lucide-react';
import { CreatorUploadItem } from '../types';

export default function SavedUploadsPage() {
  const router = useRouter();
  const [uploads, setUploads] = useState<CreatorUploadItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/creator-hub/saved').then(({ data }) => setUploads(data.uploads || [])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white">Saved Videos</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Your saved creator videos are collected here for fast access.</p>
      </div>
      {loading ? (
        <div className="py-20 text-center text-slate-500">Loading...</div>
      ) : uploads.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400">
          You haven&apos;t saved any videos yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {uploads.map((item) => (
            <button key={item._id} onClick={() => router.push(`/dashboard/creator-hub/${item._id}`)} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
              <div className="relative aspect-video bg-slate-900">
                {item.isLocked ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white">
                    <div className="flex flex-col items-center gap-2">
                      <Lock size={24} />
                      <span className="text-xs">Locked</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-white/70"><Bookmark size={22} /></div>
                )}
              </div>
              <div className="p-4">
                <h3 className="truncate font-bold text-slate-900 dark:text-white">{item.title}</h3>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500"><Eye size={12} /> {item.views}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
