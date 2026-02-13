import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type RvnChatComposerPlaceholderProps = ComponentPropsWithoutRef<'div'>

export const RvnChatComposerPlaceholder = forwardRef<HTMLDivElement, RvnChatComposerPlaceholderProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="rvn-chat-composer-placeholder"
      className={cn('rvn-chat__composer-placeholder', className)}
      {...props}
    />
  ),
)

RvnChatComposerPlaceholder.displayName = 'RvnChatComposer.Input.Placeholder'
