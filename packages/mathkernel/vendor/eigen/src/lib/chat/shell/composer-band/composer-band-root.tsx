import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { CHAT_SHELL_SCROLL_CONTRACT, resolveChatShellComposerScrollStyle } from '../scroll-contract'

export type ChatComposerBandProps = ComponentPropsWithoutRef<'footer'>

export const ChatComposerBand = forwardRef<HTMLElement, ChatComposerBandProps>(
  ({ className, style, ...props }, ref) => (
    <footer
      ref={ref}
      data-slot="tmnl-chat-shell-composer-band"
      data-scroll-contract={CHAT_SHELL_SCROLL_CONTRACT.id}
      className={cn('border-t border-neutral-800/60', className)}
      style={resolveChatShellComposerScrollStyle(style)}
      {...props}
    />
  ),
)

ChatComposerBand.displayName = 'ChatShell.ComposerBand'
