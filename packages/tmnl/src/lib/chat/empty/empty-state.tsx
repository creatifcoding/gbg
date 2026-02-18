import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ChatEmptyStateProps extends ComponentPropsWithoutRef<'div'> {
  title?: string
  subtitle?: string
}

export const ChatEmptyState = forwardRef<HTMLDivElement, ChatEmptyStateProps>(
  ({
    title = 'No messages yet',
    subtitle = 'Start a conversation',
    className,
    children,
    ...props
  }, ref) => (
    <div
      ref={ref}
      data-slot="tmnl-chat-empty-state"
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-12',
        'text-center',
        className,
      )}
      {...props}
    >
      <MessageCircle size={32} className="text-neutral-700" strokeWidth={1.5} />
      <div>
        <p className="font-mono text-neutral-500" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
          {title}
        </p>
        <p className="font-mono text-neutral-700 mt-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {subtitle}
        </p>
      </div>
      {children}
    </div>
  ),
)

ChatEmptyState.displayName = 'ChatEmptyState'
