import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '~/lib/cn';

type ModalProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export const overlayClass =
  'fixed inset-0 z-50 bg-navy/60 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_150ms_ease-out]';

export function Modal({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  className,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClass} />
        <Dialog.Content
          className={cn(
            'fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg border border-line bg-surface-raised p-6 shadow-lg',
            className,
          )}
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="text-h4">{title}</Dialog.Title>
            <Dialog.Close
              className="-m-2 rounded-md p-2 text-ink-muted hover:bg-surface-sunken hover:text-ink"
              aria-label="Fermer"
            >
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>
          {description && (
            <Dialog.Description className="text-body-sm text-ink-muted">
              {description}
            </Dialog.Description>
          )}
          {children}
          {footer && <div className="mt-2 flex flex-wrap justify-end gap-3">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
