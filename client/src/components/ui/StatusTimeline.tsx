import { Check } from 'lucide-react';
import { cn } from '~/lib/cn';

export type TimelineStep = { key: string; label: string; date?: string; note?: string };

type StatusTimelineProps = {
  steps: readonly TimelineStep[];
  /** Index de l'étape en cours ; les précédentes sont terminées. */
  current: number;
  orientation?: 'vertical' | 'horizontal';
  className?: string;
};

/**
 * Suivi façon colis. L'étape en cours reprend le nœud du logo :
 * un anneau or autour d'un cœur bleu nuit.
 */
export function StatusTimeline({
  steps,
  current,
  orientation = 'vertical',
  className,
}: StatusTimelineProps) {
  const horizontal = orientation === 'horizontal';
  return (
    <ol
      className={cn(horizontal ? 'flex items-start' : 'flex flex-col', className)}
      aria-label="Suivi de la demande"
    >
      {steps.map((step, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'todo';
        const last = index === steps.length - 1;
        return (
          <li
            key={step.key}
            aria-current={state === 'current' ? 'step' : undefined}
            className={cn(
              'relative flex',
              horizontal ? 'flex-1 flex-col items-center text-center' : 'gap-4 pb-6 last:pb-0',
            )}
          >
            {!last && (
              <span
                aria-hidden
                className={cn(
                  'absolute',
                  horizontal
                    ? 'top-3 left-1/2 h-0.5 w-full'
                    : 'top-7 bottom-0 left-3 w-0.5 -translate-x-1/2',
                  state === 'done' ? 'bg-slate' : 'bg-line',
                )}
              />
            )}
            <span className="relative z-10 grid size-6 shrink-0 place-items-center" aria-hidden>
              {state === 'done' && (
                <span className="grid size-6 place-items-center rounded-full bg-slate text-on-band">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
              )}
              {state === 'current' && (
                <span className="grid size-6 place-items-center rounded-full border-[3px] border-gold bg-surface-raised">
                  <span className="size-2.5 rounded-full bg-navy dark:bg-on-band" />
                </span>
              )}
              {state === 'todo' && (
                <span className="size-6 rounded-full border-2 border-line bg-surface-raised" />
              )}
            </span>
            <div className={cn(horizontal ? 'mt-2 px-1' : 'pt-0.5')}>
              <p className={cn('text-label', state === 'todo' ? 'text-ink-muted' : 'text-ink')}>
                {step.label}
                <span className="sr-only">
                  {state === 'done'
                    ? ' : terminée'
                    : state === 'current'
                      ? ' : en cours'
                      : ' : à venir'}
                </span>
              </p>
              {step.date && <p className="text-caption text-ink-muted">{step.date}</p>}
              {step.note && !horizontal && (
                <p className="mt-1 text-body-sm text-ink-muted">{step.note}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
