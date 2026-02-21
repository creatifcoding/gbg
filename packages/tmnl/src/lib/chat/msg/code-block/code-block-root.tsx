/**
 * ChatCodeBlock.Root — Compound root providing code context.
 *
 * Pure black TMNL styling. Dark-only — no light/dark toggle.
 * Shiki highlighting with throttled re-highlight during streaming (~300ms).
 * Live line counter + streaming indicator in header chrome.
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
import { ChatCodeBlockContext, type ChatCodeBlockContextValue } from './code-block-context'
import { useThrottledHighlight } from '../shared/use-throttled-highlight'

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
    const lines = code.split('\n')
    const totalLines = lines.length

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

    // ── Line truncation (only when NOT streaming) ────────
    const VISIBLE_LINES = 12
    const isTruncatable = totalLines > VISIBLE_LINES && !isStreaming
    const [expanded, setExpanded] = useState(false)
    const toggleExpand = useCallback(() => setExpanded((p) => !p), [])

    const displayCode = isTruncatable && !expanded
      ? lines.slice(0, VISIBLE_LINES).join('\n')
      : code

    // ── Throttled shiki highlight (works DURING streaming) ─
    const highlightedHtml = useThrottledHighlight(displayCode, language, isStreaming)

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
            'group relative rounded border overflow-hidden',
            density === 'compact' ? 'my-1' : 'my-1.5',
            'bg-neutral-950',
            isStreaming ? 'border-cyan-500/30' : 'border-neutral-800',
            className,
          )}
          {...props}
        >
          {/* ── Inline chrome header ────────────────────── */}
          <div
            className={cn(
              'flex items-center justify-between px-3 py-1 border-b',
              isStreaming ? 'border-cyan-500/20' : 'border-neutral-800',
            )}
          >
            <div className="flex items-center gap-2">
              {/* Language badge */}
              {language && language !== 'text' && (
                <span className="text-neutral-500 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                  {filename ?? language}
                </span>
              )}
              {/* Live streaming indicator */}
              {isStreaming && (
                <span className="flex items-center gap-1.5">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
                    <span className="relative inline-flex size-2 rounded-full bg-cyan-400" />
                  </span>
                  <span className="text-cyan-400/70 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                    streaming
                  </span>
                </span>
              )}
            </div>
            {/* Line counter — evolves live */}
            <span
              className={cn(
                'font-mono tabular-nums',
                isStreaming ? 'text-cyan-500/60' : 'text-neutral-600',
              )}
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {totalLines} line{totalLines !== 1 ? 's' : ''}
            </span>
          </div>

          {/* ── Highlighted code area ──────────────────── */}
          {highlightedHtml ? (
            <div
              className={cn(
                'overflow-auto',
                maxHeight,
                '[&>pre]:m-0 [&>pre]:bg-transparent! [&>pre]:p-3 [&>pre]:text-neutral-300!',
                '[&_code]:font-mono',
              )}
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          ) : (
            <pre
              className={cn('m-0 p-3 text-neutral-300 font-mono overflow-auto bg-transparent', maxHeight)}
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              <code>{displayCode}</code>
            </pre>
          )}

          {/* ── Streaming cursor at bottom ─────────────── */}
          {isStreaming && (
            <div className="px-3 pb-1">
              <span className="inline-block text-cyan-400 animate-pulse font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                ▌
              </span>
            </div>
          )}

          {/* ── Line truncation toggle ─────────────────── */}
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

          {/* Compound children (CopyButton, etc.) rendered as overlays */}
          {children}
        </div>
      </ChatCodeBlockContext.Provider>
    )
  },
))

ChatCodeBlockRoot.displayName = 'ChatCodeBlock.Root'
