/**
 * TMNL Label Components
 *
 * Typography primitives for CEW design system.
 */

import type { ReactNode } from 'react'
import { cn } from '../utils/cn'
import { TMNL_TOKENS, TMNL_FONT_SIZE } from '../tokens'

// =============================================================================
// LABEL
// =============================================================================

interface LabelProps {
  children: ReactNode
  className?: string
  size?: 'xs' | 'sm' | 'base'
}

export function Label({ children, className, size = 'xs' }: LabelProps) {
  return (
    <span
      className={cn(
        TMNL_TOKENS.typography.label,
        TMNL_TOKENS.text.tertiary,
        className
      )}
      style={{ fontSize: TMNL_FONT_SIZE[size] }}
    >
      {children}
    </span>
  )
}

// =============================================================================
// LABEL SMALL
// =============================================================================

export function LabelSmall({ children, className }: Omit<LabelProps, 'size'>) {
  return (
    <span
      className={cn(
        TMNL_TOKENS.typography.label,
        TMNL_TOKENS.text.muted,
        className
      )}
      style={{ fontSize: TMNL_FONT_SIZE.xs }}
    >
      {children}
    </span>
  )
}

// =============================================================================
// HEADING
// =============================================================================

interface HeadingProps {
  children: ReactNode
  className?: string
  level?: 1 | 2 | 3
}

export function Heading({ children, className, level = 2 }: HeadingProps) {
  const sizes = {
    1: TMNL_FONT_SIZE.lg,
    2: TMNL_FONT_SIZE.base,
    3: TMNL_FONT_SIZE.sm,
  }

  return (
    <span
      className={cn(
        TMNL_TOKENS.typography.label,
        TMNL_TOKENS.text.primary,
        className
      )}
      style={{ fontSize: sizes[level] }}
    >
      {children}
    </span>
  )
}

// =============================================================================
// BODY
// =============================================================================

interface BodyProps {
  children: ReactNode
  className?: string
  muted?: boolean
}

export function Body({ children, className, muted = false }: BodyProps) {
  return (
    <span
      className={cn(
        TMNL_TOKENS.typography.body,
        muted ? TMNL_TOKENS.text.muted : TMNL_TOKENS.text.secondary,
        className
      )}
      style={{ fontSize: TMNL_FONT_SIZE.sm }}
    >
      {children}
    </span>
  )
}

// =============================================================================
// ID (Monospace identifier display)
// =============================================================================

interface IDProps {
  children: ReactNode
  className?: string
}

export function ID({ children, className }: IDProps) {
  return (
    <code
      className={cn(
        TMNL_TOKENS.typography.mono,
        TMNL_TOKENS.text.muted,
        className
      )}
      style={{ fontSize: TMNL_FONT_SIZE.xs }}
    >
      {children}
    </code>
  )
}
