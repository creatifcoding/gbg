/**
 * InlineTaskShell context — single source of truth for all shell band state.
 *
 * The Root component owns every piece of mutable state and provides it here.
 * Bands are purely presentational consumers. This mirrors the RvnChatShell
 * pattern where shell-root.tsx owns geometry/expansion context and bands
 * consume it.
 */
import { createContext, useContext } from 'react'
import type { HashMap } from 'effect'
import type { RvnChatInlineTaskItem, RvnChatInlineTaskStatus } from '../inline-task-types'
import type { InlineTaskTransferHandle } from '@/lib/transfer/v2/hooks'

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export interface InlineTaskShellMetrics {
  readonly total: number
  readonly running: number
  readonly completed: number
  readonly failed: number
  readonly queued: number
  readonly blocked: number
  /** completed / (completed + failed) — 0–100, NaN → 0 */
  readonly successRate: number
}

// ---------------------------------------------------------------------------
// Context value
// ---------------------------------------------------------------------------

export interface InlineTaskShellContextValue {
  /** Thread identifier — scopes all state */
  readonly threadId: string

  /** Full unfiltered task array */
  readonly tasks: ReadonlyArray<RvnChatInlineTaskItem>

  /** Tasks after search filter applied */
  readonly filteredTasks: ReadonlyArray<RvnChatInlineTaskItem>

  /** Current search term */
  readonly searchTerm: string
  readonly setSearchTerm: (term: string) => void

  /** Shell-level expanded state (panel open/closed) */
  readonly expanded: boolean
  readonly setExpanded: (expanded: boolean) => void

  /** Which individual task row is expanded (accordion — one at a time) */
  readonly expandedTaskId: string | null
  readonly setExpandedTaskId: (id: string | null) => void

  /** Multi-select state for transfer operations */
  readonly selectedTaskIds: ReadonlySet<string>
  readonly toggleSelection: (taskId: string, additive: boolean) => void
  readonly clearSelection: () => void

  /** Effect HashMap lookup for dependency badge resolution */
  readonly taskLookup: HashMap.HashMap<string, RvnChatInlineTaskItem>

  /** Derived metrics */
  readonly metrics: InlineTaskShellMetrics

  /** Transfer v2 handle (null when transfer not enabled) */
  readonly transfer: InlineTaskTransferHandle | null
}

// ---------------------------------------------------------------------------
// React context
// ---------------------------------------------------------------------------

export const InlineTaskShellContext = createContext<InlineTaskShellContextValue | null>(null)

InlineTaskShellContext.displayName = 'InlineTaskShellContext'

export function useInlineTaskShellContext(): InlineTaskShellContextValue {
  const ctx = useContext(InlineTaskShellContext)
  if (!ctx) {
    throw new Error(
      'useInlineTaskShellContext must be used within <InlineTaskShell.Root>. ' +
      'Ensure your band components are children of InlineTaskShell.',
    )
  }
  return ctx
}
