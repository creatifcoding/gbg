import {
  forwardRef,
  memo,
  useEffect,
  type ComponentPropsWithoutRef,
} from 'react'
import remarkGfm from 'remark-gfm'
import { Streamdown } from 'streamdown'
import { cn } from '@/lib/utils'
import { tmnlMdComponents } from '../md-components'

// Stable references — never recreated
const remarkPlugins = [remarkGfm]

// =============================================================================
// Body Content Root
// =============================================================================

export interface ChatMessageBodyContentRootProps extends ComponentPropsWithoutRef<'div'> {
  streaming?: boolean
}

export const ChatMessageBodyContentRoot = forwardRef<HTMLDivElement, ChatMessageBodyContentRootProps>(
  ({ streaming = false, className, children, ...props }, ref) => {
    const content = typeof children === 'string' ? (
      <MarkdownBody text={children} streaming={streaming} />
    ) : (
      children
    )

    return (
      <div
        ref={ref}
        data-slot="tmnl-chat-message-body-content"
        data-streaming={streaming || undefined}
        className={cn(
          'flex-1 min-w-0 font-mono text-neutral-200 leading-relaxed',
          className,
        )}
        style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        {...props}
      >
        {content}
      </div>
    )
  },
)

ChatMessageBodyContentRoot.displayName = 'ChatMessage.BodyContent.Root'

// =============================================================================
// MarkdownBody — memoized markdown renderer with live streaming support
// =============================================================================

const MarkdownBody = memo(function MarkdownBody({
  text,
  streaming,
}: {
  text: string
  streaming: boolean
}) {
  // Latency probe: stamp react_render after DOM commit during streaming
  // Use requestAnimationFrame to stamp AFTER Streamdown's useTransition commits
  useEffect(() => {
    if (!streaming) return
    const probe = (globalThis as any).__streamingLatencyProbe
    if (probe?.enabled) {
      requestAnimationFrame(() => {
        probe.stampReactRender()
      })
    }
  })

  return (
    <Streamdown
      mode={streaming ? 'streaming' : 'static'}
      components={tmnlMdComponents}
      remarkPlugins={remarkPlugins}
      controls={{ code: false, table: false }}
    >
      {text}
    </Streamdown>
  )
})
