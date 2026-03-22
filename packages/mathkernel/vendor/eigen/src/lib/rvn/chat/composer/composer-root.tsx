import { forwardRef, type ComponentPropsWithoutRef, type ReactElement } from 'react'
import { cn } from '@/lib/utils'
import { RvnChatComposerInput } from './composer-input'
import { RvnChatComposerSuggestions } from './composer-suggestions'
import { RvnChatComposerToolbar } from './composer-toolbar'
import { RvnChatComposerRecordingBanner } from './recording-banner'
import { RvnChatComposerTransport } from './transport'

export type RvnChatComposerRootProps = ComponentPropsWithoutRef<'div'>

const Root = forwardRef<HTMLDivElement, RvnChatComposerRootProps>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="rvn-chat-composer"
    className={cn('rvn-chat__composer', className)}
    {...props}
  />
))
Root.displayName = 'RvnChatComposer.Root'

interface RvnChatComposerComponent {
  (props: RvnChatComposerRootProps): ReactElement
  displayName?: string
  Root: typeof Root
  Input: typeof RvnChatComposerInput
  Suggestions: typeof RvnChatComposerSuggestions
  Toolbar: typeof RvnChatComposerToolbar
  Transport: typeof RvnChatComposerTransport
  RecordingBanner: typeof RvnChatComposerRecordingBanner
}

const RvnChatComposer = Root as RvnChatComposerComponent
RvnChatComposer.Root = Root
RvnChatComposer.Input = RvnChatComposerInput
RvnChatComposer.Suggestions = RvnChatComposerSuggestions
RvnChatComposer.Toolbar = RvnChatComposerToolbar
RvnChatComposer.Transport = RvnChatComposerTransport
RvnChatComposer.RecordingBanner = RvnChatComposerRecordingBanner

export { RvnChatComposer }
