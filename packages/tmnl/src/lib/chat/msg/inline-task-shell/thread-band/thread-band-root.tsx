/**
 * InlineTaskShell.ThreadBand — renders the task list using the
 * full virtualized list with transfer, animations, and accordion/drawer.
 */
import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { useInlineTaskShellContext } from '../inline-task-shell-context'
import { ChatInlineTaskVirtualizedList } from '../../inline-task-virtualized-list'
import type { InlineTaskRowAction } from '../row/inline-task-row-action-btn'

export interface ThreadBandProps extends ComponentPropsWithoutRef<'div'> {
  expansionLevel?: 'l2' | 'l3'
  estimatedRowHeight?: number
  overscan?: number
  previewCount?: number
  streaming?: boolean
  autoOpenOnStreaming?: boolean
  enableTransfer?: boolean
  transferSurfaceId?: string
  transferSourceId?: string
  transferSourceLabel?: string
  transferAgentId?: string
  transferClusterId?: string
  transferClusterLabel?: string
  onTaskAction?: (action: InlineTaskRowAction, taskId: string) => void
  onTaskClick?: (taskId: string) => void
}

export const ThreadBand = forwardRef<HTMLDivElement, ThreadBandProps>(
  (
    {
      expansionLevel = 'l2',
      estimatedRowHeight,
      overscan,
      previewCount,
      streaming,
      autoOpenOnStreaming,
      enableTransfer,
      transferSurfaceId,
      transferSourceId,
      transferSourceLabel,
      transferAgentId,
      transferClusterId,
      transferClusterLabel,
      className,
      ...props
    },
    ref,
  ) => {
    const { threadId, expanded, setExpanded, filteredTasks } = useInlineTaskShellContext()

    return (
      <div
        ref={ref}
        data-slot="tmnl-chat-inline-task-shell-thread-band"
        className={cn('', className)}
        {...props}
      >
        <ChatInlineTaskVirtualizedList
          threadId={threadId}
          expansionLevel={expansionLevel}
          expanded={expanded}
          onExpandedChange={setExpanded}
          expandedTasks={filteredTasks}
          estimatedRowHeight={estimatedRowHeight}
          overscan={overscan}
          previewCount={previewCount}
          streaming={streaming}
          autoOpenOnStreaming={autoOpenOnStreaming}
          enableTransfer={enableTransfer}
          transferSurfaceId={transferSurfaceId}
          transferSourceId={transferSourceId}
          transferSourceLabel={transferSourceLabel}
          transferAgentId={transferAgentId}
          transferClusterId={transferClusterId}
          transferClusterLabel={transferClusterLabel}
        />
      </div>
    )
  },
)

ThreadBand.displayName = 'InlineTaskShell.ThreadBand'
