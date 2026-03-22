import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export interface RvnChatComposerCounterProps extends ComponentPropsWithoutRef<'span'> {
  current: number
  max?: number
}

export const RvnChatComposerCounter = forwardRef<HTMLSpanElement, RvnChatComposerCounterProps>(
  ({ current, max, className, ...props }, ref) => {
    const overLimit = typeof max === 'number' && current > max

    return (
      <span
        ref={ref}
        data-slot="rvn-chat-composer-counter"
        data-over-limit={overLimit || undefined}
        className={cn('rvn-chat__composer-counter', className)}
        {...props}
      >
        {typeof max === 'number' ? `${current}/${max}` : String(current)}
      </span>
    )
  },
)

RvnChatComposerCounter.displayName = 'RvnChatComposer.Input.Counter'
