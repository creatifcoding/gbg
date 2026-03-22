/**
 * Data Grid Module
 *
 * Modular AG-Grid implementation for TMNL.
 * Works both standalone and as a tldraw shape.
 *
 * Compound component pattern:
 *   <DataGrid id="..." rowData={...}>
 *     <DataGrid.CornerDecorations />
 *     <DataGrid.Header>
 *       <DataGrid.Title title="EMITTERS" />
 *       <DataGrid.SettingsButton />  // Opens variant builder drawer
 *       <DataGrid.StatusIndicator />
 *     </DataGrid.Header>
 *     <DataGrid.Body />
 *   </DataGrid>
 */

// Core component
import { DataGrid as DataGridRoot } from './DataGrid'
export type { DataGridProps } from './DataGrid'

// Context
export { useDataGrid, useDataGridMaybe, DataGridProvider } from './DataGridContext'
export type { DataGridContextValue } from './DataGridContext'

// Compound subcomponents
import { DataGridTitle } from './components/Title'
import { DataGridHeader } from './components/Header'
import { DataGridBody } from './components/Body'
import { DataGridCornerDecorations } from './components/CornerDecorations'
import { DataGridStatusIndicator } from './components/StatusIndicator'
import { DataGridSettingsButton } from './components/SettingsButton'

// Re-export subcomponent types
export type { DataGridTitleProps } from './components/Title'
export type { DataGridHeaderProps } from './components/Header'
export type { DataGridBodyProps } from './components/Body'
export type { DataGridStatusIndicatorProps } from './components/StatusIndicator'
export type { DataGridSettingsButtonProps } from './components/SettingsButton'

// Attach subcomponents to DataGrid for dot-access
type DataGridCompound = typeof DataGridRoot & {
  Title: typeof DataGridTitle
  Header: typeof DataGridHeader
  Body: typeof DataGridBody
  CornerDecorations: typeof DataGridCornerDecorations
  StatusIndicator: typeof DataGridStatusIndicator
  SettingsButton: typeof DataGridSettingsButton
}

const DataGrid = DataGridRoot as DataGridCompound
DataGrid.Title = DataGridTitle
DataGrid.Header = DataGridHeader
DataGrid.Body = DataGridBody
DataGrid.CornerDecorations = DataGridCornerDecorations
DataGrid.StatusIndicator = DataGridStatusIndicator
DataGrid.SettingsButton = DataGridSettingsButton

export { DataGrid }

// Re-export AG-Grid types needed for stagger
export type { RowClassParams } from 'ag-grid-community'

// Types
export type {
  DataGridRow,
  EmitterRow,
  ActorRow,
  GridRow,
  DragPhase,
  Point,
  GridDragEvent,
  DragState,
  GridThemeConfig,
  GridBehaviorConfig,
  GridConfig,
  DragCallbacks,
} from './types'
export { DragPhase as DragPhaseEnum, INITIAL_DRAG_STATE } from './types'

// Theme
export { TMNL_TOKENS, STATUS_COLORS, tmnlDataGridTheme } from './theme'

// Cell renderers
export {
  IdCellRenderer,
  StatusCellRenderer,
  ValueCellRenderer,
  DragHandleRenderer,
  NameCellRenderer,
} from './renderers'

// Services
export {
  GridDragService,
  GridDragServiceLive,
  gridDragStart,
  gridDragMove,
  gridExit,
  canvasEnter,
  canvasMove,
  drop,
  cancel,
} from './services'

// Stagger animation (CSS-based, deprecated)
export {
  useStaggeredEntrance,
  type UseStaggeredEntranceOptions,
  type UseStaggeredEntranceResult,
} from './useStaggeredEntrance'

// Typewriter reveal (anime.js)
export {
  useTypewriterReveal,
  type UseTypewriterRevealOptions,
  type UseTypewriterRevealResult,
} from './useTypewriterReveal'

// Variant Builder
export { VariantBuilder, type VariantBuilderProps } from './VariantBuilder'
