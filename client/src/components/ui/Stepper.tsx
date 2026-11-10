import { Check } from 'lucide-react';
import { cn } from '~/lib/cn';

type StepperProps = {
  steps: readonly string[];
  /** Index de l'étape en cours (0 = première). */
  current: number;
  className?: string;
};

/** Progression d'un parcours par étapes (configurateur, diagnostic). */
export function Stepper({ steps, current, className }: StepperProps) {
  return (
    <ol className={cn('flex items-center gap-2', className)} aria-label="Progression">
      {steps.map((label, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'todo';
        return (
          <li
            key={label}
            className="flex flex-1 items-center gap-2 last:flex-none"
            aria-current={state === 'current' ? 'step' : undefined}
          >
            <span
              className={cn(
                'grid size-8 shrink-0 place-items-center rounded-full border-2 text-label',
                state === 'done' && 'border-slate bg-slate text-on-band',
                state === 'current' && 'border-gold bg-navy text-on-band',
                state === 'todo' && 'border-line text-ink-muted',
              )}
            >
              {state === 'done' ? <Check className="size-4" aria-hidden /> : index + 1}
            </span>
            <span
              className={cn(
                'hidden text-label sm:inline',
                state === 'todo' ? 'text-ink-muted' : 'text-ink',
              )}
            >
              {label}
              {state === 'done' && <span className="sr-only"> (terminée)</span>}
            </span>
            {index < steps.length - 1 && (
              <span
                className={cn(
                  'h-0.5 flex-1 rounded-full',
                  state === 'done' ? 'bg-slate' : 'bg-line',
                )}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
