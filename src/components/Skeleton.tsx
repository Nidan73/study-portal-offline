import React from 'react';

/**
 * Shape-matched loading placeholders.
 *
 * A centred spinner tells you "something is happening"; a skeleton tells you
 * what is about to arrive and stops the layout jumping when it does. The
 * shimmer is motion-safe only — under prefers-reduced-motion these settle to a
 * flat block rather than pulsing.
 */
export const SkeletonBar: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-black/[0.06] dark:bg-white/[0.07] rounded-full motion-safe:animate-pulse ${className}`} />
);

/** Placeholder rows for the curriculum / lesson lists. */
export const SkeletonList: React.FC<{ rows?: number; label?: string }> = ({ rows = 6, label = 'Loading lessons' }) => (
  <div className="space-y-2 p-1" role="status" aria-live="polite" aria-label={label}>
    <span className="sr-only">{label}…</span>
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        className="flex items-center gap-3 p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.06]"
        // Stagger so the block reads as a list rather than one flashing slab.
        style={{ animationDelay: `${i * 90}ms` }}
      >
        <SkeletonBar className="w-4 h-4 rounded-md flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <SkeletonBar className={`h-3 ${['w-3/4', 'w-2/3', 'w-5/6', 'w-1/2'][i % 4]}`} />
          <SkeletonBar className="h-2 w-1/4" />
        </div>
      </div>
    ))}
  </div>
);

/** Placeholder cards for the library grid. */
export const SkeletonCards: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" role="status" aria-live="polite" aria-label="Loading courses">
    <span className="sr-only">Loading courses…</span>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="p-1.5 rounded-[2rem] bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08]">
        <div className="p-6 rounded-[calc(2rem-0.375rem)] bg-white dark:bg-[#111218] border border-black/[0.05] dark:border-white/[0.06] space-y-4 min-h-[160px]">
          <SkeletonBar className="h-4 w-24" />
          <SkeletonBar className="h-4 w-3/4" />
          <SkeletonBar className="h-3 w-full" />
          <SkeletonBar className="h-3 w-2/3" />
        </div>
      </div>
    ))}
  </div>
);
