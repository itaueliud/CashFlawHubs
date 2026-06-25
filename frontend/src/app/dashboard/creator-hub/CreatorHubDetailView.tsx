'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { ArrowLeft, Bookmark, BookmarkCheck, Eye, Flame, Lock, MessageSquare, Smartphone, Wallet } from 'lucide-react';
import { CreatorUploadItem } from './types';
import CreatorHubShell from './CreatorHubShell';

export default function CreatorHubDetailView({ uploadId }: { uploadId?: string } = {}) {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = String(uploadId || params?.id || '');
  const { token, user, setUser, refreshUser } = useAuthStore();
  const [upload, setUpload] = useState<CreatorUploadItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [initiatingChat, setInitiatingChat] = useState(false);
  const [payMode, setPayMode] = useState<'choose' | 'mobile' | null>(null);
  const [purchaseReference, setPurchaseReference] = useState('');
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      router.push('/dashboard/creator-hub');
      return;
    }
    let cancelled = false;
    api.get(`/creator-hub/uploads/${id}`).then(({ data }) => {
      if (!cancelled) setUpload(data.upload);
    }).catch((error) => {
      toast.error(error?.response?.data?.message || 'Video not found');
      router.push('/dashboard/creator-hub');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [id, router]);

  useEffect(() => {
    if (!purchaseReference) return;
    const poll = window.setInterval(async () => {
      try {
        const { data } = await api.get(`/payments/verify/${encodeURIComponent(purchaseReference)}`);
        if (data?.status === 'successful' || data?.verified) {
          window.clearInterval(poll);
          if (pollRef.current) window.clearInterval(pollRef.current);
          pollRef.current = null;
          if (user && typeof data.tokenBalance === 'number') {
            setUser({ ...user, tokenBalance: data.tokenBalance });
          }
          if (typeof data.walletBalanceUSD === 'number' && user) {
            setUser({ ...user, balanceUSD: data.walletBalanceUSD });
          }
          toast.success('Payment received. Unlocking video...');
          await unlockWithWallet();
        }
      } catch {
        // keep polling
      }
    }, 4000);
    pollRef.current = poll;
    return () => {
      window.clearInterval(poll);
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [purchaseReference]);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  const apiOrigin = useMemo(() => api.defaults.baseURL?.replace(/\/api\/?$/, '') || '', []);
  const streamSrc = upload ? `${apiOrigin}${upload.streamUrl}?token=${encodeURIComponent(token || '')}` : '';
  const walletBalanceUSD = user?.balanceUSD || 0;
  const unlockPriceUSD = upload?.priceUSD || 0;
  const unlockPriceLocal = upload?.priceLocal || 0;

  const loadFreshUser = async () => {
    try {
      await refreshUser();
    } catch {
      // ignore
    }
  };

  const unlockWithWallet = async () => {
    if (!upload) return;
    setUnlocking(true);
    try {
      const { data } = await api.post(`/creator-hub/uploads/${upload._id}/unlock`);
      if (user && typeof data.walletBalanceUSD === 'number') {
        setUser({ ...user, balanceUSD: data.walletBalanceUSD });
      } else {
        await loadFreshUser();
      }
      toast.success('Video unlocked');
      setUpload((current) => current ? { ...current, isLocked: false } : current);
      setPayMode(null);
      setPurchaseReference('');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unlock failed');
    } finally {
      setUnlocking(false);
    }
  };

  const openPaywall = () => setPayMode('choose');

  const startMobileMoney = async () => {
    if (!upload) return;
    setUnlocking(true);
    try {
      const amountLocal = upload.priceLocal || upload.priceUSD;
      const { data } = await api.post('/payments/deposits/initiate', { amountLocal, phoneNumber: user?.phone || '' });
      setPurchaseReference(data.reference || '');
      setPayMode('mobile');
      toast.success(data.message || 'Payment started. Waiting for confirmation...');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not start payment');
    } finally {
      setUnlocking(false);
    }
  };

  const toggleSave = async () => {
    if (!upload) return;
    setSaving(true);
    try {
      if (upload.isSaved) {
        await api.delete(`/creator-hub/uploads/${upload._id}/save`);
        setUpload({ ...upload, isSaved: false });
        toast.success('Removed from saved');
        return;
      }
      const { data } = await api.post(`/creator-hub/uploads/${upload._id}/save`);
      if (data?.saved) {
        setUpload({ ...upload, isSaved: true });
        toast.success('Saved');
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not save this video');
    } finally {
      setSaving(false);
    }
  };

  const initiateCreatorChat = async () => {
    if (!upload) return;
    setInitiatingChat(true);
    try {
      const { data } = await api.post(`/chat/creator-hub/${upload._id}/initiate`);
      router.push(`/dashboard/chat?sessionId=${data.session._id}`);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not open chat');
    } finally {
      setInitiatingChat(false);
    }
  };
  if (loading || !upload) {
    return <div className="py-20 text-center text-slate-500">Loading...</div>;
  }

  return (
    <CreatorHubShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => router.push('/dashboard/creator-hub')} className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-emerald-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <ArrowLeft size={16} /> Back
          </button>
          <button onClick={toggleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-emerald-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 disabled:opacity-50">
            {upload.isSaved ? <BookmarkCheck size={16} className="text-emerald-600" /> : <Bookmark size={16} />}
            {upload.isSaved ? 'Saved' : 'Save'}
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-4">
            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950 shadow-xl dark:border-slate-800">
              {upload.isLocked ? (
                <div className="flex aspect-video flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-800 to-slate-950 text-white">
                  <Lock size={34} />
                  <div className="text-center">
                    <p className="text-lg font-bold">Premium video locked</p>
                    <p className="text-sm text-slate-300">${unlockPriceUSD.toFixed(2)} USD to unlock</p>
                    {unlockPriceLocal > 0 && (
                      <p className="mt-1 text-xs text-slate-400">or about {unlockPriceLocal.toFixed(2)} {upload.priceCurrency || 'local currency'} via mobile money</p>
                    )}
                  </div>
                  <button onClick={openPaywall} className="rounded-2xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600">
                    Unlock Video
                  </button>
                </div>
              ) : (
                <video src={streamSrc} controls playsInline crossOrigin="anonymous" preload="metadata" className="aspect-video w-full bg-black" />
              )}
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">{upload.badge || 'Creator'}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{upload.category.replace('_', ' ')}</span>
                    {upload.isPremium && <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">Premium</span>}
                  </div>
                  <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-900 dark:text-white">{upload.title}</h1>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">by {upload.creator?.name || 'Creator'}{upload.creator?.country ? ` Â· ${upload.creator.country}` : ''}</p>
                </div>
                <div className="flex gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800"><Eye size={12} /> {upload.views}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800"><Flame size={12} /> {upload.unlocks}</span>
                </div>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300">{upload.description}</p>
            </div>
          </div>

          <div className="space-y-4">
            {!upload.isOwner && (
              <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="font-bold text-slate-900 dark:text-white">Interested?</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Send a message directly to the creator about this video.
                </p>
                <button
                  onClick={initiateCreatorChat}
                  disabled={initiatingChat}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
                >
                  <MessageSquare size={16} />
                  {initiatingChat ? 'Opening chat...' : 'Message Creator'}
                </button>
              </div>
            )}

            {upload.isLocked && (
              <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="font-bold">Unlock options</h2>
                <div className="mt-3 space-y-3">
                  <button onClick={unlockWithWallet} disabled={walletBalanceUSD < unlockPriceUSD || unlocking} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700">
                    <Wallet size={20} />
                    <div>
                      <div className="font-semibold">Wallet</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Balance: ${walletBalanceUSD.toFixed(2)} USD</div>
                    </div>
                  </button>
                  <button onClick={startMobileMoney} disabled={unlocking} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700">
                    <Smartphone size={20} />
                    <div>
                      <div className="font-semibold">Mobile Money</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Top up {unlockPriceLocal > 0 ? `${unlockPriceLocal.toFixed(2)} ${upload.priceCurrency || 'local currency'}` : `about $${unlockPriceUSD.toFixed(2)}`}, then auto-unlock</div>
                    </div>
                  </button>
                  <button onClick={() => setPayMode(null)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-emerald-400 dark:border-slate-700 dark:text-slate-300">
                    Close
                  </button>
                </div>
              </div>
            )}

            {upload.isLocked && payMode === 'mobile' && (
              <div className="rounded-[24px] border border-emerald-500/20 bg-emerald-50 p-5 text-sm text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200">
                Waiting for payment confirmation. We will unlock the video automatically once the payment verifies.
                <div className="mt-2 text-xs opacity-80">Reference: {purchaseReference || 'pending'}</div>
              </div>
            )}
          </div>
        </div>

        {upload.isLocked && payMode === 'choose' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-[28px] bg-white p-5 shadow-2xl dark:bg-slate-900">
              <h3 className="text-lg font-bold">Choose how to pay</h3>
              <div className="mt-4 space-y-3">
                <button onClick={unlockWithWallet} disabled={walletBalanceUSD < unlockPriceUSD || unlocking} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 p-4 text-left disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700">
                  <Wallet size={20} />
                  <div>
                    <div className="font-semibold">Wallet (USD)</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Balance: ${walletBalanceUSD.toFixed(2)} USD</div>
                  </div>
                </button>
                <button onClick={startMobileMoney} disabled={unlocking} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 p-4 text-left disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700">
                  <Smartphone size={20} />
                  <div>
                    <div className="font-semibold">Mobile Money</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Pay the exact USD amount needed to unlock</div>
                  </div>
                </button>
                <button onClick={() => setPayMode(null)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium dark:border-slate-700">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </CreatorHubShell>
  );
}
