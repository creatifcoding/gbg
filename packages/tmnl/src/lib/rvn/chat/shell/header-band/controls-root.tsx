import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { useRvnChatHeaderBandContext } from './header-band-context'

export type RvnChatHeaderControlsProps = ComponentPropsWithoutRef<'div'>

export const RvnChatHeaderControls = forwardRef<HTMLDivElement, RvnChatHeaderControlsProps>(
  ({ className, ...props }, ref) => {
    useRvnChatHeaderBandContext('RvnChatShell.Header.Controls')

    return (
      <div
        ref={ref}
        data-slot="rvn-chat-shell-header-controls"
        data-semantic-compound="controls"
        className={cn('rvn-chat__controls', 'rvn-chat-shell__header-controls', className)}
        {...props}
      />
    )
  },
)

RvnChatHeaderControls.displayName = 'RvnChatShell.Header.Controls'
