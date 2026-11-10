import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '~/lib/cn';
import { overlayClass } from './Modal';

type DrawerProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: string;
  side?: 'left' | 'right' | 'bottom';
  children: ReactNode;
  className?: string;
};

const sides = {
  right:
    'inset-y-0 right-0 h-dvh w-[min(22rem,100vw)] border-l data-[state=open]:animate-[slide-in-right_200ms_ease-out]',
  left: 'inset-y-0 left-0 h-dvh w-[min(22rem,100vw)] border-r data-[state=open]:animate-[slide-in-left_200ms_ease-out]',
  bottom:
    'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-lg border-t data-[state=open]:animate-[slide-in-bottom_200ms_ease-out]',
};

export function Drawer({
  open,
  onOpenChange,
  trigger,
  title,
  side = 'right',
  children,
  className,
}: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClass} />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            'fixed z-50 flex flex-col border-line bg-surface-raised shadow-lg',
            sides[side],
            className,
          )}
        >
          <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
            <Dialog.Title className="text-h4">{title}</Dialog.Title>
            <Dialog.Close
              className="rounded-md p-2 text-ink-muted hover:bg-surface-sunken hover:text-ink"
              aria-label="Fermer"
            >
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const DrawerClose = Dialog.Close;
