import { cva, type VariantProps } from 'class-variance-authority';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '~/lib/cn';

const alertVariants = cva('flex gap-3 rounded-lg p-4 text-body-sm', {
  variants: {
    variant: {
      info: 'bg-info-soft text-ink [&>svg]:text-info',
      success: 'bg-success-soft text-ink [&>svg]:text-success',
      warning: 'bg-warning-soft text-ink [&>svg]:text-warning',
      danger: 'bg-danger-soft text-ink [&>svg]:text-danger',
    },
  },
  defaultVariants: { variant: 'info' },
});

const icons = { info: Info, success: CircleCheck, warning: TriangleAlert, danger: CircleAlert };

type AlertProps = VariantProps<typeof alertVariants> & {
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
};

/** Message dans la page ; les erreurs sont annoncées immédiatement aux lecteurs d'écran. */
export function Alert({ variant, title, children, action, className }: AlertProps) {
  const Icon = icons[variant ?? 'info'];
  return (
    <div
      role={variant === 'danger' ? 'alert' : 'status'}
      className={cn(alertVariants({ variant }), className)}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="flex flex-1 flex-col gap-1">
        {title && <p className="text-label text-ink">{title}</p>}
        {children && <div className="text-ink-muted">{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}
