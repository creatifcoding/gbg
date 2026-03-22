import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { useChatHeaderBandContext } from './header-band-context'

export type ChatHeaderControlsProps = ComponentPropsWithoutRef<'div'>

export const ChatHeaderControls = forwardRef<HTMLDivElement, ChatHeaderControlsProps>(
  ({ className, ...props }, ref) => {
    useChatHeaderBandContext('ChatShell.Header.Controls')

    return (
      <div
        ref={ref}
        data-slot="tmnl-chat-shell-header-controls"
        data-semantic-compound="controls"
        className={cn('flex items-center gap-1.5', className)}
        {...props}
      />
    )
  },
)

ChatHeaderControls.displayName = 'ChatShell.Header.Controls'
