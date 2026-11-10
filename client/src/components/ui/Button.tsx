import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Slot } from 'radix-ui';
import { cn } from '~/lib/cn';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-label whitespace-nowrap transition-colors duration-150 select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      // L'or est réservé au bouton principal : une seule fois par écran.
      variant: {
        primary: 'bg-gold text-on-gold hover:bg-gold-hover active:bg-gold-hover shadow-sm',
        secondary: 'bg-secondary text-on-secondary hover:bg-secondary-hover',
        outline: 'border border-field-border text-ink hover:bg-surface-sunken',
        ghost: 'text-ink hover:bg-surface-sunken',
        'outline-band': 'border border-on-band-muted text-on-band hover:bg-slate',
        'ghost-band': 'text-on-band hover:bg-slate',
      },
      size: {
        sm: 'h-9 px-3',
        md: 'h-11 px-4',
        lg: 'h-12 px-6 text-body font-semibold',
        icon: 'size-11 p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** Rend l'enfant (ex. <Link>) avec le style du bouton. */
    asChild?: boolean;
    loading?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <LoaderCircle className="animate-spin" aria-hidden />}
          {children}
        </>
      )}
    </Comp>
  );
}
