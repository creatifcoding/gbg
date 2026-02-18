/**
 * Agent Task Views — barrel export.
 *
 * @module agent-task/views
 */

export {
  InlineTaskLogView,
  type InlineTaskLogViewProps,
  type InlineTaskLogViewFilterBarProps,
  type InlineTaskLogViewTailControlsProps,
  type InlineTaskLogViewHeaderProps,
  type InlineTaskLogViewTitleProps,
  type InlineTaskLogViewScrollProps,
  type InlineTaskLogViewBodyProps,
  type InlineTaskLogViewEmptyProps,
  type InlineTaskLogViewEntriesProps,
  type InlineTaskLogViewCursorProps,
} from './inline-task-log-view'
export {
  useInlineTaskLogController,
  type InlineTaskLogController,
  type UseInlineTaskLogControllerOptions,
  type TailInterruptProps,
} from './use-inline-task-log-controller'
// Re-export scroll primitives from extracted lib (backwards compatibility)
export {
  useScrollAnchor,
  useScrollPointer,
  scrollInContainer,
  type ScrollAnchorHandle,
  type ScrollAnchorOptions,
  type ScrollPointerHandle,
  type ScrollPointerOptions,
} from '@/lib/scroll'
export {
  useInlineTaskLogViewContext,
  InlineTaskLogViewProvider,
  type InlineTaskLogViewContextValue,
  type InlineTaskLogViewProviderProps,
} from './inline-task-log-view-context'
export { LogEntryRow, type LogEntryRowProps } from './log-entry-row'
export { LogFilterBar, type LogFilterBarProps } from './log-filter-bar'
export {
  LogDorkChips,
  type LogDorkChipsProps,
  type LogDorkChipProps,
  type LogDorkChipRowProps,
  type LogDorkChipTypeProps,
  type LogDorkChipTokenProps,
  type LogDorkChipRemoveProps,
} from './log-dork-chips'
export {
  normalizeParsedQuery,
  toDorkChips,
  removeDorkChip,
  type DorkChip,
} from './log-dork-chips-model'
export { useLogDorkChips, type UseLogDorkChipsResult } from './use-log-dork-chips'
export { LogTailControls, type LogTailControlsProps } from './log-tail-controls'
export {
  LogEntryDetail,
  LogEntryDetailRoot,
  type LogEntryDetailRootProps,
  LogEntryDetailFields,
  type LogEntryDetailFieldsProps,
  LogEntryJsonBlock,
  LogEntryPayloadJsonBlock,
  LogEntryMetadataJsonBlock,
  type LogEntryJsonBlockProps,
  type LogEntryJsonVariantProps,
  LogEntryFlushContainers,
  type LogEntryFlushContainersProps,
  LogEntryStackTrace,
  type LogEntryStackTraceProps,
} from './log-entry-detail'
export { InlineTaskSemanticSummary, type InlineTaskSemanticSummaryProps, type SemanticSummaryTask } from './semantic-summary'
export { InlineTaskViewNavigator, type InlineTaskViewNavigatorProps } from './view-navigator'
