import type { ComponentProps } from 'react';
import { cn } from '~/lib/cn';

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-md bg-surface-sunken', className)}
      {...props}
    />
  );
}

/** Grille de cartes en cours de chargement. */
export function CardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Chargement">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-lg border border-line bg-surface-raised p-6">
          <Skeleton className="mb-4 size-10" />
          <Skeleton className="mb-3 h-6 w-2/3" />
          <Skeleton className="mb-2 h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      ))}
    </div>
  );
}
