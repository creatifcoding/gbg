/**
 * Data Grid Components
 *
 * Wrapper components for AG-Grid with TMNL variant system.
 */

// Legacy TmnlDataGrid (keeping for A/B testing)
export {
  TmnlDataGrid,
  type TmnlDataGridProps,
  type TmnlDataGridHandle,
  type TmnlGridContext,
  type FlashConfig,
} from './TmnlDataGrid'

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
} from './DataGridContext'

// New unified compound DataGrid (for A/B testing)
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
} from './UnifiedDataGrid'
