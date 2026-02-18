/**
 * Composer.Toolbar + Composer.ToolbarGroup + Composer.Divider
 *
 * Flex container for toolbar items. Hairline top border, TMNL spacing.
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { CHAT_TOKENS } from '../tokens'

// =============================================================================
// Toolbar
// =============================================================================

export interface ComposerToolbarProps {
  children: ReactNode
  className?: string
}

export function ComposerToolbar({ children, className }: ComposerToolbarProps) {
  const t = CHAT_TOKENS.toolbar

  return (
    <div
      data-slot="tmnl-composer-toolbar"
      className={cn(
        'flex items-center justify-between px-2 py-1.5 min-h-[36px]',
        t.border,
        t.gap,
        className,
      )}
    >
      {children}
    </div>
  )
}

ComposerToolbar.displayName = 'Composer.Toolbar'

// =============================================================================
// ToolbarGroup
// =============================================================================

export interface ComposerToolbarGroupProps {
  children: ReactNode
  className?: string
}

export function ComposerToolbarGroup({
  children,
  className,
}: ComposerToolbarGroupProps) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>{children}</div>
  )
}

ComposerToolbarGroup.displayName = 'Composer.ToolbarGroup'

// =============================================================================
// Divider
// =============================================================================

export function ComposerDivider() {
  return <div className="w-px h-4 bg-neutral-700" />
}

ComposerDivider.displayName = 'Composer.Divider'
