import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type RvnChatInterruptionTone = 'warn' | 'error' | 'info'

export interface RvnChatInterruptionBannerProps extends ComponentPropsWithoutRef<'div'> {
  tone?: RvnChatInterruptionTone
}

export const RvnChatInterruptionBanner = forwardRef<HTMLDivElement, RvnChatInterruptionBannerProps>(
  ({ tone = 'warn', className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="rvn-chat-interruption-banner"
      data-tone={tone}
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('rvn-chat__interruption-banner', className)}
      {...props}
    />
  ),
)

RvnChatInterruptionBanner.displayName = 'RvnChatInterruptionBanner'
