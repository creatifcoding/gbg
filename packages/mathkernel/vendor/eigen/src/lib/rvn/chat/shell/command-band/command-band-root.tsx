import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type RvnChatCommandBandProps = ComponentPropsWithoutRef<'div'>

export const RvnChatCommandBand = forwardRef<HTMLDivElement, RvnChatCommandBandProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="rvn-chat-shell-command-band"
      className={cn('rvn-chat__command-rail', 'rvn-chat-shell__command-band', className)}
      {...props}
    />
  ),
)

RvnChatCommandBand.displayName = 'RvnChatShell.CommandBand'
