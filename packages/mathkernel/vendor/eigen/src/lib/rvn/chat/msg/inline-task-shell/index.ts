/**
 * InlineTaskShell — compound component barrel.
 *
 * Usage:
 * ```tsx
 * <InlineTaskShell threadId="thread-1" tasks={tasks}>
 *   <InlineTaskShell.ExpandBand />
 *   <InlineTaskShell.MetricsBand />
 *   <InlineTaskShell.ThreadBand estimatedRowHeight={44} overscan={10} />
 *   <InlineTaskShell.SearchBand placeholder="Filter tasks…" />
 * </InlineTaskShell>
 * ```
 */
import { InlineTaskShellRoot, type InlineTaskShellRootProps } from './inline-task-shell-root'
import { ExpandBand, type ExpandBandProps } from './expand-band'
import { MetricsBand, MetricCell, type MetricsBandProps, type MetricCellProps } from './metrics-band'
import { ThreadBand, type ThreadBandProps } from './thread-band'
import { SearchBand, type SearchBandProps } from './search-band'
import {
  InlineTaskRowActionBtn,
  InlineTaskRowProgress,
  InlineTaskRowToolbar,
  type InlineTaskRowActionBtnProps,
  type InlineTaskRowProgressProps,
  type InlineTaskRowToolbarProps,
  type InlineTaskRowAction,
} from './row'

// Context re-exports
export {
  InlineTaskShellContext,
  useInlineTaskShellContext,
  type InlineTaskShellContextValue,
  type InlineTaskShellMetrics,
} from './inline-task-shell-context'

// ---------------------------------------------------------------------------
// Compound interface
// ---------------------------------------------------------------------------

interface InlineTaskShellCompound {
  (props: InlineTaskShellRootProps & { children?: React.ReactNode }): React.ReactElement | null
  displayName?: string
  Root: typeof InlineTaskShellRoot
  ExpandBand: typeof ExpandBand
  MetricsBand: typeof MetricsBand
  MetricCell: typeof MetricCell
  ThreadBand: typeof ThreadBand
  SearchBand: typeof SearchBand
  RowActionBtn: typeof InlineTaskRowActionBtn
  RowProgress: typeof InlineTaskRowProgress
  RowToolbar: typeof InlineTaskRowToolbar
}

const InlineTaskShell = InlineTaskShellRoot as unknown as InlineTaskShellCompound
InlineTaskShell.Root = InlineTaskShellRoot
InlineTaskShell.ExpandBand = ExpandBand
InlineTaskShell.MetricsBand = MetricsBand
InlineTaskShell.MetricCell = MetricCell
InlineTaskShell.ThreadBand = ThreadBand
InlineTaskShell.SearchBand = SearchBand
InlineTaskShell.RowActionBtn = InlineTaskRowActionBtn
InlineTaskShell.RowProgress = InlineTaskRowProgress
InlineTaskShell.RowToolbar = InlineTaskRowToolbar

export { InlineTaskShell }

// ---------------------------------------------------------------------------
// Type re-exports
// ---------------------------------------------------------------------------

export type {
  InlineTaskShellRootProps,
  ExpandBandProps,
  MetricsBandProps,
  MetricCellProps,
  ThreadBandProps,
  SearchBandProps,
  InlineTaskRowActionBtnProps,
  InlineTaskRowProgressProps,
  InlineTaskRowToolbarProps,
  InlineTaskRowAction,
}
