import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';

const sections = [
  {
    title: 'Account responsibility',
    body: 'You are responsible for keeping your login details secure and for providing accurate information when you register and use the platform.',
  },
  {
    title: 'Acceptable use',
    body: 'Do not attempt to bypass platform safeguards, create fraudulent activity, or use the service in a way that violates local law or these terms.',
  },
  {
    title: 'Payments and withdrawals',
    body: 'Earnings, withdrawal availability, and payment timing depend on completed tasks, eligibility checks, and the supported payment methods in your country.',
  },
  {
    title: 'Data and security',
    body: 'Security and fraud monitoring information may be collected to protect users and the platform. Refer to the privacy notices and in-app disclosures for more detail.',
  },
  {
    title: 'Program changes',
    body: 'Features, earning opportunities, and reward rules can change as the platform grows. We may update these terms when needed.',
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Link href="/register" className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300">
          <ArrowLeft size={16} />
          Back to registration
        </Link>

        <section className="mt-6 rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/20 md:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">
            <ShieldCheck size={14} />
            Terms and Conditions
          </div>
          <h1 className="mt-5 text-3xl font-black md:text-5xl">Please read these terms before accepting them.</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300 md:text-base">
            These terms explain how CashFlowHubs works, what we expect from users, and how our earning and payment features should be used.
            When you register, you agree to follow these rules and any future updates we publish.
          </p>
        </section>

        <section className="mt-8 grid gap-4">
          {sections.map((section) => (
            <div key={section.title} className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <div className="flex items-center gap-2 font-semibold text-white">
                <CheckCircle2 size={16} className="text-emerald-400" />
                {section.title}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">{section.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6 md:p-8">
          <h2 className="text-xl font-bold text-white">Acceptance</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            To continue, return to the registration page and tick the acceptance box on the review step.
            If you do not agree with these terms, please stop using the registration flow.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/register" className="btn-primary">
              Return to registration
            </Link>
            <Link href="/about" className="btn-secondary">
              About CashFlowHubs
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
