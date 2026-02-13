import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export interface RvnChatShellOverlayLayerProps extends ComponentPropsWithoutRef<'div'> {
  interactive?: boolean
  depth?: 'base' | 'elevated'
}

export const RvnChatShellOverlayLayer = forwardRef<HTMLDivElement, RvnChatShellOverlayLayerProps>(
  ({ interactive = false, depth = 'base', className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="rvn-chat-shell-overlay-layer"
      data-interactive={interactive || undefined}
      data-depth={depth}
      className={cn(
        'rvn-chat-shell__overlay-layer',
        depth === 'elevated' && 'rvn-chat-shell__overlay-layer--elevated',
        className,
      )}
      {...props}
    />
  ),
)

RvnChatShellOverlayLayer.displayName = 'RvnChatShell.OverlayLayer'
