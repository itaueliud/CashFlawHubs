'use client';
import { useAuthStore } from '@/store/authStore';
import { Lock, ExternalLink } from 'lucide-react';

export default function TasksPage() {
  const { user } = useAuthStore();
  if (!user?.activationStatus) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Lock size={48} className="text-slate-600 mb-4" />
        <h2 className="text-xl font-bold mb-2">Activation Required</h2>
        <a href="/dashboard/activate" className="btn-primary mt-2">Activate Now</a>
      </div>
    );
  }
  const providers = [
    { name: 'Microworkers', logo: '⚙️', desc: 'Data labeling, app testing, image tagging. Most tasks take 2–10 mins.', url: 'https://microworkers.com', badge: 'Recommended' },
    { name: 'Toloka', logo: '🔧', desc: 'AI training tasks, content moderation. High task volume.', url: 'https://toloka.ai', badge: 'High Volume' },
    { name: 'Hive Micro', logo: '🐝', desc: 'AI data tasks. Simple, quick, well-paying.', url: 'https://hivemicro.com', badge: 'Fast Pay' },
    { name: 'OTR', logo: '📝', desc: 'Online task runner — data entry and web research tasks.', url: 'https://www.onlinetaskrunner.com', badge: 'New' },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Microtasks</h1>
        <p className="text-slate-400 text-sm mt-1">Small tasks, fast rewards — $0.10 to $1 each</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {providers.map((p) => (
          <div key={p.name} className="card">
            <div className="flex items-start justify-between mb-3">
              <div className="text-3xl">{p.logo}</div>
              <span className="badge-blue">{p.badge}</span>
            </div>
            <h3 className="font-bold mb-1">{p.name}</h3>
            <p className="text-slate-400 text-sm mb-4">{p.desc}</p>
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm flex items-center gap-2 w-fit">
              Open Platform <ExternalLink size={14} />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
