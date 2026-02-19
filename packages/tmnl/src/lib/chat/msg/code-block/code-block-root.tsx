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
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'
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

    return (
      <ChatCodeBlockContext.Provider value={ctx}>
        <div
          ref={ref}
          data-slot="tmnl-chat-code-block"
          data-language={language}
          data-streaming={isStreaming || undefined}
          className={cn(
            'group relative rounded border border-neutral-800 my-1.5 overflow-hidden',
            'bg-neutral-950',
            className,
          )}
          {...props}
        >
          {/* Highlighted code area */}
          {highlightedHtml ? (
            <div
              className={cn(
                'overflow-auto',
                '[&>pre]:m-0 [&>pre]:bg-transparent! [&>pre]:p-3 [&>pre]:text-neutral-300!',
                '[&_code]:font-mono',
              )}
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          ) : (
            <pre
              className="m-0 p-3 text-neutral-300 font-mono overflow-auto bg-transparent"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              <code>{code}</code>
            </pre>
          )}
          {/* Compound children (Header, CopyButton, etc.) rendered as overlays */}
          {children}
        </div>
      </ChatCodeBlockContext.Provider>
    )
  },
))

ChatCodeBlockRoot.displayName = 'ChatCodeBlock.Root'
