import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type ChatHeaderTitleSlotProps = ComponentPropsWithoutRef<'h2'>

export const ChatHeaderTitleSlot = forwardRef<HTMLHeadingElement, ChatHeaderTitleSlotProps>(
  ({ className, ...props }, ref) => (
    <h2
      ref={ref}
      data-slot="tmnl-chat-shell-header-title"
      className={cn(
        'font-mono uppercase tracking-widest text-neutral-300 truncate',
        className,
      )}
      style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
      {...props}
    />
  ),
)

ChatHeaderTitleSlot.displayName = 'ChatShell.Header.Title'
