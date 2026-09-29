import { useId } from 'react';

interface BrandLogoProps {
  className?: string;
  // Spin the record slowly (the sheen stays put, like light on a real record).
  spinning?: boolean;
}

// The HITS logo: the vinyl record from public/favicon.svg, drawn inline so the
// record itself can spin. The label carries a small print mark so the spin shows.
export function BrandLogo({ className, spinning = true }: BrandLogoProps) {
  // useId can contain ':' or '«»', which break url(#…) references.
  const id = `logo${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const bg = `${id}-bg`;
  const label = `${id}-label`;

  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="HITS">
      <defs>
        <linearGradient id={bg} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#ec4899" />
          <stop offset="0.5" stopColor="#9333ea" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
        <linearGradient id={label} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#f472b6" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${bg})`} />
      <g
        className={spinning ? 'animate-[spin_8s_linear_infinite]' : undefined}
        style={{ transformBox: 'view-box', transformOrigin: '32px 32px' }}
      >
        <circle cx="32" cy="32" r="27" fill="#0f0f14" />
        <g fill="none" stroke="#3a3a48" strokeWidth="0.8">
          <circle cx="32" cy="32" r="24" />
          <circle cx="32" cy="32" r="21" />
          <circle cx="32" cy="32" r="18" />
          <circle cx="32" cy="32" r="15" />
        </g>
        <circle cx="32" cy="32" r="10" fill={`url(#${label})`} />
        <path d="M26 28.5 A7 7 0 0 1 32 25" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity="0.85" />
        <circle cx="32" cy="32" r="2.5" fill="#0f0f14" />
      </g>
      <path
        d="M32 32 L14 11 A27 27 0 0 1 25 5.9 Z M32 32 L50 53 A27 27 0 0 1 39 58.1 Z"
        fill="#fff"
        opacity="0.14"
      />
    </svg>
  );
}
