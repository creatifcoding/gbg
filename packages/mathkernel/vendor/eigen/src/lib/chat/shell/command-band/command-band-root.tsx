import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type ChatCommandBandProps = ComponentPropsWithoutRef<'div'>

export const ChatCommandBand = forwardRef<HTMLDivElement, ChatCommandBandProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="tmnl-chat-shell-command-band"
      className={cn(
        'flex items-center gap-2 px-4 py-1.5',
        'border-b border-neutral-800/40',
        className,
      )}
      {...props}
    />
  ),
)

ChatCommandBand.displayName = 'ChatShell.CommandBand'
