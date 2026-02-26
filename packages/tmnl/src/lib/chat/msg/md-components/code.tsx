/**
 * TMNL Markdown Code — inline spans + fenced block fallback.
 *
 * Ownership model:
 *   Fenced code blocks → parts system (appendTextDelta → ChatCodeBlock w/ shiki)
 *   Inline code        → this component
 *   Fenced fallback    → partial fence leaked mid-stream, minimal pre/code
 *
 * Streamdown derives `inline` from node.position (start.line === end.line),
 * NOT from a direct prop like ReactMarkdown.
 *
 * @module chat/msg/md-components/code
 */

import { memo } from 'react'
import { cn } from '@/lib/utils'
import { sameClassAndNode, type MarkdownNode } from './types'

// ─── Props ──────────────────────────────────────────────────────────────────

interface MdCodeProps {
  node?: MarkdownNode
  className?: string
  children?: React.ReactNode
  [key: string]: any
}

// ─── Code Component ─────────────────────────────────────────────────────────

export const MdCode = memo<MdCodeProps>(
  ({ node, className, children, ...props }) => {
    const isInline = node?.position?.start.line === node?.position?.end.line

    if (isInline) {
      return (
        <code
          className={cn(
            'px-1 py-0.5 rounded bg-neutral-800/60 text-cyan-400 font-mono',
            className,
          )}
          style={{ fontSize: '0.9em' }}
          data-tmnl-md="inline-code"
          {...props}
        >
          {children}
        </code>
      )
    }

    // Fenced block leaked into text part (partial fence during streaming).
    // Minimal fallback — parts system takes over once the fence closes.
    return (
      <pre
        className="my-2 p-3 rounded border border-neutral-800/40 bg-neutral-950/60 overflow-x-auto"
        data-tmnl-md="code-fallback"
      >
        <code
          className={cn('font-mono text-neutral-400', className)}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          {...props}
        >
          {children}
        </code>
      </pre>
    )
  },
  (p, n) => p.className === n.className && (
    p.node?.position?.start.line === n.node?.position?.start.line &&
    p.node?.position?.start.column === n.node?.position?.start.column &&
    p.node?.position?.end.line === n.node?.position?.end.line &&
    p.node?.position?.end.column === n.node?.position?.end.column
  ),
)
MdCode.displayName = 'TmnlMd.Code'

// ─── Pre (pass-through) ────────────────────────────────────────────────────
// Streamdown's default: children pass-through. Code component handles rendering.

export const MdPre = ({ children }: { children?: React.ReactNode }) => <>{children}</>
MdPre.displayName = 'TmnlMd.Pre'
