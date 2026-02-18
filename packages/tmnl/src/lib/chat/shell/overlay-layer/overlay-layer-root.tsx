import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export interface ChatShellOverlayLayerProps extends ComponentPropsWithoutRef<'div'> {
  interactive?: boolean
  depth?: 'base' | 'elevated'
}

export const ChatShellOverlayLayer = forwardRef<HTMLDivElement, ChatShellOverlayLayerProps>(
  ({ interactive = false, depth = 'base', className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="tmnl-chat-shell-overlay-layer"
      data-interactive={interactive || undefined}
      data-depth={depth}
      className={cn(
        'absolute inset-0 z-40',
        interactive ? 'pointer-events-auto' : 'pointer-events-none',
        depth === 'elevated' && 'z-50',
        className,
      )}
      {...props}
    />
  ),
)

ChatShellOverlayLayer.displayName = 'ChatShell.OverlayLayer'
