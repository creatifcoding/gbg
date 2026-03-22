/**
 * TMNL Markdown Code — inline spans only.
 *
 * Ownership model:
 *   Fenced code blocks → parts system (appendTextDelta → ChatCodeBlock w/ shiki)
 *   Inline code        → this component
 *   Fenced detected    → minimal placeholder until parts system takes over
 *
 * Detection (Vector 6): className-based first (language-* = always fenced),
 * position fallback (start.line === end.line = inline).
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
    // Primary signal: language-* class = always fenced (from remark)
    const hasLanguageClass = className?.startsWith('language-')
    // Fallback: position-based (start.line === end.line → inline)
    const positionIsInline = node?.position?.start.line === node?.position?.end.line

    // Inline if no language class AND position says single line
    const isInline = !hasLanguageClass && positionIsInline

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

    // Fenced: minimal placeholder — Parts system takes over with ChatCodeBlock
    return (
      <div
        className="my-2 p-3 rounded border border-neutral-800/20 bg-neutral-950/30 font-mono text-neutral-600"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        data-tmnl-md="code-pending"
      >
        {/* Parts system will replace this with ChatCodeBlock + Shiki */}
        ···
      </div>
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
