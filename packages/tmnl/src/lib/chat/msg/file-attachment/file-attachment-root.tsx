/**
 * ChatFileAttachment.Root — Compound root for file/image attachment display.
 *
 * @module chat/msg/file-attachment
 */

import {
  forwardRef,
  memo,
  useMemo,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'
import { useBlockDensity } from '../density-context'
import { ChatFileAttachmentContext, type ChatFileAttachmentContextValue } from './file-attachment-context'

// =============================================================================
// Helpers
// =============================================================================

function deriveFilename(url: string, mediaType: string): string {
  try {
    const pathname = new URL(url).pathname
    const segments = pathname.split('/')
    const last = segments[segments.length - 1]
    if (last && last.includes('.')) return decodeURIComponent(last)
  } catch { /* ignore */ }
  return mediaType || 'file'
}

function isImageMediaType(mediaType: string): boolean {
  return mediaType.startsWith('image/')
}

// =============================================================================
// Props
// =============================================================================

export interface ChatFileAttachmentRootProps extends ComponentPropsWithoutRef<'div'> {
  url: string
  mediaType: string
  filename?: string
  size?: number
  children?: ReactNode
}

// =============================================================================
// Component
// =============================================================================

export const ChatFileAttachmentRoot = memo(forwardRef<HTMLDivElement, ChatFileAttachmentRootProps>(
  ({ url, mediaType, filename, size, className, children, ...props }, ref) => {
    const ctx = useMemo<ChatFileAttachmentContextValue>(() => ({
      url,
      mediaType,
      filename: filename || deriveFilename(url, mediaType),
      size,
      isImage: isImageMediaType(mediaType),
    }), [url, mediaType, filename, size])

    const density = useBlockDensity('fileAttachment')

    // ── Pill density: inline filename badge ──────────────
    if (density === 'pill') {
      return (
        <ChatFileAttachmentContext.Provider value={ctx}>
          <span
            ref={ref as any}
            data-slot="tmnl-chat-file-attachment"
            data-density="pill"
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full',
              'border border-neutral-800 bg-neutral-950/50',
              className,
            )}
            {...props}
          >
            <span className="text-neutral-400 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              {ctx.filename}
            </span>
          </span>
        </ChatFileAttachmentContext.Provider>
      )
    }

    // ── Full/Compact ─────────────────────────────────────
    return (
      <ChatFileAttachmentContext.Provider value={ctx}>
        <div
          ref={ref}
          data-slot="tmnl-chat-file-attachment"
          data-density={density}
          className={cn(
            'flex items-center gap-2 rounded border border-neutral-800',
            density === 'compact' ? 'my-1 px-2 py-1' : 'my-1.5 px-2.5 py-1.5',
            'bg-neutral-950/50',
            'hover:border-neutral-700 hover:bg-neutral-900/30',
            'transition-colors duration-150',
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </ChatFileAttachmentContext.Provider>
    )
  },
))

ChatFileAttachmentRoot.displayName = 'ChatFileAttachment.Root'
