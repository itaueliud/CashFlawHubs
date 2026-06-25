'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { UploadCloud } from 'lucide-react';
import { CreatorHubMeta } from '../types';
import CreatorHubShell from '../CreatorHubShell';

export default function CreatorHubUploadPage() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const [meta, setMeta] = useState<CreatorHubMeta | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [tier, setTier] = useState('normal');
  const [file, setFile] = useState<File | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [defaultPriceUSD, setDefaultPriceUSD] = useState('');

  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [whatsapp, setWhatsapp] = useState('');
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/creator-hub/meta').then(({ data }) => setMeta(data));
  }, []);

  const tierConfig = meta?.tiers?.[tier];
  const canAfford = (user?.tokenBalance || 0) >= (tierConfig?.tokenCost || 0);

  const handleSubmit = async () => {
    if (!file) return toast.error('Choose a video file');
    if (!title.trim()) return toast.error('Title is required');
    if (!category) return toast.error('Choose a category');
    if (!canAfford) return toast.error(`You need ${tierConfig?.tokenCost} Tokens for ${tierConfig?.label}`);

    const form = new FormData();
    form.append('title', title);
    form.append('description', description);
    form.append('category', category);
    form.append('tier', tier);
    form.append('isPremium', String(isPremium));
    if (isPremium && defaultPriceUSD.trim()) {
      form.append('defaultPriceUSD', defaultPriceUSD.trim());
    }
    form.append('phone', phone);
    form.append('email', email);
    form.append('whatsapp', whatsapp);
    form.append('website', website);
    form.append('video', file);

    setSubmitting(true);
    try {
      const { data } = await api.post('/creator-hub/uploads', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (data?.auditLogWarning) {
        toast(data.message || 'Upload published', {
          icon: '!',
          duration: 5000,
        });
        toast(data.auditLogWarning, { icon: '!', duration: 6000 });
      } else {
        toast.success(data.message || 'Upload published');
      }
      if (user && typeof data.tokenBalance === 'number') {
        setUser({ ...user, tokenBalance: data.tokenBalance });
      }
      router.push('/dashboard/creator-hub/my-uploads');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!meta) return <div className="py-20 text-center text-slate-500 dark:text-slate-400">Loading...</div>;

  return (
    <CreatorHubShell>
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">Upload to Creator Hub</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Pick a package, add a title, attach a video, and publish.</p>
          </div>
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            Your balance: <strong>{user?.tokenBalance || 0} Tokens</strong>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-800 dark:text-slate-200">Package</label>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {Object.entries(meta.tiers).map(([key, value]) => {
              const durationMins = Math.round(value.maxDurationSec / 60);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTier(key)}
                  className={`rounded-2xl border p-4 text-left transition ${tier === key ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20 dark:bg-emerald-500/10' : 'border-slate-200 bg-white hover:border-emerald-400 dark:border-slate-800 dark:bg-slate-900'}`}
                >
                  <div className="font-bold">{value.label}</div>
                  <div className="mt-1 text-sm text-emerald-600 dark:text-emerald-300">{value.tokenCost} Tokens</div>
                  <div className="mt-1 text-xs text-slate-500">up to {value.maxSizeMB}MB - {durationMins} mins</div>
                </button>
              );
            })}
          </div>
          {tierConfig && !canAfford && (
            <p className="mt-2 text-xs text-red-500">You need {tierConfig.tokenCost - (user?.tokenBalance || 0)} more Tokens for this package.</p>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-800 dark:text-slate-200">Title ({title.length}/{meta.titleMaxChars})</label>
            <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, meta.titleMaxChars))} maxLength={meta.titleMaxChars} placeholder="A short, clear title" className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-900" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-800 dark:text-slate-200">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-900">
              <option value="">Select a category</option>
              {meta.categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-800 dark:text-slate-200">Description {tierConfig ? `(${description.length}/${tierConfig.maxDescriptionChars})` : ''}</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, tierConfig?.maxDescriptionChars || 500))} rows={5} className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-900" />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-800 dark:text-slate-200">Video file {tierConfig ? `(max ${tierConfig.maxSizeMB}MB, ${Math.round(tierConfig.maxDurationSec / 60)} mins)` : ''}</label>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500 transition hover:border-emerald-400 dark:border-slate-700 dark:bg-slate-900">
            <UploadCloud size={22} />
            <span>{file ? file.name : 'Click to choose a video'}</span>
            <input type="file" accept="video/mp4,video/quicktime,video/webm,video/x-matroska" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={isPremium} onChange={(e) => setIsPremium(e.target.checked)} />
            Make this a premium video
          </label>
          {isPremium && (
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Premium price (USD)</label>
                <input type="number" min={1} value={defaultPriceUSD} onChange={(e) => setDefaultPriceUSD(e.target.value)} className="w-36 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-900" />
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Contact phone" className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-900" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Contact email" className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-900" />
          <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="WhatsApp" className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-900" />
          <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Website / link" className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-900" />
        </div>

        <button onClick={handleSubmit} disabled={submitting || !canAfford} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">
          {submitting ? 'Publishing...' : `Publish (${tierConfig?.tokenCost || 0} Tokens)`}
        </button>
      </div>
    </CreatorHubShell>
  );
}
