'use client'

/**
 * Box — Generic container with className for custom Tailwind layout
 *
 * Use when VStack/HStack/Grid don't fit the layout need.
 * The agent expresses layout intent directly via Tailwind utility classes.
 *
 * @module layout/components/Box
 */

import { type ReactNode, type ElementType, memo } from 'react'

export interface BoxProps {
  /** Tailwind utility classes for layout */
  className?: string
  /** Semantic HTML element (default: div) */
  as?: 'div' | 'section' | 'article' | 'aside' | 'nav' | 'main' | 'header' | 'footer'
  /** Children */
  children?: ReactNode
}

/**
 * Box component — pure Tailwind layout container.
 *
 * Every prop except `as` is expressed via className.
 * This gives the agent full control over layout without
 * being constrained to predefined layout components.
 */
export const Box = memo(function Box({ className, as: Component = 'div', children }: BoxProps) {
  return <Component className={className || undefined}>{children}</Component>
})

Box.displayName = 'Box'
