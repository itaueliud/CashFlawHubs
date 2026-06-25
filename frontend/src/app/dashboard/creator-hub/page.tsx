'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { Bookmark, Eye, Filter, Heart, Lock, Search, Play, BookmarkCheck, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { CreatorHubMeta, CreatorUploadItem } from './types';
import CreatorHubShell from './CreatorHubShell';

const CATEGORY_ALL = 'all';
const CREATOR_HUB_ROUTE = '/dashboard/creator-hub';

export default function CreatorHubBrowsePage() {
  const router = useRouter();
  const { token } = useAuthStore();
  const [meta, setMeta] = useState<CreatorHubMeta | null>(null);
  const [uploads, setUploads] = useState<CreatorUploadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState(CATEGORY_ALL);
  const [tier, setTier] = useState(CATEGORY_ALL);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    api.get('/creator-hub/meta').then(({ data }) => setMeta(data));
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (category !== CATEGORY_ALL) params.set('category', category);
        if (tier !== CATEGORY_ALL) params.set('tier', tier);
        if (debouncedSearch) params.set('search', debouncedSearch);
        const url = params.toString() ? `/creator-hub/uploads?${params.toString()}` : '/creator-hub/uploads';
        const { data } = await api.get(url);
        if (!cancelled) setUploads(data.uploads || []);
      } catch (error: any) {
        if (!cancelled) toast.error(error?.response?.data?.message || 'Failed to load creator videos');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [category, tier, debouncedSearch]);

  const categories = meta?.categories || [];
  const tiers = meta?.tiers || {};
  const apiOrigin = api.defaults.baseURL?.replace(/\/api\/?$/, '') || '';
  const filteredStats = useMemo(() => ({
    total: uploads.length,
    premium: uploads.filter((item) => item.isPremium).length,
    unlocked: uploads.filter((item) => item.isPremium && !item.isLocked).length,
  }), [uploads]);

  const videoSrc = (item: CreatorUploadItem) => item.videoPublicUrl || `${apiOrigin}${item.streamUrl}?token=${encodeURIComponent(token || '')}`;

  const toggleSave = async (item: CreatorUploadItem) => {
    setSavingId(item._id);
    try {
      if (item.isSaved) {
        await api.delete(`/creator-hub/uploads/${item._id}/save`);
        setUploads((current) => current.map((upload) => upload._id === item._id ? { ...upload, isSaved: false } : upload));
        toast.success('Removed from saved');
        return;
      }
      const { data } = await api.post(`/creator-hub/uploads/${item._id}/save`);
      if (data?.saved) {
        setUploads((current) => current.map((upload) => upload._id === item._id ? { ...upload, isSaved: true } : upload));
        toast.success('Saved');
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not save this video');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <CreatorHubShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-[24px] border border-amber-500/15 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-5 dark:border-amber-400/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <Sparkles size={12} /> Creator Hub
              </div>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900 dark:text-white">Browse discoverable videos</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">Free videos autoplay as thumbnails. Premium videos stay locked until a viewer pays with wallet USD or mobile money.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm sm:min-w-[20rem]">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 text-center dark:border-slate-700 dark:bg-slate-800/80">
                <div className="text-xs text-slate-500">Uploads</div>
                <div className="mt-1 font-black">{filteredStats.total}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 text-center dark:border-slate-700 dark:bg-slate-800/80">
                <div className="text-xs text-slate-500">Premium</div>
                <div className="mt-1 font-black">{filteredStats.premium}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 text-center dark:border-slate-700 dark:bg-slate-800/80">
                <div className="text-xs text-slate-500">Unlocked</div>
                <div className="mt-1 font-black">{filteredStats.unlocked}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-nowrap lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value.slice(0, 50))}
                maxLength={50}
                placeholder="Search"
                className="w-full rounded-2xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
            <div className="flex min-w-[220px] flex-1 flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value={CATEGORY_ALL}>All categories</option>
                {categories.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-[220px] flex-1 flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Tier</label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value={CATEGORY_ALL}>All tiers</option>
                {Object.entries(tiers).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/creator-hub/saved" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Saved</Link>
          <Link href="/dashboard/creator-hub/my-uploads" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">My Uploads</Link>
          <Link href="/dashboard/creator-hub/upload" className="rounded-full border border-emerald-500 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300">Upload</Link>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-72 animate-pulse rounded-[24px] border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800/70" />
            ))}
          </div>
        ) : uploads.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900/60">
            No videos match the current filters.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {uploads.map((item) => (
              <article key={item._id} className="group overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900">
                <button onClick={() => router.push(`${CREATOR_HUB_ROUTE}/${item._id}`)} className="block w-full text-left">
                  <div className="relative aspect-video overflow-hidden bg-slate-900">
                    {!item.isLocked ? (
                      <video
                        src={videoSrc(item)}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        muted
                        autoPlay
                        loop
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900 text-white">
                        <div className="flex flex-col items-center gap-2 text-center">
                          <Lock size={28} />
                          <div className="text-sm font-semibold">${item.priceUSD.toFixed(2)} USD to unlock</div>
                          <div className="text-xs text-slate-300">Premium preview locked</div>
                        </div>
                      </div>
                    )}
                    <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/90 px-2.5 py-1 text-[11px] font-semibold text-white">{item.badge || 'Creator'}</span>
                      {item.isPremium && <span className="rounded-full border border-amber-500/20 bg-amber-500/90 px-2.5 py-1 text-[11px] font-semibold text-white">Premium</span>}
                      {item.isSaved && <span className="rounded-full border border-sky-500/20 bg-sky-500/90 px-2.5 py-1 text-[11px] font-semibold text-white">Saved</span>}
                    </div>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3 text-white">
                      <div className="flex items-center gap-2 text-xs text-white/80">
                        <Play size={12} /> {item.isLocked ? 'Locked preview' : 'Free preview'}
                      </div>
                    </div>
                  </div>
                </button>

                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="line-clamp-2 text-base font-bold leading-snug text-slate-900 dark:text-white">{item.title}</h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.creator?.name || 'Creator'}{item.creator?.country ? ` - ${item.creator.country}` : ''}</p>
                    </div>
                    <button onClick={() => toggleSave(item)} disabled={savingId === item._id} className="inline-flex shrink-0 items-center justify-center rounded-full border border-slate-300 p-2 text-slate-500 transition hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-400 dark:hover:text-emerald-300">
                      {item.isSaved ? <BookmarkCheck size={16} className="text-emerald-600 dark:text-emerald-300" /> : <Bookmark size={16} />}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800"><Eye size={12} /> {item.views}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800"><Heart size={12} /> {item.unlocks}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800"><Filter size={12} /> {item.category.replace('_', ' ')}</span>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                    {item.isLocked ? (
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">Premium access required</span>
                        <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">${item.priceUSD.toFixed(2)}</span>
                      </div>
                    ) : (
                      <p className="line-clamp-2">{item.description}</p>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </CreatorHubShell>
  );
}