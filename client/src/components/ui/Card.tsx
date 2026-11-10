import type { ComponentProps } from 'react';
import { cn } from '~/lib/cn';

type CardProps = ComponentProps<'div'> & {
  /** Survol : légère élévation (cartes cliquables). */
  interactive?: boolean;
};

export function Card({ className, interactive, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-line bg-surface-raised p-6 shadow-sm',
        interactive &&
          'transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-field-border/40 hover:shadow-md motion-reduce:hover:translate-y-0',
        className,
      )}
      {...props}
    />
  );
}
