import { ChevronDown } from 'lucide-react';
import { useId, type ComponentProps, type ReactNode } from 'react';
import { cn } from '~/lib/cn';

const controlBase =
  'w-full rounded-md border border-field-border bg-surface-raised text-body text-ink placeholder:text-ink-muted/80 transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus focus-visible:shadow-sm disabled:cursor-not-allowed disabled:bg-surface-sunken aria-invalid:border-danger';

type FieldShellProps = {
  id: string;
  label: string;
  help?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

/** Libellé, aide et erreur reliés au champ (aria-describedby). */
function FieldShell({ id, label, help, error, required, className, children }: FieldShellProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="text-label text-ink">
        {label}
        {required && (
          <span className="text-danger" aria-hidden>
            {' '}
            *
          </span>
        )}
      </label>
      {children}
      {help && !error && (
        <p id={`${id}-help`} className="text-body-sm text-ink-muted">
          {help}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-body-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, help?: ReactNode, error?: string) {
  return (
    [error ? `${id}-error` : help ? `${id}-help` : null].filter(Boolean).join(' ') || undefined
  );
}

type CommonProps = {
  label: string;
  help?: ReactNode;
  error?: string;
  containerClassName?: string;
};

type TextFieldProps = ComponentProps<'input'> &
  CommonProps & {
    /** Préfixe affiché dans le champ, ex. « +225 ». */
    prefix?: string;
  };

export function TextField({
  label,
  help,
  error,
  prefix,
  containerClassName,
  className,
  id,
  required,
  ...props
}: TextFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell
      id={fieldId}
      label={label}
      help={help}
      error={error}
      required={required}
      className={containerClassName}
    >
      <div className="relative flex items-center">
        {prefix && (
          <span
            className="pointer-events-none absolute left-3 text-body text-ink-muted"
            aria-hidden
          >
            {prefix}
          </span>
        )}
        <input
          id={fieldId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(fieldId, help, error)}
          className={cn(controlBase, 'h-11 px-3', prefix && 'pl-14', className)}
          {...props}
        />
      </div>
    </FieldShell>
  );
}

export function TextArea({
  label,
  help,
  error,
  containerClassName,
  className,
  id,
  required,
  ...props
}: ComponentProps<'textarea'> & CommonProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell
      id={fieldId}
      label={label}
      help={help}
      error={error}
      required={required}
      className={containerClassName}
    >
      <textarea
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, help, error)}
        className={cn(controlBase, 'min-h-32 px-3 py-3', className)}
        {...props}
      />
    </FieldShell>
  );
}

type SelectFieldProps = ComponentProps<'select'> &
  CommonProps & {
    options: readonly { value: string; label: string }[];
    placeholder?: string;
  };

/** Liste native : la plus fiable sur mobile, stylée aux couleurs de la charte. */
export function SelectField({
  label,
  help,
  error,
  options,
  placeholder,
  containerClassName,
  className,
  id,
  required,
  ...props
}: SelectFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell
      id={fieldId}
      label={label}
      help={help}
      error={error}
      required={required}
      className={containerClassName}
    >
      <div className="relative">
        <select
          id={fieldId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(fieldId, help, error)}
          className={cn(controlBase, 'h-11 appearance-none pr-10 pl-3', className)}
          {...props}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-muted"
          aria-hidden
        />
      </div>
    </FieldShell>
  );
}

export function Checkbox({
  label,
  error,
  className,
  id,
  ...props
}: Omit<ComponentProps<'input'>, 'type'> & { label: ReactNode; error?: string }) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-start gap-3">
        <input
          id={fieldId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          className="mt-0.5 size-5 shrink-0 rounded-sm border-field-border accent-[var(--slate)]"
          {...props}
        />
        <label htmlFor={fieldId} className="text-body-sm text-ink">
          {label}
        </label>
      </div>
      {error && (
        <p id={`${fieldId}-error`} className="text-body-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
