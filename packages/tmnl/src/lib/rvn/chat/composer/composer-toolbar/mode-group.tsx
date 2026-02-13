import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type RvnChatComposerModeGroupProps = ComponentPropsWithoutRef<'div'>

export const RvnChatComposerModeGroup = forwardRef<HTMLDivElement, RvnChatComposerModeGroupProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="rvn-chat-composer-toolbar-mode-group"
      className={cn('rvn-chat__mode-group', className)}
      {...props}
    />
  ),
)

RvnChatComposerModeGroup.displayName = 'RvnChatComposer.Toolbar.ModeGroup'
