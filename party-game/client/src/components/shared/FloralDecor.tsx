'use client';

/**
 * Decorative floral / nature elements scattered around a page.
 * Renders absolutely-positioned emoji decorations.
 * Use `variant` to pick a preset layout; `compact` shrinks them for in-game use.
 */

interface FloralDecorProps {
  variant?: 'full' | 'compact';
}

interface Decor {
  emoji: string;
  className: string;
  style?: React.CSSProperties;
}

const FULL_DECORATIONS: Decor[] = [
  // Top area
  { emoji: '\u{1F33F}', className: 'absolute top-6 left-6 text-2xl opacity-40 animate-float', style: { animationDelay: '0s' } },
  { emoji: '\u{1F338}', className: 'absolute top-8 right-10 text-xl opacity-35 animate-float-slow', style: { animationDelay: '0.8s' } },
  { emoji: '\u{1F33B}', className: 'absolute top-14 left-1/4 text-lg opacity-30 animate-sway', style: { animationDelay: '0.3s' } },
  { emoji: '\u{1F98B}', className: 'absolute top-10 right-1/4 text-lg opacity-30 animate-float', style: { animationDelay: '1.2s' } },

  // Middle edges
  { emoji: '\u{1F41B}', className: 'absolute top-1/3 left-4 text-lg opacity-25 animate-float-slow', style: { animationDelay: '0.5s' } },
  { emoji: '\u{1F331}', className: 'absolute top-1/3 right-5 text-xl opacity-30 animate-sway', style: { animationDelay: '1s' } },
  { emoji: '\u{1F41E}', className: 'absolute top-1/2 left-8 text-lg opacity-25 animate-float', style: { animationDelay: '0.7s' } },
  { emoji: '\u{1F994}', className: 'absolute top-1/2 right-6 text-lg opacity-20 animate-float-slow', style: { animationDelay: '1.5s' } },

  // Bottom area
  { emoji: '\u{1F33E}', className: 'absolute bottom-1/4 left-6 text-xl opacity-30 animate-sway', style: { animationDelay: '0.4s' } },
  { emoji: '\u{1F338}', className: 'absolute bottom-1/4 right-8 text-lg opacity-25 animate-float', style: { animationDelay: '0.9s' } },
  { emoji: '\u{1F33F}', className: 'absolute bottom-10 left-10 text-xl opacity-35 animate-float-slow', style: { animationDelay: '0.2s' } },
  { emoji: '\u{1F33B}', className: 'absolute bottom-8 right-12 text-lg opacity-30 animate-sway', style: { animationDelay: '1.3s' } },
];

const COMPACT_DECORATIONS: Decor[] = [
  { emoji: '\u{1F33F}', className: 'absolute top-3 left-3 text-base opacity-30 animate-float', style: { animationDelay: '0s' } },
  { emoji: '\u{1F338}', className: 'absolute top-4 right-4 text-sm opacity-25 animate-float-slow', style: { animationDelay: '0.6s' } },
  { emoji: '\u{1F33B}', className: 'absolute bottom-4 left-4 text-sm opacity-25 animate-sway', style: { animationDelay: '0.3s' } },
  { emoji: '\u{1F98B}', className: 'absolute bottom-3 right-3 text-base opacity-30 animate-float', style: { animationDelay: '1s' } },
  { emoji: '\u{1F331}', className: 'absolute top-1/2 left-2 text-sm opacity-20 animate-float-slow', style: { animationDelay: '0.8s' } },
  { emoji: '\u{1F41E}', className: 'absolute top-1/2 right-2 text-sm opacity-20 animate-sway', style: { animationDelay: '1.2s' } },
];

export default function FloralDecor({ variant = 'full' }: FloralDecorProps) {
  const decorations = variant === 'full' ? FULL_DECORATIONS : COMPACT_DECORATIONS;

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-0" aria-hidden="true">
      {decorations.map((d, i) => (
        <span key={i} className={d.className} style={d.style}>
          {d.emoji}
        </span>
      ))}
    </div>
  );
}
