import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type RvnChatComposerToolbarRootProps = ComponentPropsWithoutRef<'div'>

export const RvnChatComposerToolbarRoot = forwardRef<HTMLDivElement, RvnChatComposerToolbarRootProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="rvn-chat-composer-toolbar"
      className={cn('rvn-chat__toolbar', className)}
      {...props}
    />
  ),
)

RvnChatComposerToolbarRoot.displayName = 'RvnChatComposer.Toolbar.Root'
