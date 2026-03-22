/**
 * BlocksView Component
 *
 * Renders a virtualized list of terminal blocks with scroll management.
 * Supports auto-scroll to bottom and user scroll detection.
 */

import { memo, useCallback, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { Block } from '../schemas'
import { CommandBlock } from './CommandBlock'
import { AIResponseBlock } from './AIResponseBlock'
import { InteractiveBlock } from './InteractiveBlock'
import { ErrorBlock } from './ErrorBlock'
import { SystemBlock } from './SystemBlock'

export interface BlocksViewProps {
  /**
   * Blocks to render
   */
  blocks: readonly Block[]

  /**
   * Container ref for scroll management
   */
  containerRef?: React.RefObject<HTMLDivElement>

  /**
   * Called when user scrolls manually
   */
  onUserScroll?: (scrolled: boolean) => void

  /**
   * Whether to auto-scroll to bottom on new content
   */
  autoScroll?: boolean

  /**
   * Optional class name
   */
  className?: string

  /**
   * Called when a block is clicked
   */
  onBlockClick?: (block: Block) => void

  /**
   * Called when dismiss is requested for an interactive block
   */
  onDismissBlock?: (blockId: string) => void

  /**
   * Custom markdown renderer for AI responses
   */
  renderMarkdown?: (content: string) => React.ReactNode

  /**
   * Gap between blocks in pixels
   */
  gap?: number

  /**
   * Padding inside the container
   */
  padding?: number
}

/**
 * BlocksView - renders a list of terminal blocks
 */
export const BlocksView = memo(function BlocksView({
  blocks,
  containerRef: externalRef,
  onUserScroll,
  autoScroll = true,
  className,
  onBlockClick,
  onDismissBlock,
  renderMarkdown,
  gap = 12,
  padding = 16,
}: BlocksViewProps) {
  const internalRef = useRef<HTMLDivElement>(null)
  const containerRef = externalRef ?? internalRef

  // Track if user has scrolled up
  const isNearBottomRef = useRef(true)
  const prevBlocksLengthRef = useRef(blocks.length)

  // Detect user scroll
  const handleScroll = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const threshold = 100 // pixels from bottom to consider "at bottom"
    const isNearBottom = scrollHeight - scrollTop - clientHeight < threshold

    if (isNearBottomRef.current !== isNearBottom) {
      isNearBottomRef.current = isNearBottom
      onUserScroll?.(!isNearBottom)
    }
  }, [containerRef, onUserScroll])

  // Auto-scroll when new blocks are added
  useEffect(() => {
    const container = containerRef.current
    if (!container || !autoScroll) return

    // Only auto-scroll if we were at the bottom before
    if (blocks.length > prevBlocksLengthRef.current && isNearBottomRef.current) {
      container.scrollTop = container.scrollHeight
    }

    prevBlocksLengthRef.current = blocks.length
  }, [blocks, autoScroll, containerRef])

  // Render a single block based on type
  const renderBlock = useCallback(
    (block: Block) => {
      const handleClick = onBlockClick ? () => onBlockClick(block) : undefined

      switch (block._tag) {
        case 'command':
          return (
            <CommandBlock
              key={block.id}
              block={block}
              onClick={handleClick}
            />
          )

        case 'ai-response':
          return (
            <AIResponseBlock
              key={block.id}
              block={block}
              onClick={handleClick}
              renderMarkdown={renderMarkdown}
            />
          )

        case 'interactive':
          return (
            <InteractiveBlock
              key={block.id}
              block={block}
              onClick={handleClick}
              onDismiss={onDismissBlock ? () => onDismissBlock(block.id) : undefined}
            />
          )

        case 'error':
          return (
            <ErrorBlock
              key={block.id}
              block={block}
              onClick={handleClick}
            />
          )

        case 'system':
          return (
            <SystemBlock
              key={block.id}
              block={block}
              onClick={handleClick}
            />
          )

        default:
          return null
      }
    },
    [onBlockClick, onDismissBlock, renderMarkdown]
  )

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex-1 overflow-y-auto overflow-x-hidden',
        'scrollbar-thin scrollbar-thumb-surface-4 scrollbar-track-transparent',
        className
      )}
      style={{ padding }}
      onScroll={handleScroll}
    >
      <div
        className="flex flex-col"
        style={{ gap }}
      >
        {blocks.map(renderBlock)}

        {/* Empty state */}
        {blocks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <svg
              className="w-12 h-12 mb-4 opacity-50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
              No commands yet
            </p>
            <p
              className="mt-1 opacity-60"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              Type a command or use / for AI
            </p>
          </div>
        )}
      </div>
    </div>
  )
})

export default BlocksView
