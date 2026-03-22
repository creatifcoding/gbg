import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export interface RvnChatShellOrnamentLayerProps extends ComponentPropsWithoutRef<'div'> {
  variant?: 'trim' | 'corners'
}

export const RvnChatShellOrnamentLayer = forwardRef<HTMLDivElement, RvnChatShellOrnamentLayerProps>(
  ({ variant = 'trim', className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="rvn-chat-shell-ornament-layer"
      data-variant={variant}
      className={cn(
        'rvn-chat-shell__ornament-layer',
        variant === 'corners' && 'rvn-chat-shell__ornament-layer--corners',
        className,
      )}
      {...props}
    />
  ),
)

RvnChatShellOrnamentLayer.displayName = 'RvnChatShell.OrnamentLayer'
