import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type ChatHeaderSubtitleSlotProps = ComponentPropsWithoutRef<'p'>

export const ChatHeaderSubtitleSlot = forwardRef<HTMLParagraphElement, ChatHeaderSubtitleSlotProps>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      data-slot="tmnl-chat-shell-header-subtitle"
      className={cn('font-mono text-neutral-500 truncate', className)}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      {...props}
    />
  ),
)

ChatHeaderSubtitleSlot.displayName = 'ChatShell.Header.Subtitle'
