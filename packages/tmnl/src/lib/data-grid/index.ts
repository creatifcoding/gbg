/**
 * TMNL Data Grid Library
 *
 * Headless grid abstractions with Schema-backed types.
 *
 * ## Architecture
 *
 * ```
 * GridVariant (styling + behavior)
 *      │
 *      ▼
 * composeAgGridTheme() ──► AG-Grid Theme
 *      │
 *      ▼
 * <AgGridReact theme={...} />
 * ```
 *
 * ## Usage
 *
 * ```tsx
 * import { tmnlDenseDark, composeAgGridTheme } from '@/lib/data-grid'
 *
 * const theme = composeAgGridTheme(tmnlDenseDark)
 *
 * <AgGridReact theme={theme} ... />
 * ```
 */

// =============================================================================
// SCHEMAS
// =============================================================================

export {
  // Density
  DensityTier,
  DensityConfig,
  DENSITY_PRESETS,
  getDensityConfig,

  // Column Intent
  ColumnIntent,
  ColumnIntentMeta,
  INTENT_DEFAULTS,
  getIntentDefaults,

  // Color Semantics
  HexColor,
  CssColor,
  BackgroundColors,
  TextColors,
  SignalColors,
  BorderColors,
  FlashColors,
  ColorSemantics,

  // Behavior
  SelectionMode,
  HoverMode,
  FocusMode,
  EditTrigger,
  KeyboardNavMode,
  MicroInteractions,
  ResizeBehavior,
  SortBehavior,
  DragBehavior,
  BehaviorConfig,
  BEHAVIOR_PRESETS,

  // Variant
  VariantId,
  TypographyConfig,
  IntentOverrides,
  GridVariant,
  GridVariantPartial,
} from './schemas'

export type {
  DensityTierType,
  DensityConfigType,
  ColumnIntentType,
  ColumnIntentMetaType,
  HexColorType,
  CssColorType,
  BackgroundColorsType,
  TextColorsType,
  SignalColorsType,
  BorderColorsType,
  FlashColorsType,
  ColorSemanticsType,
  SelectionModeType,
  HoverModeType,
  FocusModeType,
  EditTriggerType,
  KeyboardNavModeType,
  MicroInteractionsType,
  BehaviorConfigType,
  BehaviorPreset,
  VariantIdType,
  TypographyConfigType,
  IntentOverridesType,
  GridVariantType,
  GridVariantPartialType,
} from './schemas'

// =============================================================================
// VARIANTS
// =============================================================================

export {
  tmnlDenseDark,
  tmnlDenseDarkMuted,
  tmnlUltraOps,
  tmnlAnalystLight,
  rvnBrutalist,
  GRID_VARIANTS,
  DEFAULT_VARIANT,
} from './variants'

// =============================================================================
// COMPOSER
// =============================================================================

export {
  composeAgGridTheme,
  extractStatusColors,
  extractFlashConfig,
} from './composer'

// =============================================================================
// THEME (Direct Token Access)
// =============================================================================

export {
  // Token sets
  COLORS,
  TYPOGRAPHY,
  SPACING,
  DIMENSIONS,
  ANIMATION,
  TMNL_TOKENS,
  // Semantic colors
  STATUS_COLORS,
  FLASH_COLORS,
  // Direct theme builder (bypass variants)
  createDirectTheme,
  // Types
  type TmnlTokens,
  type StatusColors,
  type FlashColors,
} from './theme'

// =============================================================================
// MOCKING
// =============================================================================

export {
  // Schemas
  MockRowStatus,
  MockRow,
  RowUpdate,
  StreamEvent,
  StreamConfig,
  DEFAULT_STREAM_CONFIG,
  // Generators
  generateMockRow,
  generateMockRows,
  applyRandomUpdates,
  // Streams
  createMockDataStream,
  createFiniteMockStream,
  // Operators
  filterUpdatesOnly,
  mapToRows,
  throttleStream,
} from './mocking'

// =============================================================================
// HOOKS
// =============================================================================

export { useMockStream, useGridDrag } from './hooks'
export type {
  UseMockStreamOptions,
  UseMockStreamResult,
  UseGridDragOptions,
  UseGridDragResult,
} from './hooks'

// =============================================================================
// FLASH SYSTEM
// =============================================================================

export {
  // Severity
  calculateSeverity,
  calculateIntensity,
  createFlashState,
  // Styles
  generateFlashStyles,
  generateFlashAnimation,
  // Tracker
  createFlashTracker,
  // Hook
  useFlashTracker,
  // Keyframes
  injectFlashKeyframes,
} from './flash'
export type {
  FlashSeverity,
  FlashState,
  FlashStyleConfig,
  FlashTracker,
  UseFlashTrackerOptions,
  UseFlashTrackerResult,
} from './flash'

// =============================================================================
// TYPES (Schema-backed)
// =============================================================================

export {
  // Primitives
  Point,
  GridId,
  CellId,
  makeCellId,
  parseCellId,
  // Row data
  RowStatus,
  DataGridRow,
  EmitterRow,
  ActorRow,
  AssetRow,
  EventRow,
  GridRow,
  // Drag system
  DragPhase,
  DragPhaseEnum,
  DragState,
  INITIAL_DRAG_STATE,
  // Drag events
  GridDragStart,
  GridDragMove,
  GridExit,
  CanvasEnter,
  CanvasMove,
  Drop,
  Cancel,
  GridDragEvent,
  // Flash system
  FlashSeverity,
  FlashDirection,
  FlashState,
  // Legacy compat
  type GridThemeConfig,
  type GridBehaviorConfig,
  type GridConfig,
  type DragCallbacks,
  type OnDragStart,
  type OnGridExit,
  type OnDrop,
  type OnCancel,
} from './types'

