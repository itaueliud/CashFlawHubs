import Image from 'next/image';
import Link from 'next/link';

type LogoVariant = 'full' | 'icon';
type LogoSize = 'sm' | 'md' | 'lg';

type LogoProps = {
  variant?: LogoVariant;
  size?: LogoSize;
  href?: string | null;
  className?: string;
};

const SIZE_MAP: Record<LogoVariant, Record<LogoSize, { width: number; height: number }>> = {
  icon: {
    sm: { width: 28, height: 28 },
    md: { width: 36, height: 36 },
    lg: { width: 48, height: 48 },
  },
  full: {
    sm: { width: 140, height: 44 },
    md: { width: 180, height: 56 },
    lg: { width: 260, height: 82 },
  },
};

export function Logo({ variant = 'full', size = 'md', href = '/', className = '' }: LogoProps) {
  const dims = SIZE_MAP[variant][size];
  const src = variant === 'icon' ? '/logo-icon.svg' : '/logo.svg';

  const image = (
    <Image
      src={src}
      alt="CashFlowHubs"
      width={dims.width}
      height={dims.height}
      priority
      className={`block object-contain ${className}`}
    />
  );

  if (!href) return image;

  return (
    <Link href={href} className="inline-flex shrink-0 items-center">
      {image}
    </Link>
  );
}
