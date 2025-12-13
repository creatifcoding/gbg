/**
 * TMNL Card Component
 *
 * CEW-styled card container with compound components.
 */

import type { ReactNode, CSSProperties } from 'react'
import { cn } from '../utils/cn'
import { TMNL_TOKENS, TMNL_FONT_SIZE } from '../tokens'

// =============================================================================
// TYPES
// =============================================================================

interface CardRootProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

interface CardHeaderProps {
  children: ReactNode
  className?: string
}

interface CardTitleProps {
  children: ReactNode
  className?: string
}

interface CardBodyProps {
  children: ReactNode
  className?: string
}

interface CardFooterProps {
  children: ReactNode
  className?: string
}

// =============================================================================
// CARD ROOT
// =============================================================================

export function CardRoot({ children, className, style }: CardRootProps) {
  return (
    <div
      className={cn(
        'rounded border',
        TMNL_TOKENS.bg.secondary,
        TMNL_TOKENS.border.default,
        className
      )}
      style={style}
    >
      {children}
    </div>
  )
}

// =============================================================================
// CARD HEADER
// =============================================================================

export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-3 border-b',
        TMNL_TOKENS.border.default,
        className
      )}
    >
      {children}
    </div>
  )
}

// =============================================================================
// CARD TITLE
// =============================================================================

export function CardTitle({ children, className }: CardTitleProps) {
  return (
    <h3
      className={cn(
        TMNL_TOKENS.typography.label,
        TMNL_TOKENS.text.primary,
        className
      )}
      style={{ fontSize: TMNL_FONT_SIZE.sm }}
    >
      {children}
    </h3>
  )
}

// =============================================================================
// CARD BODY
// =============================================================================

export function CardBody({ children, className }: CardBodyProps) {
  return (
    <div className={cn('p-4', className)}>
      {children}
    </div>
  )
}

// =============================================================================
// CARD FOOTER
// =============================================================================

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-4 py-3 border-t',
        TMNL_TOKENS.border.default,
        className
      )}
    >
      {children}
    </div>
  )
}

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const Card = {
  Root: CardRoot,
  Header: CardHeader,
  Title: CardTitle,
  Body: CardBody,
  Footer: CardFooter,
}
