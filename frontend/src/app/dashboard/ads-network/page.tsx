import Link from 'next/link';
import { Clock3 } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function AdsNetworkPage() {
  return (
    <div className="max-w-3xl space-y-5">
      <div className="card border-amber-500/30 bg-amber-500/5">
        <div className="flex items-start gap-3">
          <div className="mt-1 rounded-xl bg-amber-500/20 p-2 text-amber-300">
            <Clock3 size={18} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Create Hub Coming Soon</h1>
            <p className="mt-2 text-sm text-slate-300">
              This section is being prepared and will be available soon.
            </p>
            <p className="mt-2 text-xs text-slate-400">
              We will notify you here as soon as this module is available for your account.
            </p>
          </div>
        </div>
      </div>
      <Link href="/dashboard" className="btn-primary inline-flex">
        Back to Dashboard
      </Link>
    </div>
  );
}
