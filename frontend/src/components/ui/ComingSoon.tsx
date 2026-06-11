import { Bell, Clock } from 'lucide-react';

type Props = {
  module: string;
  description?: string;
};

export function ComingSoon({ module, description }: Props) {
  return (
    <div className="mx-auto max-w-3xl rounded-[2rem] border border-slate-800 bg-slate-950/95 p-8 text-white shadow-2xl shadow-black/40">
      <div className="mb-8 flex flex-col gap-6 rounded-[2rem] border border-slate-800 bg-slate-900/80 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Coming Soon</p>
          <h1 className="mt-3 text-4xl font-black text-white">{module}</h1>
        </div>
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-800/90 text-emerald-400">
          <Clock size={28} />
        </div>
      </div>

      <div className="mb-6 rounded-[1.75rem] border border-slate-800 bg-slate-900/80 p-6">
        <div className="flex items-center gap-3 text-slate-300">
          <Bell className="text-amber-300" size={20} />
          <p className="text-sm font-semibold">We&apos;re working on it</p>
        </div>
        <p className="mt-4 text-sm leading-7 text-slate-400">
          {module} is currently under development and will be available soon. Stay tuned for updates.
        </p>
      </div>

      {description ? (
        <div className="mb-6 rounded-[1.75rem] border border-slate-800 bg-slate-900/80 p-6 text-slate-300">
          {description}
        </div>
      ) : null}

      <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900/80 p-6 text-slate-400">
        <p className="text-sm">🚧 Module launching soon — check back later.</p>
      </div>
    </div>
  );
}
