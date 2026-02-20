/**
 * ChatCodeBlock.Root — Compound root providing code context.
 *
 * Pure black TMNL styling. Dark-only — no light/dark toggle.
 * Async shiki highlighting with graceful fallback to raw <pre>.
 *
 * @module chat/msg/code-block
 */

import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'
import { useBlockDensity } from '../density-context'
import { codeToHtml, type BundledLanguage } from 'shiki'
import { ChatCodeBlockContext, type ChatCodeBlockContextValue } from './code-block-context'

// =============================================================================
// Props
// =============================================================================

export interface ChatCodeBlockRootProps extends ComponentPropsWithoutRef<'div'> {
  /** Source code to display */
  code: string
  /** Language for syntax highlighting (e.g. 'typescript', 'json', 'bash') */
  language?: string
  /** Optional filename shown in header */
  filename?: string
  /** Whether code is still being streamed */
  isStreaming?: boolean
  children?: ReactNode
}

// =============================================================================
// Component
// =============================================================================

export const ChatCodeBlockRoot = memo(forwardRef<HTMLDivElement, ChatCodeBlockRootProps>(
  (
    {
      code,
      language = 'text',
      filename,
      isStreaming = false,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const density = useBlockDensity('code')
    const [highlightedHtml, setHighlightedHtml] = useState<string>('')
    const mountedRef = useRef(false)

    // Async shiki highlighting — TMNL uses one-dark-pro (pure-black compatible)
    useEffect(() => {
      mountedRef.current = true

      // Don't highlight while streaming — too expensive per delta
      if (isStreaming) {
        setHighlightedHtml('')
        return
      }

      codeToHtml(code, {
        lang: language as BundledLanguage,
        theme: 'one-dark-pro',
      })
        .then((html) => {
          if (mountedRef.current) setHighlightedHtml(html)
        })
        .catch(() => {
          // Fallback: no highlighting
          if (mountedRef.current) setHighlightedHtml('')
        })

      return () => { mountedRef.current = false }
    }, [code, language, isStreaming])

    const ctx: ChatCodeBlockContextValue = {
      code,
      language,
      filename,
      isStreaming,
    }

    // ── Pill density: inline code badge ─────────────────
    if (density === 'pill') {
      return (
        <ChatCodeBlockContext.Provider value={ctx}>
          <div
            ref={ref}
            data-slot="tmnl-chat-code-block"
            data-density="pill"
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full',
              'border border-neutral-800 bg-neutral-950',
              className,
            )}
            {...props}
          >
            <span className="text-neutral-400 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              {filename ?? language}
            </span>
          </div>
        </ChatCodeBlockContext.Provider>
      )
    }

    // ── Line truncation ─────────────────────────────────
    const VISIBLE_LINES = 12
    const lines = code.split('\n')
    const totalLines = lines.length
    const isTruncatable = totalLines > VISIBLE_LINES && !isStreaming
    const [expanded, setExpanded] = useState(false)
    const toggleExpand = useCallback(() => setExpanded((p) => !p), [])

    const displayCode = isTruncatable && !expanded
      ? lines.slice(0, VISIBLE_LINES).join('\n')
      : code

    // Re-highlight when truncation toggles
    const [truncatedHtml, setTruncatedHtml] = useState<string>('')
    useEffect(() => {
      if (isStreaming || !isTruncatable) {
        setTruncatedHtml('')
        return
      }
      let alive = true
      codeToHtml(displayCode, {
        lang: language as BundledLanguage,
        theme: 'one-dark-pro',
      })
        .then((html) => { if (alive) setTruncatedHtml(html) })
        .catch(() => { if (alive) setTruncatedHtml('') })
      return () => { alive = false }
    }, [displayCode, language, isStreaming, isTruncatable])

    const activeHtml = isTruncatable ? truncatedHtml : highlightedHtml
    const activeCode = isTruncatable && !expanded
      ? displayCode
      : code

    // ── Full/Compact density ─────────────────────────────
    const maxHeight = density === 'compact' ? 'max-h-48 overflow-auto' : ''

    return (
      <ChatCodeBlockContext.Provider value={ctx}>
        <div
          ref={ref}
          data-slot="tmnl-chat-code-block"
          data-density={density}
          data-language={language}
          data-streaming={isStreaming || undefined}
          className={cn(
            'group relative rounded border border-neutral-800 overflow-hidden',
            density === 'compact' ? 'my-1' : 'my-1.5',
            'bg-neutral-950',
            className,
          )}
          {...props}
        >
          {/* Highlighted code area */}
          {activeHtml ? (
            <div
              className={cn(
                'overflow-auto',
                maxHeight,
                '[&>pre]:m-0 [&>pre]:bg-transparent! [&>pre]:p-3 [&>pre]:text-neutral-300!',
                '[&_code]:font-mono',
              )}
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              dangerouslySetInnerHTML={{ __html: activeHtml }}
            />
          ) : (
            <pre
              className={cn('m-0 p-3 text-neutral-300 font-mono overflow-auto bg-transparent', maxHeight)}
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              <code>{activeCode}</code>
            </pre>
          )}

          {/* Line truncation toggle */}
          {isTruncatable && (
            <button
              type="button"
              onClick={toggleExpand}
              className={cn(
                'w-full px-3 py-1.5 text-left font-mono',
                'text-cyan-500 hover:text-cyan-400 hover:bg-neutral-900/50',
                'border-t border-neutral-800 transition-colors duration-150',
              )}
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {expanded
                ? 'Show less'
                : `Show ${totalLines - VISIBLE_LINES} more line${totalLines - VISIBLE_LINES !== 1 ? 's' : ''}`}
            </button>
          )}

          {/* Compound children (Header, CopyButton, etc.) rendered as overlays */}
          {children}
        </div>
      </ChatCodeBlockContext.Provider>
    )
  },
))

ChatCodeBlockRoot.displayName = 'ChatCodeBlock.Root'
