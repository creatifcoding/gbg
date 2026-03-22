/**
 * InlineTaskShell — compound component barrel.
 *
 * Usage:
 * ```tsx
 * <InlineTaskShell threadId="thread-1" tasks={tasks}>
 *   <InlineTaskShell.ExpandBand />
 *   <InlineTaskShell.MetricsBand />
 *   <InlineTaskShell.ThreadBand />
 *   <InlineTaskShell.SearchBand placeholder="Filter tasks…" />
 * </InlineTaskShell>
 * ```
 */
import type { ReactElement, ReactNode } from 'react'
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
  (props: InlineTaskShellRootProps & { children?: ReactNode }): ReactElement | null
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
