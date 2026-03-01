/**
 * Composer.ActionButton
 *
 * Generic icon button for toolbar actions (attach, slash, etc.)
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { CHAT_TOKENS, COMPOSER_SIZING } from '../tokens'
import { useComposer } from './composer-context'

export interface ComposerActionButtonProps {
  icon: ReactNode
  title: string
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  className?: string
}

export function ComposerActionButton({
  icon,
  title,
  onClick,
  active,
  disabled,
  className,
}: ComposerActionButtonProps) {
  const { widthTier } = useComposer()
  const sizing = COMPOSER_SIZING[widthTier]
  const t = CHAT_TOKENS.button

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center justify-center',
        sizing.actionBtn,
        t.base,
        active ? t.active : t.idle,
        !active && !disabled && t.hover,
        disabled && t.disabled,
        className,
      )}
      title={title}
    >
      {icon}
    </button>
  )
}

ComposerActionButton.displayName = 'Composer.ActionButton'
