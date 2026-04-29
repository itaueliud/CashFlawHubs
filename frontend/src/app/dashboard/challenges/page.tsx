'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Trophy, CalendarClock, CheckCircle2 } from 'lucide-react';
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

  return (
    <div className="space-y-6">
      <div className="card bg-gradient-to-r from-amber-500/10 to-yellow-500/5 border-amber-500/30">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-2">
              <Trophy size={22} className="text-amber-400" /> Daily Challenges
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              Complete challenges, claim cash rewards, and stack XP every day.
            </p>
          </div>
          <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-1.5 flex items-center gap-1.5 whitespace-nowrap">
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
              <div key={challenge._id} className="card border-slate-700/80">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h2 className="font-semibold text-base">{challenge.title}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{challenge.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="badge-green">${challenge.rewardUSD}</div>
                    <div className="text-xs text-amber-400 mt-1">+{challenge.xpReward} XP</div>
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
                  {challenge.rewardClaimed ? (
                    <div className="text-sm text-green-400 flex items-center gap-1.5">
                      <CheckCircle2 size={14} /> Reward claimed
                    </div>
                  ) : challenge.completed ? (
                    <span className="text-sm text-amber-400">Completed. Claim your reward.</span>
                  ) : (
                    <span className="text-sm text-slate-400">Keep going to complete this challenge.</span>
                  )}

                  {canClaim && (
                    <button
                      onClick={() => claimMutation.mutate(challenge._id)}
                      disabled={claimMutation.isPending}
                      className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50"
                    >
                      Claim Reward
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
