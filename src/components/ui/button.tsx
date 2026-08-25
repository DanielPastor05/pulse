'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useT } from '@/i18n/provider';

const buttonVariants = cva(
  [
    'relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium',
    'select-none outline-none',
    // Transform, colour and shadow — the glow is a box-shadow, so it composites
    // alongside the colour change instead of triggering layout.
    'transition-[transform,background-color,border-color,color,box-shadow] duration-200 ease-[var(--ease-out)]',
    // Press feedback: the interface confirms it heard you before work starts.
    'active:scale-[0.97]',
    'disabled:pointer-events-none disabled:opacity-45',
    '[&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--accent)] text-[var(--on-accent)] font-semibold shadow-[0_0_10px_var(--accent-glow)] hover:bg-[var(--accent-hover)] hover:shadow-[0_0_18px_var(--accent-glow)]',
        secondary:
          'border border-[var(--hairline)] bg-[var(--surface-raised)] text-[var(--text-1)] hover:border-[var(--accent-line)] hover:bg-[var(--surface-hover)]',
        ghost: 'text-[var(--text-2)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]',
        outline:
          'border border-dashed border-[var(--accent-line)] text-[var(--accent)] hover:bg-[var(--accent-quiet)] hover:shadow-[0_0_10px_var(--accent-glow)]',
        danger: 'bg-[var(--danger)] text-black font-semibold hover:brightness-110',
        link: 'text-[var(--accent)] underline underline-offset-[3px] decoration-1 hover:[text-shadow:0_0_10px_var(--accent-glow)]',
      },
      size: {
        sm: 'h-8 rounded-[var(--radius-control)] px-3 text-[12.5px] [&_svg]:size-4',
        md: 'h-9 rounded-[var(--radius-field)] px-3.5 text-[13.5px] [&_svg]:size-4',
        lg: 'h-11 rounded-[var(--radius-field)] px-5 text-[15px] [&_svg]:size-[18px]',
        /*
         * Los botones de icono crecen donde se tocan con el dedo.
         *
         * 36 y 32 píxeles están bien para un ratón, que apunta a un píxel, y
         * mal para un pulgar: la recomendación de toque es 44. En un móvil
         * había que apuntar a botones de un tercio de centímetro, y eso es
         * parte de «adaptar mejor la app a móvil».
         *
         * Condicionado al puntero y no al ancho: un portátil táctil con ratón
         * conserva la densidad de escritorio, y una tableta sin ratón la gana
         * aunque tenga pantalla grande.
         */
        icon: 'size-9 [@media(hover:none)]:size-11 rounded-[var(--radius-field)] [&_svg]:size-[18px]',
        'icon-sm':
          'size-8 [@media(hover:none)]:size-11 rounded-[var(--radius-control)] [&_svg]:size-4',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', block: false },
  },
);

export type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const t = useT();
  const Comp = asChild ? Slot : 'button';
  const isIconOnly = size === 'icon' || size === 'icon-sm';

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {/* `Slot` requires exactly one child, so `asChild` passes it through
          untouched — link-style buttons never carry a loading state anyway. */}
      {asChild ? (
        children
      ) : (
        <>
          {loading ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
          {loading && isIconOnly ? <span className="sr-only">{t.common.working}</span> : children}
        </>
      )}
    </Comp>
  );
}

export { buttonVariants };
