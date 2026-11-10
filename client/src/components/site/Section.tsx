import type { ComponentProps, ReactNode } from 'react';
import { cn } from '~/lib/cn';

type SectionProps = ComponentProps<'section'> & {
  /** Section bleu nuit pleine largeur (fond band). */
  band?: boolean;
  sunken?: boolean;
};

export function Section({ band, sunken, className, children, ...props }: SectionProps) {
  return (
    <section
      className={cn(
        'py-12 sm:py-16',
        band && 'on-band bg-band text-on-band',
        sunken && 'bg-surface-sunken',
        className,
      )}
      {...props}
    >
      <div className="container-page">{children}</div>
    </section>
  );
}

type SectionHeaderProps = {
  overline?: string;
  title: ReactNode;
  lead?: ReactNode;
  band?: boolean;
  align?: 'left' | 'center';
  action?: ReactNode;
  as?: 'h1' | 'h2';
  id?: string;
};

export function SectionHeader({
  overline,
  title,
  lead,
  band,
  align = 'left',
  action,
  as: Heading = 'h2',
  id,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'mb-8 flex flex-col gap-4 sm:mb-10',
        align === 'center'
          ? 'items-center text-center'
          : 'sm:flex-row sm:items-end sm:justify-between',
      )}
    >
      <div className={cn('flex max-w-2xl flex-col gap-3', align === 'center' && 'items-center')}>
        {overline && (
          <p className={cn('text-overline', band ? 'text-gold' : 'text-gold-ink')}>{overline}</p>
        )}
        <Heading id={id} className={Heading === 'h1' ? 'text-h1' : 'text-h2'}>
          {title}
        </Heading>
        {lead && (
          <p className={cn('text-lead', band ? 'text-on-band-muted' : 'text-ink-muted')}>{lead}</p>
        )}
      </div>
      {action}
    </div>
  );
}
