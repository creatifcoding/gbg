import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { ArrowUp, Pause, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ChatTransportVariant = 'send' | 'pause' | 'reconnect'

const VARIANT_STYLE: Record<ChatTransportVariant, string> = {
  send: 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border-cyan-500/30',
  pause: 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border-amber-500/30',
  reconnect: 'bg-neutral-500/10 text-neutral-400 hover:bg-neutral-500/20 border-neutral-500/30',
}

const VARIANT_ICON: Record<ChatTransportVariant, typeof ArrowUp> = {
  send: ArrowUp,
  pause: Pause,
  reconnect: RefreshCw,
}

export interface ChatTransportBtnProps extends ComponentPropsWithoutRef<'button'> {
  variant: ChatTransportVariant
}

export const ChatTransportBtn = forwardRef<HTMLButtonElement, ChatTransportBtnProps>(
  ({ variant, className, children, ...props }, ref) => {
    const Icon = VARIANT_ICON[variant]
    return (
      <button
        ref={ref}
        type="button"
        data-slot="tmnl-chat-transport-btn"
        data-variant={variant}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg',
          'font-mono uppercase tracking-wider border',
          'transition-colors duration-100',
          VARIANT_STYLE[variant],
          className,
        )}
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        {...props}
      >
        <Icon size={14} strokeWidth={2} />
        {children ?? variant}
      </button>
    )
  },
)

ChatTransportBtn.displayName = 'ChatTransportBtn'
