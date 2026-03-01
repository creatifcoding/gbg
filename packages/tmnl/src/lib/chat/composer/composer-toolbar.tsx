/**
 * Composer.Toolbar + Composer.ToolbarGroup + Composer.Divider
 *
 * Flex container for toolbar items. Hairline top border, TMNL spacing.
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { CHAT_TOKENS, COMPOSER_SIZING } from '../tokens'
import { useComposer } from './composer-context'

// =============================================================================
// Toolbar
// =============================================================================

export interface ComposerToolbarProps {
  children: ReactNode
  className?: string
}

export function ComposerToolbar({ children, className }: ComposerToolbarProps) {
  const { widthTier } = useComposer()
  const sizing = COMPOSER_SIZING[widthTier]
  const t = CHAT_TOKENS.toolbar

  return (
    <div
      data-slot="tmnl-composer-toolbar"
      className={cn(
        'flex items-center justify-between',
        sizing.toolbar,
        t.border,
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
  const { widthTier } = useComposer()
  const sizing = COMPOSER_SIZING[widthTier]
  return (
    <div className={cn('flex items-center', sizing.toolbarGap, className)}>{children}</div>
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
