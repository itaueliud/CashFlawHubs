'use client';
import { useAuthStore } from '@/store/authStore';
import { useForm } from 'react-hook-form';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Shield, Star } from 'lucide-react';

const LEVELS = ['Beginner','Active Worker','Power Earner','Expert','Master Earner','Champion','Legend','Icon'];

export default function ProfilePage() {
  const { user, refreshUser } = useAuthStore();
  const { register, handleSubmit } = useForm({ defaultValues: { name: user?.name || '', bio: '' } });
  const onSave = async (data: any) => {
    try { await api.put('/users/profile', data); await refreshUser(); toast.success('Profile updated!'); }
    catch { toast.error('Update failed'); }
  };
  const levelName = LEVELS[(user?.level || 1) - 1] || 'Beginner';
  const xpForNext = [100,300,600,1000,1500,2200,3000,5000][(user?.level || 1) - 1] || 100;
  const xpProgress = Math.min(((user?.xpPoints || 0) / xpForNext) * 100, 100);

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-black">My Profile</h1>
      <div className="card text-center">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center text-3xl font-black text-green-400 mx-auto mb-3">
          {user?.name?.[0]?.toUpperCase()}
        </div>
        <div className="font-bold text-lg">{user?.name}</div>
        <div className="text-slate-400 text-sm mt-0.5">{user?.phone} · {user?.country}</div>
        <div className="flex justify-center gap-2 mt-3 flex-wrap">
          <span className="badge-green">Level {user?.level} — {levelName}</span>
          <span className="badge-yellow">⚡ {user?.xpPoints} XP</span>
          <span className="badge bg-orange-500/20 text-orange-400">{user?.streak || 0}🔥 streak</span>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-400 mb-1"><span>XP Progress</span><span>{user?.xpPoints}/{xpForNext}</span></div>
          <div className="bg-slate-700 rounded-full h-2"><div className="bg-green-500 h-2 rounded-full transition-all" style={{width:`${xpProgress}%`}}/></div>
        </div>
      </div>
      <div className="card">
        <h3 className="font-bold mb-4">Edit Profile</h3>
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div><label className="text-sm text-slate-300 mb-1.5 block">Display Name</label><input {...register('name')} className="input"/></div>
          <div><label className="text-sm text-slate-300 mb-1.5 block">Bio</label><textarea {...register('bio')} rows={3} className="input resize-none" placeholder="Tell others about yourself..."/></div>
          <button type="submit" className="btn-primary">Save Changes</button>
        </form>
      </div>
      <div className="card">
        <h3 className="font-bold mb-3 flex items-center gap-2"><Star size={16} className="text-yellow-400"/> Badges</h3>
        {(user?.badges||[]).length===0
          ? <div className="text-slate-400 text-sm">Complete challenges to earn badges!</div>
          : <div className="flex gap-2 flex-wrap">{user?.badges.map((b:string)=><span key={b} className="badge-yellow">{b}</span>)}</div>}
      </div>
      <div className="card">
        <h3 className="font-bold mb-3 flex items-center gap-2"><Shield size={16} className="text-blue-400"/> Account Info</h3>
        <div className="space-y-2 text-sm">
          {[['Phone Verified', user?.phoneVerified?'✓ Yes':'✗ No', user?.phoneVerified?'text-green-400':'text-red-400'],
            ['Account Active', user?.activationStatus?'✓ Active':'⚠ Pending', user?.activationStatus?'text-green-400':'text-yellow-400'],
            ['User ID', user?.userId||'—', 'text-slate-300 font-mono text-xs'],
            ['Referral Code', user?.referralCode||'—', 'text-green-400 font-mono text-xs']].map(([k,v,c])=>(
            <div key={k as string} className="flex justify-between items-center py-1 border-b border-slate-700/50 last:border-0">
              <span className="text-slate-400">{k}</span><span className={c as string}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
