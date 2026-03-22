import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export interface ChatFrameCornersProps extends ComponentPropsWithoutRef<'div'> {}

export const ChatFrameCorners = forwardRef<HTMLDivElement, ChatFrameCornersProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="tmnl-chat-frame-corners"
      className={cn(
        'absolute inset-0 pointer-events-none z-20',
        'border border-neutral-800/20 rounded-xl',
        className,
      )}
      {...props}
    />
  ),
)

ChatFrameCorners.displayName = 'ChatFrame.Corners'
