import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type RvnChatHeaderSubtitleSlotProps = ComponentPropsWithoutRef<'p'>

export const RvnChatHeaderSubtitleSlot = forwardRef<HTMLParagraphElement, RvnChatHeaderSubtitleSlotProps>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      data-slot="rvn-chat-shell-header-subtitle"
      className={cn('rvn-chat-shell__header-subtitle', className)}
      {...props}
    />
  ),
)

RvnChatHeaderSubtitleSlot.displayName = 'RvnChatShell.Header.Subtitle'
