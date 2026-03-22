import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export interface ChatCommandBtnProps extends ComponentPropsWithoutRef<'button'> {
  active?: boolean
}

export const ChatCommandBtn = forwardRef<HTMLButtonElement, ChatCommandBtnProps>(
  ({ active = false, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      data-slot="tmnl-chat-command-btn"
      data-state={active ? 'active' : 'idle'}
      className={cn(
        'px-2 py-0.5 rounded font-mono uppercase tracking-wider',
        'border transition-colors duration-100',
        active
          ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400'
          : 'border-neutral-800 text-neutral-500 hover:text-neutral-300 hover:border-neutral-600',
        className,
      )}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      {...props}
    />
  ),
)

ChatCommandBtn.displayName = 'ChatCommandBtn'
