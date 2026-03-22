import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type RvnChatComposerTransportRootProps = ComponentPropsWithoutRef<'div'>

export const RvnChatComposerTransportRoot = forwardRef<HTMLDivElement, RvnChatComposerTransportRootProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="rvn-chat-composer-transport"
      className={cn('rvn-chat__transport', className)}
      {...props}
    />
  ),
)

RvnChatComposerTransportRoot.displayName = 'RvnChatComposer.Transport.Root'
