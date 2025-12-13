/**
 * TMNL Button Component
 *
 * CEW-styled button with multiple variants.
 */

import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../utils/cn'
import { TMNL_FONT_SIZE } from '../tokens'

// =============================================================================
// TYPES
// =============================================================================

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'tmnl' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

// =============================================================================
// VARIANTS
// =============================================================================

const variants = {
  primary: 'bg-white text-black border border-white hover:bg-neutral-200',
  ghost: 'bg-transparent text-neutral-500 hover:text-white hover:bg-neutral-900',
  tmnl: 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white',
  danger: 'bg-neutral-900 border border-red-900 text-red-400 hover:border-red-700 hover:text-red-300',
}

const sizes = {
  sm: 'px-2 py-1',
  md: 'px-3 py-1.5',
  lg: 'px-4 py-2',
}

// =============================================================================
// BUTTON
// =============================================================================

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'tmnl', size = 'md', children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'font-mono uppercase tracking-[0.15em] rounded transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variants[variant],
          sizes[size],
          className
        )}
        style={{ fontSize: TMNL_FONT_SIZE.xs }}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
