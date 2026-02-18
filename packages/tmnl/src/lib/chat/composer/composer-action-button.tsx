/**
 * Composer.ActionButton
 *
 * Generic icon button for toolbar actions (attach, slash, etc.)
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { CHAT_TOKENS } from '../tokens'

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
  const t = CHAT_TOKENS.button

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center justify-center w-7 h-7 rounded-md',
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
