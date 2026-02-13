import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type RvnChatComposerTransportGroupProps = ComponentPropsWithoutRef<'div'>

export const RvnChatComposerTransportGroup = forwardRef<HTMLDivElement, RvnChatComposerTransportGroupProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="rvn-chat-composer-toolbar-transport-group"
      className={cn('rvn-chat__transport-group', className)}
      {...props}
    />
  ),
)

RvnChatComposerTransportGroup.displayName = 'RvnChatComposer.Toolbar.TransportGroup'
