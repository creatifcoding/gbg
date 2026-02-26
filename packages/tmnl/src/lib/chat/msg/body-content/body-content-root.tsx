import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  type ComponentPropsWithoutRef,
} from 'react'
import remarkGfm from 'remark-gfm'
import { Streamdown } from 'streamdown'
import { cn } from '@/lib/utils'
// =============================================================================
// Streaming-aware markdown components
// =============================================================================

function createMdComponents(streaming: boolean): Record<string, React.FC<any>> {
  return {
    // ── Code ─────────────────────────────────────────────────
    // Fenced code blocks are owned by the parts system:
    //   appendTextDelta splits fences → PartRenderer renders ChatCodeBlock.
    // Streamdown only handles inline code. If a partial fence leaks into a
    // text part mid-stream, render it as minimal monospace — not ChatCodeBlock.
    code({ inline, className, children, ...props }: any) {
      // Inline code → styled span
      if (inline) {
        return (
          <code
            className="px-1 py-0.5 rounded bg-neutral-800/60 text-cyan-400 font-mono"
            style={{ fontSize: '0.9em' }}
            {...props}
          >
            {children}
          </code>
        )
      }

      // Fenced block leaked into text part (partial fence during streaming).
      // Minimal fallback — parts system will pick it up once the fence closes.
      return (
        <pre className="my-2 p-3 rounded bg-neutral-900/80 overflow-x-auto">
          <code
            className="font-mono text-neutral-300"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {children}
          </code>
        </pre>
      )
    },

    // ── Block elements ─────────────────────────────────────
    p({ children }: any) {
      return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
    },

    a({ href, children }: any) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors"
        >
          {children}
        </a>
      )
    },

    h1({ children }: any) { return <h1 className="text-lg font-bold text-neutral-100 mt-3 mb-1.5">{children}</h1> },
    h2({ children }: any) { return <h2 className="text-base font-bold text-neutral-100 mt-2.5 mb-1">{children}</h2> },
    h3({ children }: any) { return <h3 className="text-sm font-semibold text-neutral-200 mt-2 mb-1">{children}</h3> },

    ul({ children }: any) { return <ul className="list-disc list-inside mb-2 space-y-0.5 text-neutral-300">{children}</ul> },
    ol({ children }: any) { return <ol className="list-decimal list-inside mb-2 space-y-0.5 text-neutral-300">{children}</ol> },
    li({ children }: any) { return <li className="leading-relaxed">{children}</li> },

    blockquote({ children }: any) {
      return (
        <blockquote className="border-l-2 border-cyan-500/40 pl-3 my-2 text-neutral-400 italic">
          {children}
        </blockquote>
      )
    },

    hr() { return <hr className="border-neutral-800 my-3" /> },

    strong({ children }: any) { return <strong className="font-semibold text-neutral-100">{children}</strong> },
    em({ children }: any) { return <em className="italic text-neutral-300">{children}</em> },

    // ── GFM Tables ─────────────────────────────────────────
    table({ children }: any) {
      return (
        <div className="overflow-x-auto my-2">
          <table className="w-full border-collapse border border-neutral-800 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            {children}
          </table>
        </div>
      )
    },
    th({ children }: any) { return <th className="border border-neutral-800 px-2 py-1 bg-neutral-900 text-left text-neutral-300 font-semibold">{children}</th> },
    td({ children }: any) { return <td className="border border-neutral-800 px-2 py-1 text-neutral-400">{children}</td> },

    // Pre — pass-through, code() handles rendering
    pre({ children }: any) { return <>{children}</> },
  }
}

// Cache two versions so we don't re-create on every render
const MD_COMPONENTS_STATIC = createMdComponents(false)
const MD_COMPONENTS_STREAMING = createMdComponents(true)

// Stable reference — never recreates
const remarkPlugins = [remarkGfm]

// =============================================================================
// Body Content Root
// =============================================================================

export interface ChatMessageBodyContentRootProps extends ComponentPropsWithoutRef<'div'> {
  streaming?: boolean
}

export const ChatMessageBodyContentRoot = forwardRef<HTMLDivElement, ChatMessageBodyContentRootProps>(
  ({ streaming = false, className, children, ...props }, ref) => {
    // If children is a string, render as markdown
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

  const components = streaming ? MD_COMPONENTS_STREAMING : MD_COMPONENTS_STATIC

  return (
    <Streamdown
      mode={streaming ? 'streaming' : 'static'}
      components={components}
      remarkPlugins={remarkPlugins}
    >
      {text}
    </Streamdown>
  )
})
