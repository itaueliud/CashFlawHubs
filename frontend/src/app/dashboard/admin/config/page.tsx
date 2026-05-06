'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const DEFAULT_TOGGLES = [
  { key: 'payments.enabled', value: true, description: 'Enable payment flows' },
  { key: 'withdrawals.enabled', value: true, description: 'Enable withdrawals' },
  { key: 'maintenance.mode', value: false, description: 'Platform maintenance mode' },
  { key: 'risk.strict_mode', value: false, description: 'Strict fraud screening mode' },
];

export default function ConfigPage() {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, any>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['config-toggles'],
    queryFn: () => api.get('/admin-advanced/config/toggles').then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: ({ key, value, description }: { key: string; value: any; description: string }) => api.put(`/admin-advanced/config/toggles/${encodeURIComponent(key)}`, { value, description }),
    onSuccess: () => {
      toast.success('Config updated');
      queryClient.invalidateQueries({ queryKey: ['config-toggles'] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Failed to update config'),
  });

  const existing = data?.settings || [];
  const existingByKey = new Map(existing.map((item: any) => [item.key, item]));
  const rows = [...DEFAULT_TOGGLES.map((t) => existingByKey.get(t.key) || t), ...existing.filter((x: any) => !DEFAULT_TOGGLES.some((t) => t.key === x.key))];

  return (
    <div className="space-y-5">
      <div className="card"><h1 className="text-2xl font-bold text-white">Configuration Toggles</h1><p className="mt-1 text-sm text-slate-400">Manage runtime feature flags and operations controls.</p></div>

      {isLoading ? <div className="card text-sm text-slate-400">Loading config...</div> : (
        <div className="grid gap-3">
          {rows.map((row: any) => {
            const key = row.key;
            const currentValue = drafts[key] !== undefined ? drafts[key] : row.value;
            return (
              <div key={key} className="card flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-white">{key}</div>
                  <div className="text-xs text-slate-500">{row.description || 'No description'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <select className="input max-w-[130px]" value={String(currentValue)} onChange={(e) => {
                    const val = e.target.value === 'true' ? true : e.target.value === 'false' ? false : e.target.value;
                    setDrafts((d) => ({ ...d, [key]: val }));
                  }}>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                  <button className="btn-primary" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate({ key, value: currentValue, description: row.description || '' })}>Save</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
