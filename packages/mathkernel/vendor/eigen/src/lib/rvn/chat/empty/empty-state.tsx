import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export interface RvnChatEmptyStateProps extends ComponentPropsWithoutRef<'div'> {}

export const RvnChatEmptyState = forwardRef<HTMLDivElement, RvnChatEmptyStateProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="rvn-chat-empty-state"
      className={cn('rvn-chat__empty-state', className)}
      {...props}
    />
  ),
)

RvnChatEmptyState.displayName = 'RvnChatEmptyState'
