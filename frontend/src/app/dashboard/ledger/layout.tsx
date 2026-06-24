import type { ReactNode } from 'react';

export default function LedgerLayout({ children }: { children: ReactNode }) {
  return <div className="ledger-scope min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">{children}</div>;
}
