'use client';

import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';
import { Save, AlertCircle, Search } from 'lucide-react';
import { ErrorBanner, LoadingSpinner, PageHeader } from '../../../components/ui';

interface ToggleSetting {
  _id: string;
  key: string;
  value: any;
  description?: string;
  type?: string;
}

export default function ConfigPage() {
  const [settings, setSettings] = useState<ToggleSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [changes, setChanges] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin-advanced/config/toggles');
      setSettings(response.data?.settings || response.data?.config || []);
      setError(null);
      setChanges({});
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load config toggles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const visibleSettings = useMemo(
    () =>
      settings.filter((setting) => {
        if (!search.trim()) return true;
        const term = search.toLowerCase();
        return setting.key.toLowerCase().includes(term) || String(setting.description || '').toLowerCase().includes(term);
      }),
    [search, settings]
  );

  const handleToggle = (key: string, currentValue: any) => {
    setChanges((prev) => ({
      ...prev,
      [key]: typeof currentValue === 'boolean' ? !currentValue : currentValue,
    }));
    setSuccess(null);
  };

  const handleChange = (key: string, value: any) => {
    setChanges((prev) => ({ ...prev, [key]: value }));
    setSuccess(null);
  };

  const handleSave = async () => {
    if (Object.keys(changes).length === 0) {
      setSuccess('No changes to save');
      return;
    }

    setSaving(true);
    try {
      await Promise.all(
        Object.entries(changes).map(([key, value]) =>
          api.put(`/admin-advanced/config/toggles/${encodeURIComponent(key)}`, { value })
        )
      );
      setSuccess('Configuration updated successfully');
      await loadSettings();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const modifiedCount = Object.keys(changes).length;

  return (
    <div className="space-y-6">
      <PageHeader title="System Configuration" description="Manage feature flags, toggles, and system settings." />

      {error && <ErrorBanner message={error} />}
      {success && <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300">{success}</div>}

      <section className="card-surface soft-up rounded-[24px] p-5">
        <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/5 px-4 py-3">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search configuration keys..."
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
          />
        </div>
      </section>

      <section className="card-surface soft-up overflow-hidden rounded-[24px]">
        {loading ? (
          <LoadingSpinner />
        ) : visibleSettings.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No configuration settings available.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {visibleSettings.map((setting) => {
              const value = changes[setting.key] !== undefined ? changes[setting.key] : setting.value;
              const isChanged = changes[setting.key] !== undefined;
              const isBool = typeof setting.value === 'boolean';

              return (
                <div key={setting._id} className={`p-5 ${isChanged ? 'bg-white/5' : ''}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="flex items-center gap-2 font-semibold text-white">
                        {setting.key}
                        {isChanged && <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">Modified</span>}
                      </h3>
                      {setting.description && <p className="mt-1 text-sm text-slate-400">{setting.description}</p>}
                    </div>

                    {isBool ? (
                      <button
                        onClick={() => handleToggle(setting.key, value)}
                        className={`ml-4 rounded-full px-4 py-2 font-semibold transition ${
                          value ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {value ? 'ON' : 'OFF'}
                      </button>
                    ) : (
                      <input
                        type="text"
                        value={String(value ?? '')}
                        onChange={(e) => handleChange(setting.key, e.target.value)}
                        className="ml-4 w-64 rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {modifiedCount > 0 && (
        <section className="card-surface soft-up flex flex-wrap gap-3 rounded-[24px] p-5">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> Save Changes ({modifiedCount})
          </button>
          <button
            onClick={() => setChanges({})}
            className="rounded-lg border border-white/8 px-4 py-2 font-semibold text-white hover:bg-white/5"
          >
            Reset
          </button>
          <div className="flex-1 text-right text-sm text-slate-400">{modifiedCount} setting(s) modified</div>
        </section>
      )}

      <section className="card-surface soft-up grid gap-4 rounded-[24px] p-5 sm:grid-cols-3">
        <div className="rounded-lg border border-white/8 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Total Settings</div>
          <div className="mt-2 text-2xl font-black text-white">{settings.length}</div>
        </div>
        <div className="rounded-lg border border-white/8 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Enabled</div>
          <div className="mt-2 text-2xl font-black text-green-300">{settings.filter((setting) => typeof setting.value === 'boolean' && setting.value).length}</div>
        </div>
        <div className="rounded-lg border border-white/8 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Modified</div>
          <div className="mt-2 text-2xl font-black text-amber-300">{modifiedCount}</div>
        </div>
      </section>
    </div>
  );
}
