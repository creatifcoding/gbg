import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type RvnChatComposerVoiceGroupProps = ComponentPropsWithoutRef<'div'>

export const RvnChatComposerVoiceGroup = forwardRef<HTMLDivElement, RvnChatComposerVoiceGroupProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="rvn-chat-composer-toolbar-voice-group"
      className={cn('rvn-chat__voice-group', className)}
      {...props}
    />
  ),
)

RvnChatComposerVoiceGroup.displayName = 'RvnChatComposer.Toolbar.VoiceGroup'
