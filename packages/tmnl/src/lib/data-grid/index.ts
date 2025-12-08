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

export { useMockStream } from './hooks'
export type { UseMockStreamOptions, UseMockStreamResult } from './hooks'

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
// COMPONENTS
// =============================================================================

export {
  TmnlDataGrid,
  type TmnlDataGridProps,
  type TmnlDataGridHandle,
  type TmnlGridContext,
  type FlashConfig,
} from './components'