// Re-export types for convenience
export type {
  Point as PointType,
  GridId as GridIdType,
  CellId as CellIdType,
  RowStatus as RowStatusType,
  DataGridRow as DataGridRowType,
  EmitterRow as EmitterRowType,
  ActorRow as ActorRowType,
  AssetRow as AssetRowType,
  EventRow as EventRowType,
  GridRow as GridRowType,
  DragPhase as DragPhaseType,
  DragState as DragStateType,
  GridDragEvent as GridDragEventType,
  FlashSeverity as FlashSeverityType,
  FlashDirection as FlashDirectionType,
  FlashState as FlashStateType,
} from './types'

// =============================================================================
// SERVICES
// =============================================================================

export {
  // GridDragService
  GridDragService,
  GridDragServiceLive,
  type GridDragServiceApi,
  gridDragStart,
  gridDragMove,
  gridExit,
  canvasEnter,
  canvasMove,
  drop,
  cancel,
  // FlashTrackingService
  FlashTrackingService,
  FlashTrackingServiceLive,
  FlashTrackingServiceCustom,
  type FlashTrackingServiceApi,
  type FlashTrackingConfig,
  defaultFlashTrackingConfig,
  DEFAULT_FLASH_TTL,
  DEFAULT_MAX_DELTA,
  // Runtime factory
  createGridServicesLayer,
  createDataGridRuntime,
  type DataGridRuntime,
} from './services'

// =============================================================================
// RENDERERS
// =============================================================================

export {
  IdCellRenderer,
  StatusCellRenderer,
  ValueCellRenderer,
  DragHandleRenderer,
  NameCellRenderer,
  type StatusType,
  type ValueCellRendererParams,
} from './renderers'

// =============================================================================
// ADAPTERS
// =============================================================================

export {
  useCanvasDrop,
  type UseCanvasDropOptions,
  type UseCanvasDropResult,
} from './adapters'

// =============================================================================
// A/B TESTING
// =============================================================================

export {
  setDataGridImplementation,
  getDataGridImplementation,
  DataGridABProvider,
  useDataGridAB,
  useIsUnifiedDataGrid,
  type DataGridImplementation,
  type DataGridABProviderProps,
} from './ab'

// =============================================================================
// COMPONENTS
// =============================================================================

// Legacy TmnlDataGrid (keeping for A/B testing)
export {
  TmnlDataGrid,
  type TmnlDataGridProps,
  type TmnlDataGridHandle,
  type TmnlGridContext,
  type FlashConfig,
} from './components'

// New unified context system
export {
  DataGridProvider,
  useDataGridContext,
  useDataGridContextMaybe,
  useGridId,
  useGridRuntime,
  useGridVariant,
  type DataGridContextValue,
  type DataGridProviderProps,
} from './components'

// New unified compound DataGrid (for A/B testing)
// Internal exports (for advanced use cases)
export {
  UnifiedDataGrid,
  UnifiedDataGridHeader,
  UnifiedDataGridTitle,
  UnifiedDataGridSettingsButton,
  UnifiedDataGridBody,
  UnifiedDataGridStatusBar,
  UnifiedDataGridCornerDecorations,
  type UnifiedDataGridProps,
  type UnifiedDataGridHandle,
  type UnifiedDataGridHeaderProps,
  type UnifiedDataGridTitleProps,
  type UnifiedDataGridSettingsButtonProps,
  type UnifiedDataGridBodyProps,
  type UnifiedDataGridStatusBarProps,
  type UnifiedDataGridCornerDecorationsProps,
} from './components'

// =============================================================================
// TMNL NAMESPACE (Primary API)
// =============================================================================
// Usage: <Tmnl.DataGrid id="emitters" variant={tmnlDenseDark} rowData={data}>
//          <Tmnl.DataGrid.Header>
//            <Tmnl.DataGrid.Title title="EMITTERS" />
//          </Tmnl.DataGrid.Header>
//          <Tmnl.DataGrid.Body />
//        </Tmnl.DataGrid>

import { UnifiedDataGrid as _DataGrid } from './components'

/**
 * TMNL Namespace
 *
 * Primary API for the data grid system. Each grid instance gets its own
 * DataManager + TableService runtime via DataGridProvider.
 */
export const Tmnl = {
  /**
   * Compound DataGrid component with STX-native runtime.
   *
   * @example
   * ```tsx
   * <Tmnl.DataGrid id="emitters" variant={tmnlDenseDark} rowData={data}>
   *   <Tmnl.DataGrid.Header>
   *     <Tmnl.DataGrid.Title title="EMITTERS" badge={data.length} />
   *     <Tmnl.DataGrid.SettingsButton />
   *   </Tmnl.DataGrid.Header>
   *   <Tmnl.DataGrid.Body />
   *   <Tmnl.DataGrid.StatusBar>
   *     <span>Ready</span>
   *   </Tmnl.DataGrid.StatusBar>
   * </Tmnl.DataGrid>
   * ```
   */
  DataGrid: _DataGrid,
} as const
