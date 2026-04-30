'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { CheckCircle, Loader2, Phone, Shield } from 'lucide-react';

const FEE_MAP: Record<string, string> = { KE:'500 KES', UG:'16,650 UGX', TZ:'11,500 TZS', ET:'2,250 ETB', GH:'GH₵18', NG:'₦6,500' };

export default function ActivatePage() {
  const { user, refreshUser } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [paymentPhone, setPaymentPhone] = useState(user?.phone || '');
  useEffect(() => {
    if (user?.phone) {
      setPaymentPhone((current) => current || user.phone);
    }
  }, [user?.phone]);
  if (user?.activationStatus) { router.push('/dashboard'); return null; }
  const fee = FEE_MAP[user?.country || 'KE'] || '500 KES';

  const handleActivate = async () => {
    if (!paymentPhone.trim()) {
      toast.error('Enter the number you want to use for activation payment.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/payments/initiate-activation', { phoneNumber: paymentPhone.trim() });
      if (res.data.paymentLink) { window.location.href = res.data.paymentLink; }
      else { toast.success('STK Push sent! Complete payment on your phone.'); setTimeout(() => { refreshUser(); router.push('/dashboard'); }, 6000); }
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed to initiate payment'); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div><h1 className="text-2xl font-black">Activate Your Account</h1><p className="text-slate-400 text-sm mt-1">One-time fee to unlock all earning features</p></div>
      <div className="card border-green-500/30 bg-green-500/5 text-center py-6">
        <div className="text-5xl font-black text-green-400 mb-1">{fee}</div>
        <div className="text-slate-400 text-sm">One-time activation fee</div>
      </div>
      <div className="card">
        <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
          <Phone size={16} className="text-green-400" /> Payment Number
        </label>
        <input
          value={paymentPhone}
          onChange={(event) => setPaymentPhone(event.target.value)}
          placeholder="+254712345678"
          className="input"
        />
        <p className="mt-2 text-sm text-slate-400">Users can enter a different number here for the activation payment prompt.</p>
      </div>
      <div className="card">
        <h3 className="font-bold mb-3">What You Unlock</h3>
        <div className="space-y-2">
          {['Paid Surveys (up to $3 each)','Microtasks & Offerwalls','Freelance Gig posting','Referral rewards — 200 KES per referral','Daily challenges & XP bonuses','All withdrawal methods'].map(f => (
            <div key={f} className="flex items-center gap-2 text-sm"><CheckCircle size={16} className="text-green-400 flex-shrink-0"/>{f}</div>
          ))}
        </div>
      </div>
      <div className="card bg-blue-500/10 border-blue-500/30">
        <div className="flex items-start gap-3">
          <Shield size={20} className="text-blue-400 flex-shrink-0 mt-0.5"/>
          <p className="text-sm text-slate-300">The one-time activation fee covers your secure account verification and unlocks access to our full marketplace of paid tasks. While you can earn promotional bonuses by inviting friends, the primary way to grow your balance is by completing surveys, ads, and digital missions.</p>
        </div>
      </div>
      <button onClick={handleActivate} disabled={loading} className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2">
        {loading && <Loader2 size={20} className="animate-spin"/>} Pay {fee} & Activate
      </button>
    </div>
  );
}
