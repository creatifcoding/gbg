import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type RvnChatComposerRecordingBannerProps = ComponentPropsWithoutRef<'div'>

export const RvnChatComposerRecordingBanner = forwardRef<HTMLDivElement, RvnChatComposerRecordingBannerProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="rvn-chat-composer-recording-banner"
      className={cn('rvn-chat__recording-banner', className)}
      {...props}
    />
  ),
)

RvnChatComposerRecordingBanner.displayName = 'RvnChatComposer.RecordingBanner'
