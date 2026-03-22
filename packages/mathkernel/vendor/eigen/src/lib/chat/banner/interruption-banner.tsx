import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ChatInterruptionBannerProps extends ComponentPropsWithoutRef<'div'> {
  severity?: 'info' | 'warn' | 'error'
}

const SEVERITY_STYLE: Record<string, string> = {
  info: 'border-neutral-700 text-neutral-400',
  warn: 'border-amber-500/40 text-amber-400',
  error: 'border-red-500/40 text-red-400',
}

export const ChatInterruptionBanner = forwardRef<HTMLDivElement, ChatInterruptionBannerProps>(
  ({ severity = 'warn', className, children, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="tmnl-chat-interruption-banner"
      data-severity={severity}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg',
        'font-mono border',
        SEVERITY_STYLE[severity] ?? SEVERITY_STYLE.warn,
        className,
      )}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      {...props}
    >
      <AlertTriangle size={14} strokeWidth={2} className="shrink-0" />
      <span className="flex-1">{children}</span>
    </div>
  ),
)

ChatInterruptionBanner.displayName = 'ChatInterruptionBanner'
