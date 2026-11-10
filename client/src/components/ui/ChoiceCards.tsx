import { Check } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { cn } from '~/lib/cn';

export type Choice<T extends string> = {
  value: T;
  label: string;
  description?: ReactNode;
  aside?: ReactNode;
  disabled?: boolean;
};

type ChoiceCardsProps<T extends string> = {
  legend: string;
  /** Légende visible ou réservée aux lecteurs d'écran. */
  hideLegend?: boolean;
  choices: readonly Choice<T>[];
  columns?: 1 | 2 | 3;
} & (
  | { multiple?: false; value: T | undefined; onChange: (value: T) => void }
  | { multiple: true; value: readonly T[]; onChange: (value: T) => void }
);

/**
 * Choix en cartes, sur des boutons radio (ou cases à cocher) natifs : clavier, lecteurs
 * d'écran et formulaires fonctionnent sans code supplémentaire.
 */
export function ChoiceCards<T extends string>(props: ChoiceCardsProps<T>) {
  const { legend, hideLegend, choices, columns = 2, onChange } = props;
  const name = useId();
  const isChecked = (v: T) => (props.multiple ? props.value.includes(v) : props.value === v);
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className={cn('mb-3 text-label text-ink', hideLegend && 'sr-only')}>{legend}</legend>
      <div
        className={cn(
          'grid gap-3',
          columns === 2 && 'sm:grid-cols-2',
          columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
        )}
      >
        {choices.map((choice) => {
          const checked = isChecked(choice.value);
          return (
            <label
              key={choice.value}
              className={cn(
                'relative flex cursor-pointer gap-3 rounded-lg border bg-surface-raised p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus',
                checked
                  ? 'border-slate shadow-sm ring-1 ring-slate dark:border-link dark:ring-link'
                  : 'border-line hover:border-field-border',
                choice.disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              <input
                type={props.multiple ? 'checkbox' : 'radio'}
                name={name}
                value={choice.value}
                checked={checked}
                disabled={choice.disabled}
                onChange={() => onChange(choice.value)}
                className="sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  'mt-0.5 grid size-5 shrink-0 place-items-center border-2',
                  props.multiple ? 'rounded-sm' : 'rounded-full',
                  checked
                    ? 'border-slate bg-slate text-on-band dark:border-link dark:bg-link dark:text-surface'
                    : 'border-field-border',
                )}
              >
                {checked && <Check className="size-3.5" strokeWidth={3} />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-start justify-between gap-3">
                  <span className="text-label text-ink">{choice.label}</span>
                  {choice.aside && (
                    <span className="shrink-0 text-body-sm text-ink-muted">{choice.aside}</span>
                  )}
                </span>
                {choice.description && (
                  <span className="text-body-sm text-ink-muted">{choice.description}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
