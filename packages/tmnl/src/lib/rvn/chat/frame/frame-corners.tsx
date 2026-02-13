import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export interface RvnChatFrameCornersProps extends ComponentPropsWithoutRef<'div'> {}

export const RvnChatFrameCorners = forwardRef<HTMLDivElement, RvnChatFrameCornersProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="rvn-chat-frame-corners"
      className={cn('rvn-chat__corners', className)}
      {...props}
    />
  ),
)

RvnChatFrameCorners.displayName = 'RvnChatFrame.Corners'
