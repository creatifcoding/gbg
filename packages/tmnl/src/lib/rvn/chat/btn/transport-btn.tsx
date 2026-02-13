import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type RvnChatTransportVariant = 'send' | 'pause' | 'reconnect'

export interface RvnChatTransportBtnProps extends ComponentPropsWithoutRef<'button'> {
  variant: RvnChatTransportVariant
}

export const RvnChatTransportBtn = forwardRef<HTMLButtonElement, RvnChatTransportBtnProps>(
  ({ variant, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      data-slot="rvn-chat-transport-btn"
      data-variant={variant}
      className={cn(
        variant === 'send'
          ? 'rvn-chat__send'
          : variant === 'reconnect'
            ? 'rvn-chat__reconnect'
            : 'rvn-chat__tool-btn',
        className,
      )}
      {...props}
    />
  ),
)

RvnChatTransportBtn.displayName = 'RvnChatTransportBtn'
