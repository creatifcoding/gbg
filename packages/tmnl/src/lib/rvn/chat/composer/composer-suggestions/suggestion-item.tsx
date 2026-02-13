import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export interface RvnChatComposerSuggestionItemProps extends ComponentPropsWithoutRef<'button'> {
  active?: boolean
}

export const RvnChatComposerSuggestionItem = forwardRef<HTMLButtonElement, RvnChatComposerSuggestionItemProps>(
  ({ active = false, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      data-slot="rvn-chat-composer-suggestion-item"
      data-state={active ? 'active' : 'idle'}
      className={cn('rvn-chat__suggestion', className)}
      {...props}
    />
  ),
)

RvnChatComposerSuggestionItem.displayName = 'RvnChatComposer.Suggestions.Item'
