import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type RvnChatComposerSuggestionsRootProps = ComponentPropsWithoutRef<'div'>

export const RvnChatComposerSuggestionsRoot = forwardRef<HTMLDivElement, RvnChatComposerSuggestionsRootProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="rvn-chat-composer-suggestions"
      className={cn('rvn-chat__suggestions', className)}
      {...props}
    />
  ),
)

RvnChatComposerSuggestionsRoot.displayName = 'RvnChatComposer.Suggestions.Root'
