/**
 * TMNL Input Component
 *
 * CEW-styled form input.
 */

import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../utils/cn'
import { TMNL_FONT_SIZE, TMNL_TOKENS } from '../tokens'

// =============================================================================
// TYPES
// =============================================================================

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'ghost'
}

// =============================================================================
// INPUT
// =============================================================================

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variantStyles = {
      default: cn(
        TMNL_TOKENS.bg.elevated,
        'border',
        TMNL_TOKENS.border.default,
        'focus:border-neutral-600'
      ),
      ghost: cn(
        'bg-transparent',
        'border-b',
        TMNL_TOKENS.border.default,
        'focus:border-neutral-600',
        'rounded-none'
      ),
    }

    return (
      <input
        ref={ref}
        className={cn(
          'w-full px-3 py-2 rounded',
          TMNL_TOKENS.typography.mono,
          TMNL_TOKENS.text.primary,
          'placeholder:text-neutral-600',
          'outline-none transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variantStyles[variant],
          className
        )}
        style={{ fontSize: TMNL_FONT_SIZE.sm }}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

// =============================================================================
// TEXTAREA
// =============================================================================

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: 'default' | 'ghost'
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variantStyles = {
      default: cn(
        TMNL_TOKENS.bg.elevated,
        'border',
        TMNL_TOKENS.border.default,
        'focus:border-neutral-600'
      ),
      ghost: cn(
        'bg-transparent',
        'border',
        TMNL_TOKENS.border.default,
        'focus:border-neutral-600'
      ),
    }

    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full px-3 py-2 rounded resize-none',
          TMNL_TOKENS.typography.mono,
          TMNL_TOKENS.text.primary,
          'placeholder:text-neutral-600',
          'outline-none transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variantStyles[variant],
          className
        )}
        style={{ fontSize: TMNL_FONT_SIZE.sm }}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'
