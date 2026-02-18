import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export interface ChatShellOrnamentLayerProps extends ComponentPropsWithoutRef<'div'> {
  variant?: 'trim' | 'corners'
}

export const ChatShellOrnamentLayer = forwardRef<HTMLDivElement, ChatShellOrnamentLayerProps>(
  ({ variant = 'trim', className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="tmnl-chat-shell-ornament-layer"
      data-variant={variant}
      className={cn(
        'absolute inset-0 pointer-events-none z-30',
        variant === 'corners' && 'border border-neutral-800/30 rounded-xl',
        className,
      )}
      {...props}
    />
  ),
)

ChatShellOrnamentLayer.displayName = 'ChatShell.OrnamentLayer'
