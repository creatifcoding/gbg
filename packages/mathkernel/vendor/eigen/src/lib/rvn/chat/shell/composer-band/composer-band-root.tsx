import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { RVN_CHAT_SHELL_SCROLL_CONTRACT, resolveRvnChatShellComposerScrollStyle } from '../scroll-contract'

export type RvnChatComposerBandProps = ComponentPropsWithoutRef<'footer'>

export const RvnChatComposerBand = forwardRef<HTMLElement, RvnChatComposerBandProps>(
  ({ className, style, ...props }, ref) => (
    <footer
      ref={ref}
      data-slot="rvn-chat-shell-composer-band"
      data-scroll-contract={RVN_CHAT_SHELL_SCROLL_CONTRACT.id}
      className={cn('rvn-chat__composer', 'rvn-chat-shell__composer-band', className)}
      style={resolveRvnChatShellComposerScrollStyle(style)}
      {...props}
    />
  ),
)

RvnChatComposerBand.displayName = 'RvnChatShell.ComposerBand'
