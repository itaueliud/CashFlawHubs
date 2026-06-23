'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Eye, Lock, Trash2 } from 'lucide-react';
import { MyUploadItem } from '../types';
import CreatorHubShell from '../CreatorHubShell';

export default function MyUploadsPage() {
  const [uploads, setUploads] = useState<MyUploadItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/creator-hub/uploads/mine');
      setUploads(data.uploads || []);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to load uploads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const remove = async (id: string) => {
    if (!window.confirm('Delete this upload permanently?')) return;
    try {
      await api.delete(`/creator-hub/uploads/${id}`);
      toast.success('Removed');
      await load();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to delete');
    }
  };

  return (
    <CreatorHubShell>
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white">My Uploads</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Track views, unlocks, and creator earnings from your own uploads.</p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-500">Loading...</div>
      ) : uploads.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400">
          You haven&apos;t published anything yet.
        </div>
      ) : (
        <div className="space-y-3">
          {uploads.map((upload) => (
            <div key={upload._id} className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 dark:text-white">{upload.title}</h3>
                  {upload.isPremium && <Lock size={14} className="text-amber-500" />}
                </div>
                <div className="text-xs text-slate-500">{upload.badge || 'Creator upload'}</div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800"><Eye size={12} className="inline -mt-0.5" /> {upload.views} views</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">{upload.unlocks} unlocks</span>
                  {upload.isPremium && <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-700 dark:text-emerald-300">${upload.usdEarned.toFixed(2)} earned</span>}
                </div>
              </div>
              <button onClick={() => remove(upload._id)} className="inline-flex items-center gap-2 rounded-2xl border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition hover:border-red-400 hover:bg-red-50 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10">
                <Trash2 size={16} /> Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
    </CreatorHubShell>
  );
}
