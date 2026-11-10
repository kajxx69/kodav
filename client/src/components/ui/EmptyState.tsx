import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '~/lib/cn';

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border border-dashed border-line px-6 py-12 text-center',
        className,
      )}
    >
      <span className="grid size-12 place-items-center rounded-full bg-surface-sunken text-ink-muted">
        <Icon className="size-6" aria-hidden />
      </span>
      <h3 className="text-h4">{title}</h3>
      {description && <p className="max-w-md text-body-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
