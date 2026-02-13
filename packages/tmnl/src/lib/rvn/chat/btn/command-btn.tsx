import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export interface RvnChatCommandBtnProps extends ComponentPropsWithoutRef<'button'> {
  active?: boolean
}

export const RvnChatCommandBtn = forwardRef<HTMLButtonElement, RvnChatCommandBtnProps>(
  ({ active = false, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      data-slot="rvn-chat-command-btn"
      data-state={active ? 'active' : 'idle'}
      className={cn('rvn-chat__command-chip', className)}
      {...props}
    />
  ),
)

RvnChatCommandBtn.displayName = 'RvnChatCommandBtn'
