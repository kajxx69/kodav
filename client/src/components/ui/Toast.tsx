import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { Toast as RadixToast } from 'radix-ui';
import { create } from 'zustand';
import { cn } from '~/lib/cn';

type ToastVariant = 'success' | 'error' | 'info';
type ToastItem = { id: number; title: string; description?: string; variant: ToastVariant };

type ToastState = {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, 'id'>) => void;
  dismiss: (id: number) => void;
};

let nextId = 1;
const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => set((s) => ({ toasts: [...s.toasts, { ...toast, id: nextId++ }] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Affiche une notification éphémère, utilisable hors composant. */
export function toast(
  title: string,
  options: { description?: string; variant?: ToastVariant } = {},
) {
  useToastStore.getState().push({ title, variant: options.variant ?? 'info', ...options });
}

const icons = { success: CircleCheck, error: CircleAlert, info: Info };
const accents = { success: 'text-success', error: 'text-danger', info: 'text-info' };

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <RadixToast.Provider swipeDirection="right" label="Notifications">
      {toasts.map((t) => {
        const Icon = icons[t.variant];
        return (
          <RadixToast.Root
            key={t.id}
            type={t.variant === 'error' ? 'foreground' : 'background'}
            onOpenChange={(open) => !open && dismiss(t.id)}
            className="flex items-start gap-3 rounded-lg border border-line bg-surface-raised p-4 shadow-lg data-[state=open]:animate-[slide-in-bottom_200ms_ease-out] data-[swipe=end]:animate-[fade-out_150ms_ease-in]"
          >
            <Icon className={cn('mt-0.5 size-5 shrink-0', accents[t.variant])} aria-hidden />
            <div className="flex-1">
              <RadixToast.Title className="text-label">{t.title}</RadixToast.Title>
              {t.description && (
                <RadixToast.Description className="mt-1 text-body-sm text-ink-muted">
                  {t.description}
                </RadixToast.Description>
              )}
            </div>
            <RadixToast.Close
              className="-m-1 rounded-md p-1 text-ink-muted hover:text-ink"
              aria-label="Fermer"
            >
              <X className="size-4" aria-hidden />
            </RadixToast.Close>
          </RadixToast.Root>
        );
      })}
      <RadixToast.Viewport className="fixed right-0 bottom-0 z-[60] flex w-full max-w-sm flex-col gap-3 p-4 outline-none" />
    </RadixToast.Provider>
  );
}
