import React from 'react';

type Props = {
  sent?: boolean;
  className?: string;
};

export default function ApplicantEmailBadge({ sent = false, className = '' }: Props) {
  const base = sent
    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-400/20'
    : 'bg-amber-500/10 text-amber-300 border border-amber-400/20';

  return (
    <span className={`text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded-full ${base} ${className}`}>
      {sent ? 'Confirmation sent' : 'Confirmation pending'}
    </span>
  );
}
