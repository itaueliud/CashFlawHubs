'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle,
  Clock,
  Info,
  Loader2,
} from 'lucide-react';

export default function WalletPage() {
  const [withdrawing, setWithdrawing] = useState(false);
  const queryClient = useQueryClient();

  const { data: walletData } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => api.get('/wallet').then((response) => response.data.wallet),
    refetchInterval: 60000,
  });

  const { data: transactionData } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => api.get('/wallet/transactions?limit=30').then((response) => response.data.transactions),
  });

  const { register, handleSubmit, reset } = useForm<{ amountUSD: number; phoneNumber: string }>();
  const wallet = walletData || {};
  const transactions = transactionData || [];

  const onWithdraw = async (data: { amountUSD: number; phoneNumber: string }) => {
    setWithdrawing(true);

    try {
      const response = await api.post('/withdrawals/request', data);
      toast.success(
        `Withdrawal of ${response.data.amountLocal} ${response.data.currency} submitted. It will be included in Friday payout.`
      );
      reset();
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Withdrawal failed');
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black">Wallet</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card border-green-800/50 bg-gradient-to-br from-green-900/40 to-green-800/20">
          <div className="mb-1 text-xs text-slate-400">Available Balance</div>
          <div className="text-4xl font-black text-green-400">${(wallet.balanceUSD || 0).toFixed(2)}</div>
          <div className="mt-1 text-xs text-slate-500">
            {wallet.symbol}
            {wallet.balanceLocal} {wallet.currency}
          </div>
        </div>

        <div className="card border-yellow-500/30 bg-yellow-500/5">
          <div className="mb-1 flex items-center gap-1 text-xs text-yellow-400">
            <Clock size={11} />
            Pending Friday Payout
          </div>
          <div className="text-3xl font-black text-yellow-400">
            ${(wallet.pendingBalanceUSD || 0).toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {wallet.symbol}
            {wallet.pendingBalanceLocal} {wallet.currency}
          </div>
        </div>

        <div className="card">
          <div className="mb-1 text-xs text-slate-400">Total Earned</div>
          <div className="text-2xl font-black">${(wallet.totalEarned || 0).toFixed(2)}</div>
          <div className="mt-0.5 text-xs text-slate-500">All time</div>
        </div>
      </div>

      <div
        className={`card flex items-start gap-3 ${
          wallet.withdrawalOpen ? 'border-green-500/40 bg-green-500/5' : 'border-blue-500/30 bg-blue-500/5'
        }`}
      >
        {wallet.withdrawalOpen ? (
          <CheckCircle size={18} className="mt-0.5 flex-shrink-0 text-green-400" />
        ) : (
          <Info size={18} className="mt-0.5 flex-shrink-0 text-blue-400" />
        )}

        <div>
          <div className={`text-sm font-semibold ${wallet.withdrawalOpen ? 'text-green-400' : 'text-blue-400'}`}>
            {wallet.withdrawalOpen ? 'Payouts are processing today' : 'Friday payout system'}
          </div>
          <div className="mt-0.5 text-xs text-slate-400">
            {wallet.nextPayoutDate} {wallet.payoutNote ? `- ${wallet.payoutNote}` : ''}
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-3 font-bold">Earnings Breakdown</h3>
        <div className="space-y-2">
          {Object.entries(wallet.breakdown || {}).map(([key, value]: [string, any]) => (
            <div
              key={key}
              className="flex items-center justify-between border-b border-slate-700/50 py-1.5 last:border-0"
            >
              <span className="text-sm capitalize text-slate-400">{key}</span>
              <span className="text-sm font-semibold">${Number(value || 0).toFixed(4)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" id="withdraw">
        <h3 className="mb-4 font-bold">Withdraw Earnings</h3>
        <form onSubmit={handleSubmit(onWithdraw)} className="max-w-sm space-y-4">
          <div>
            <label className="mb-1.5 block text-sm text-slate-300">Amount (USD)</label>
            <input
              {...register('amountUSD', { required: true })}
              type="number"
              step="0.01"
              placeholder="e.g. 5.00"
              className="input"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-slate-300">Phone Number</label>
            <input
              {...register('phoneNumber')}
              placeholder="+254712345678"
              className="input"
            />
          </div>

          <button type="submit" disabled={withdrawing} className="btn-primary flex items-center gap-2">
            {withdrawing && <Loader2 size={16} className="animate-spin" />}
            Request Withdrawal
          </button>

          <p className="text-xs text-slate-500">
            Requests are queued for Friday payout processing.
          </p>
        </form>
      </div>

      <div className="card">
        <h3 className="mb-4 font-bold">Transaction History</h3>
        {transactions.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">No transactions yet. Start earning.</div>
        ) : (
          <div className="space-y-1">
            {transactions.map((tx: any) => (
              <div key={tx._id} className="flex items-center gap-3 border-b border-slate-700/50 py-2.5 last:border-0">
                <div
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                    tx.direction === 'credit'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {tx.direction === 'credit' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium capitalize">{tx.type.replace('_', ' ')}</div>
                  <div className="text-xs text-slate-500">
                    {new Date(tx.createdAt).toLocaleDateString()} - <span className="capitalize">{tx.status}</span>
                  </div>
                </div>

                <div
                  className={`flex-shrink-0 text-sm font-semibold ${
                    tx.direction === 'credit' ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {tx.direction === 'credit' ? '+' : '-'}${Number(tx.amountUSD || 0).toFixed(4)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
