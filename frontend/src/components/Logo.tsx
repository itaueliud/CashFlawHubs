import Link from 'next/link';

type LogoSize = 'sm' | 'md' | 'lg';

const SIZE_MAP: Record<LogoSize, { mark: number; title: string; subtitle: string }> = {
  sm: { mark: 30, title: 'text-base', subtitle: 'text-[9px]' },
  md: { mark: 40, title: 'text-lg', subtitle: 'text-[10px]' },
  lg: { mark: 52, title: 'text-2xl', subtitle: 'text-[11px]' },
};

export function Logo({ size = 'md', href = '/' }: { size?: LogoSize; href?: string }) {
  const config = SIZE_MAP[size];

  const content = (
    <div className="flex items-center gap-3 select-none">
      <svg width={config.mark} height={config.mark} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="20" cy="20" r="18" stroke="#f59e0b" strokeWidth="2.5" opacity="0.35" />
        <circle cx="20" cy="20" r="13" fill="#f59e0b" />
        <path d="M17 13.5C13.3 13.5 11 16.2 11 20C11 23.8 13.3 26.5 17 26.5" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <line x1="22" y1="14" x2="22" y2="26" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="27" y1="14" x2="27" y2="26" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="22" y1="20" x2="27" y2="20" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <div className="flex flex-col leading-none">
        <span className={`font-black tracking-tight text-white ${config.title}`}>
          CashFlow<span className="text-amber-400">Hubs</span>
        </span>
        {size !== 'sm' ? <span className={`mt-0.5 font-medium uppercase tracking-[0.25em] text-slate-500 ${config.subtitle}`}>Earn · Withdraw · Grow</span> : null}
      </div>
    </div>
  );

  if (!href) return content;

  return (
    <Link href={href} className="inline-flex">
      {content}
    </Link>
  );
}
