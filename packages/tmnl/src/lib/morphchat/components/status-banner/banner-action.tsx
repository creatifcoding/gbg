/**
 * Banner action button — compact, ghost-style inline action.
 *
 * @module morphchat/components/status-banner/banner-action
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface BannerActionProps {
  children: ReactNode
  onClick: (e: React.MouseEvent) => void
  title?: string
}

export function BannerAction({ children, onClick, title }: BannerActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        'inline-flex items-center gap-0.5 px-1.5 py-px rounded',
        'border border-white/10 hover:border-white/20',
        'text-neutral-300 hover:text-white',
        'transition-colors duration-100 active:scale-[0.97]',
        'font-mono',
      )}
      style={{
        fontSize: 'var(--tmnl-text-xs, 12px)',
        background: 'rgba(255,255,255,0.04)',
      }}
    >
      {children}
    </button>
  )
}
