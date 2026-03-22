import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { RvnChatHeaderBandContext } from './header-band-context'

export type RvnChatHeaderBandProps = ComponentPropsWithoutRef<'header'>

export const RvnChatHeaderBand = forwardRef<HTMLElement, RvnChatHeaderBandProps>(
  ({ className, children, ...props }, ref) => (
    <RvnChatHeaderBandContext.Provider value={{ semanticOwner: 'rvn-chat-shell-header-band' }}>
      <header
        ref={ref}
        data-slot="rvn-chat-shell-header-band"
        data-semantic-owner="rvn-chat-shell-header-band"
        className={cn('rvn-chat__header', 'rvn-chat-shell__header-band', className)}
        {...props}
      >
        {children}
      </header>
    </RvnChatHeaderBandContext.Provider>
  ),
)

RvnChatHeaderBand.displayName = 'RvnChatShell.HeaderBand'
