/**
 * TMNL Button Primitive
 *
 * Extracted from tmnl-ui.tsx for modular encapsulation.
 * Uses CSS custom properties from ScaleProvider.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'outline' | 'tmnl';
  size?: 'xs' | 'sm' | 'md' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    const variants = {
      primary: 'bg-white text-black border-white hover:bg-neutral-200',
      ghost:
        'bg-transparent text-neutral-500 hover:text-white hover:bg-neutral-900',
      danger: 'bg-red-600 text-white border-red-600 hover:bg-red-700',
      outline:
        'bg-transparent border-neutral-800 text-neutral-500 hover:bg-neutral-900 hover:border-white hover:text-white',
      tmnl: 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-800 hover:border-neutral-600 hover:text-white',
    };

    // Padding classes (no font size - that's in style)
    const sizeClasses = {
      xs: 'px-2 py-1',
      sm: 'px-3 py-1.5',
      md: 'px-4 py-2',
      icon: 'p-1.5 flex items-center justify-center',
    };

    // Font sizes and dimensions via CSS vars
    const sizeStyles: Record<string, React.CSSProperties> = {
      xs: {
        fontSize: 'calc(var(--tmnl-text-xs, 12px) * 0.8)',
        minHeight: 'var(--tmnl-size-button-xs, 24px)',
      },
      sm: {
        fontSize: 'calc(var(--tmnl-text-xs, 12px) * 0.9)',
        minHeight: 'var(--tmnl-size-button-sm, 28px)',
      },
      md: {
        fontSize: 'var(--tmnl-text-xs, 12px)',
        minHeight: 'var(--tmnl-size-button-md, 32px)',
      },
      icon: {
        width: 'var(--tmnl-size-button-sm, 28px)',
        height: 'var(--tmnl-size-button-sm, 28px)',
      },
    };

    return (
      <button
        ref={ref}
        className={cn(
          'font-mono uppercase tracking-[0.15em] border transition-all relative overflow-hidden',
          variants[variant],
          sizeClasses[size],
          className
        )}
        style={sizeStyles[size]}
        {...props}
      >
        <span className="relative z-10 flex items-center gap-1.5 justify-center">
          {children}
        </span>
      </button>
    );
  }
);

Button.displayName = 'Button';
