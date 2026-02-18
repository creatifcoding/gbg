import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { ChatHeaderBandContext } from './header-band-context'

export type ChatHeaderBandProps = ComponentPropsWithoutRef<'header'>

export const ChatHeaderBandRoot = forwardRef<HTMLElement, ChatHeaderBandProps>(
  ({ className, children, ...props }, ref) => (
    <ChatHeaderBandContext.Provider value={{ semanticOwner: 'tmnl-chat-shell-header-band' }}>
      <header
        ref={ref}
        data-slot="tmnl-chat-shell-header-band"
        data-semantic-owner="tmnl-chat-shell-header-band"
        className={cn(
          'flex items-center justify-between gap-3 px-4 py-2',
          'border-b border-neutral-800/60',
          'font-mono',
          className,
        )}
        {...props}
      >
        {children}
      </header>
    </ChatHeaderBandContext.Provider>
  ),
)

ChatHeaderBandRoot.displayName = 'ChatShell.HeaderBand'
