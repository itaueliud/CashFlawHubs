'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { ArrowRight, Trophy, CalendarClock, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

export default function ChallengesPage() {
  const queryClient = useQueryClient();
  const { refreshUser } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['daily-challenges-page'],
    queryFn: () => api.get('/challenges/daily').then((response) => response.data.challenges),
    refetchInterval: 30000,
  });

  const claimMutation = useMutation({
    mutationFn: async (challengeId: string) => {
      const response = await api.post(`/challenges/${challengeId}/claim`);
      return response.data;
    },
    onSuccess: (payload) => {
      toast.success(payload.message || 'Challenge reward claimed');
      queryClient.invalidateQueries({ queryKey: ['daily-challenges-page'] });
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      refreshUser();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Unable to claim challenge reward');
    },
  });

  const challenges = data || [];
  const getChallengeTarget = (challenge: any) => {
    const type = String(challenge.type || challenge.eventType || '').toLowerCase();
    if (type.includes('referral')) return '/dashboard/referrals';
    if (type.includes('survey')) return '/dashboard/surveys';
    if (type.includes('task')) return '/dashboard/tasks';
    return '/dashboard';
  };

  return (
    <div className="space-y-6">
      <div className="card bg-gradient-to-r from-emerald-500/10 to-green-500/5 border-emerald-500/30">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-2">
              <Trophy size={22} className="text-emerald-400" /> Daily Challenges
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              Complete challenges, earn XP, and build momentum every day.
            </p>
          </div>
          <div className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-1.5 flex items-center gap-1.5 whitespace-nowrap">
            <CalendarClock size={13} /> Resets at midnight
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="card text-sm text-slate-400">Loading challenges...</div>
      ) : challenges.length === 0 ? (
        <div className="card text-sm text-slate-400">No daily challenges available right now. Check again shortly.</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {challenges.map((challenge: any) => {
            const progressPct = Math.min((challenge.progress / challenge.targetCount) * 100, 100);
            const canClaim = challenge.completed && !challenge.rewardClaimed;

            return (
              <div key={challenge._id} className={`card border-slate-700/80 relative transition-all hover:border-emerald-500/30 hover:bg-emerald-500/5 group ${challenge.resetDaily === false ? 'border-purple-500/20 bg-purple-500/5 hover:border-purple-500/50 hover:bg-purple-500/10' : ''}`}>
                <Link href={getChallengeTarget(challenge)} className="absolute inset-0 z-0 rounded-2xl" aria-label={`Go to ${challenge.title}`} />
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-base">{challenge.title}</h2>
                      {challenge.resetDaily === false && (
                        <span className="text-[10px] font-bold uppercase tracking-wide bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded-full">
                          Milestone
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{challenge.description}</p>
                  </div>
                  <div className="text-right">
                    {challenge.resetDaily === false && challenge.rewardUSD > 0 ? (
                      <div className="badge-green">${challenge.rewardUSD}</div>
                    ) : (
                      <div className="badge-blue">+{challenge.xpReward} XP</div>
                    )}
                    {challenge.resetDaily === false && <div className="text-xs text-emerald-400 mt-1">+{challenge.xpReward} XP</div>}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Progress</span>
                    <span>{challenge.progress}/{challenge.targetCount}</span>
                  </div>
                  <div className="bg-slate-700 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {challenge.rewardClaimed ? (
                      <div className="text-sm text-green-400 flex items-center gap-1.5">
                        <CheckCircle2 size={14} /> Reward claimed
                      </div>
                    ) : challenge.completed ? (
                      <span className="text-sm text-emerald-400">Completed. Claim your reward.</span>
                    ) : (
                      <span className="text-sm text-slate-400">Keep going to complete this challenge.</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 relative z-10">
                    {canClaim && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          claimMutation.mutate(challenge._id);
                        }}
                        disabled={claimMutation.isPending}
                        className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50"
                      >
                        Claim Reward
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
