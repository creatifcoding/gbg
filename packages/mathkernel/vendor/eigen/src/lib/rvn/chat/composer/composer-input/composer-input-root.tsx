import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type RvnChatComposerInputRootProps = ComponentPropsWithoutRef<'div'>

export const RvnChatComposerInputRoot = forwardRef<HTMLDivElement, RvnChatComposerInputRootProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="rvn-chat-composer-input-root"
      className={cn('rvn-chat__composer-input-wrap', className)}
      {...props}
    />
  ),
)

RvnChatComposerInputRoot.displayName = 'RvnChatComposer.Input.Root'
