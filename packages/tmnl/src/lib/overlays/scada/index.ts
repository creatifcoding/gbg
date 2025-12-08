/**
 * SCADA Overlay System
 *
 * Industrial HMI overlays for process control visualization.
 *
 * @module
 *
 * ## Overlay Taxonomy
 *
 * | Overlay      | Type     | Port Pattern           | Description                    |
 * |--------------|----------|------------------------|--------------------------------|
 * | TagBinding   | Reactive | tag:{tagId}:pv         | Live value with quality        |
 * | Alarm        | Reactive | alarm:{tagId}:active   | Annunciation & acknowledgment  |
 * | DataGrid     | Reactive | grid:{gridId}:rows     | AG-Grid integration            |
 * | Chart        | Reactive | chart:{chartId}:data   | ECharts integration            |
 * | Navigation   | Interactive | nav:screen:current  | Screen transitions             |
 * | Faceplate    | Interactive | faceplate:{tagId}:open | Popover control panels      |
 * | Command      | Interactive | cmd:{target}:execute | Operator actions              |
 *
 * ## Port Naming Convention
 *
 * ```
 * {domain}:{entity}:{property}
 * ```
 *
 * Examples:
 * - `tag:FIC-101:pv` — Process value
 * - `alarm:FIC-101:active` — Alarm state
 * - `chart:trends-1:data` — Chart data stream
 *
 * @example
 * ```tsx
 * import {
 *   useTagBinding,
 *   createTagValue,
 *   TagId,
 *   tagPort,
 * } from "@/lib/overlays/scada"
 *
 * function TagDisplay({ containerId }: Props) {
 *   const { value, quality, qualityColor, isReliable } = useTagBinding({
 *     containerId,
 *     tagId: "FIC-101" as TagId,
 *     qualityThreshold: "uncertain",
 *   })
 *
 *   return (
 *     <div style={{ borderColor: qualityColor }}>
 *       {value?.toFixed(2) ?? "—"}
 *       {!isReliable && <span>⚠️</span>}
 *     </div>
 *   )
 * }
 * ```
 */

// ─────────────────────────────────────────────────────────────
// Types (Effect Schema)
// ─────────────────────────────────────────────────────────────

export {
  // Tag Domain
  TagId,
  type TagId as TagIdType,
  TagQuality,
  type TagQuality as TagQualityType,
  TagValue,
  NumericTagValue,
  type NumericTagValue as NumericTagValueType,
  TagConfig,
  type TagConfig as TagConfigType,
  tagPort,

  // Alarm Domain
  AlarmPriority,
  type AlarmPriority as AlarmPriorityType,
  AlarmState,
  type AlarmState as AlarmStateType,
  Alarm,
  type Alarm as AlarmType,
  alarmPort,

  // Faceplate Domain
  FaceplateState,
  type FaceplateState as FaceplateStateType,
  faceplatePort,

  // Navigation Domain
  ScreenId,
  type ScreenId as ScreenIdType,
  NavigationState,
  type NavigationState as NavigationStateType,
  navPort,

  // Chart Domain
  ChartId,
  type ChartId as ChartIdType,
  ChartDataPoint,
  type ChartDataPoint as ChartDataPointType,
  ChartTrace,
  type ChartTrace as ChartTraceType,
  chartPort,

  // Grid Domain
  GridId,
  type GridId as GridIdType,
  gridPort,

  // Command Domain
  CommandTarget,
  type CommandTarget as CommandTargetType,
  CommandRequest,
  type CommandRequest as CommandRequestType,
  CommandResult,
  type CommandResult as CommandResultType,
  cmdPort,
} from "./types"

// ─────────────────────────────────────────────────────────────
// TagBinding Overlay
// ─────────────────────────────────────────────────────────────

export {
  createTagBindingOverlay,
  useTagBinding,
  createTagValue,
  qualityMeetsThreshold,
  getQualityColor,
  type TagBindingConfig,
  type UseTagBindingResult,
  type UseTagBindingOptions,
} from "./TagBindingOverlay"

// ─────────────────────────────────────────────────────────────
// Alarm Overlay
// ─────────────────────────────────────────────────────────────

export {
  createAlarmOverlay,
  useAlarm,
  createAlarm,
  applyAlarmAction,
  getPriorityColor,
  getStateStyle,
  type AlarmOverlayConfig,
  type AlarmAction,
  type UseAlarmResult,
  type UseAlarmOptions,
} from "./AlarmOverlay"

// ─────────────────────────────────────────────────────────────
// DataGrid Overlay
// ─────────────────────────────────────────────────────────────

export {
  createDataGridOverlay,
  useDataGrid,
  createGridState,
  type DataGridOverlayConfig,
  type GridConfig,
  type GridState,
  type GridSelection,
  type UseDataGridResult,
  type UseDataGridOptions,
} from "./DataGridOverlay"

// ─────────────────────────────────────────────────────────────
// Chart Overlay
// ─────────────────────────────────────────────────────────────

export {
  createChartOverlay,
  useChart,
  createChartTrace,
  createDataPoint,
  generateSineWave,
  addPointToTrace,
  calculateTimeRange,
  getTraceColor,
  type ChartOverlayConfig,
  type ChartType,
  type ChartState,
  type ChartConfig,
  type TimeRange,
  type UseChartResult,
  type UseChartOptions,
} from "./ChartOverlay"

// ─────────────────────────────────────────────────────────────
// Navigation Overlay
// ─────────────────────────────────────────────────────────────

export {
  createNavigationOverlay,
  useNavigation,
  createScreenMeta,
  createScreenRegistry,
  buildBreadcrumbs,
  canNavigateTo,
  type NavigationOverlayConfig,
  type ScreenMetadata,
  type NavigationStateExtended,
  type ScreenTransition,
  type UseNavigationResult,
  type UseNavigationOptions,
} from "./NavigationOverlay"

// ─────────────────────────────────────────────────────────────
// Faceplate Overlay
// ─────────────────────────────────────────────────────────────

export {
  createFaceplateOverlay,
  useFaceplate,
  createFaceplateState,
  calculateFaceplatePosition,
  type FaceplateOverlayConfig,
  type FaceplateType,
  type Position,
  type Anchor,
  type FaceplateStateExtended,
  type UseFaceplateResult,
  type UseFaceplateOptions,
  type FaceplateManagerState,
  type UseFaceplateManagerResult,
  type UseFaceplateManagerOptions,
} from "./FaceplateOverlay"
