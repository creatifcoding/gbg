import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type RvnChatComposerInsertGroupProps = ComponentPropsWithoutRef<'div'>

export const RvnChatComposerInsertGroup = forwardRef<HTMLDivElement, RvnChatComposerInsertGroupProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="rvn-chat-composer-toolbar-insert-group"
      className={cn('rvn-chat__insert-group', className)}
      {...props}
    />
  ),
)

RvnChatComposerInsertGroup.displayName = 'RvnChatComposer.Toolbar.InsertGroup'
