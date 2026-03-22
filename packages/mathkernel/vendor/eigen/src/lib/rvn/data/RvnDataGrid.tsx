/**
 * RvnDataGrid - AG-Grid wrapper with brutalist RVN theme
 *
 * Wraps AG-Grid v34 with custom theming for the RVN design system.
 * Does NOT include actual AG-Grid dependency - provides theme configuration
 * and wrapper component that consumers use with their AG-Grid instance.
 *
 * @example
 * import { AgGridReact } from 'ag-grid-react'
 * import { RvnDataGrid, rvnGridTheme } from '@/lib/rvn'
 *
 * <RvnDataGrid>
 *   <AgGridReact
 *     theme={rvnGridTheme}
 *     rowData={data}
 *     columnDefs={columns}
 *   />
 * </RvnDataGrid>
 */

import * as React from 'react'
import {
  RVN_COLORS,
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_BORDERS,
  RVN_SPACING,
} from '../tokens'
import { RvnBadge } from '../display/RvnBadge'

// -----------------------------------------------------------------------------
// Theme Configuration (AG-Grid v34 compatible)
// -----------------------------------------------------------------------------

/**
 * RVN theme configuration for AG-Grid
 *
 * Apply this to the AgGridReact component's `theme` prop.
 * Works with AG-Grid v34's theme system.
 *
 * @example
 * import { themeQuartz } from 'ag-grid-community'
 *
 * const myTheme = themeQuartz.withParams(rvnGridThemeParams)
 *
 * <AgGridReact theme={myTheme} />
 */
export const rvnGridThemeParams = {
  // Header
  headerBackgroundColor: RVN_COLORS.black,
  headerTextColor: RVN_COLORS.white,
  headerFontFamily: RVN_FONTS.mono,
  headerFontSize: 12, // THE FLOOR
  headerFontWeight: RVN_FONT_WEIGHTS.bold,

  // Rows
  backgroundColor: RVN_COLORS.surface,
  oddRowBackgroundColor: RVN_COLORS.surface,
  rowHoverColor: RVN_COLORS.surfaceHighlight,
  selectedRowBackgroundColor: RVN_COLORS.black,
  rowBorder: true,

  // Cells
  foregroundColor: RVN_COLORS.textMain,
  fontFamily: RVN_FONTS.mono,
  fontSize: 13,
  cellTextColor: RVN_COLORS.textMain,

  // Borders
  borderColor: RVN_COLORS.borderMuted,
  borderRadius: 0, // NO radius - EVER
  wrapperBorderRadius: 0,

  // Spacing
  cellHorizontalPadding: 10,
  headerHeight: 40,
  rowHeight: 36,

  // Grid chrome
  accentColor: RVN_COLORS.black,
  chromeBackgroundColor: RVN_COLORS.surface,
} as const

/**
 * CSS overrides for RVN styling beyond theme params
 * Apply these styles to the grid container or via global CSS
 */
export const rvnGridCssOverrides = `
  /* Header row - uppercase, wide letter spacing */
  .ag-header-cell-text {
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Selected row text - invert to white */
  .ag-row-selected .ag-cell {
    color: ${RVN_COLORS.textInverse} !important;
  }

  /* Cell focus ring - 2px solid black */
  .ag-cell-focus {
    outline: 2px solid ${RVN_COLORS.black} !important;
    outline-offset: -2px;
  }

  /* Header bottom border */
  .ag-header {
    border-bottom: 2px solid ${RVN_COLORS.black} !important;
  }

  /* Row bottom border */
  .ag-row {
    border-bottom: 1px solid ${RVN_COLORS.borderMuted} !important;
  }

  /* Remove inner cell borders */
  .ag-cell {
    border-right: none !important;
  }

  /* Header cell right border */
  .ag-header-cell {
    border-right: 1px solid rgba(255, 255, 255, 0.2) !important;
  }

  .ag-header-cell:last-child {
    border-right: none !important;
  }

  /* Pinned columns accent border */
  .ag-pinned-left-cols-container {
    border-right: 3px solid ${RVN_COLORS.black} !important;
  }

  .ag-pinned-right-cols-container {
    border-left: 3px solid ${RVN_COLORS.black} !important;
  }

  /* Scrollbar styling - thin and black */
  .ag-body-vertical-scroll-viewport::-webkit-scrollbar,
  .ag-body-horizontal-scroll-viewport::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .ag-body-vertical-scroll-viewport::-webkit-scrollbar-thumb,
  .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb {
    background: ${RVN_COLORS.black};
  }

  .ag-body-vertical-scroll-viewport::-webkit-scrollbar-track,
  .ag-body-horizontal-scroll-viewport::-webkit-scrollbar-track {
    background: ${RVN_COLORS.surfaceHighlight};
  }
` as const

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RvnDataGridProps {
  /** AG-Grid component as child */
  children: React.ReactNode
  /** Additional class name */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
  /** Show outer 3px border */
  bordered?: boolean
  /** Inject CSS overrides (default: true) */
  injectStyles?: boolean
}

export type RvnStatusCellRendererStatus =
  | 'active'
  | 'inactive'
  | 'pending'
  | 'error'
  | 'warning'
  | 'success'
  | 'offline'

export interface RvnStatusCellRendererProps {
  /** Status value */
  value?: RvnStatusCellRendererStatus | string
  /** Custom status to badge variant mapping */
  variantMap?: Record<string, 'default' | 'filled' | 'muted'>
}

export interface RvnTelemetryCellRendererProps {
  /** Percentage value (0-100) */
  value?: number
  /** Critical threshold (default: 30) */
  criticalThreshold?: number
  /** Show percentage label */
  showLabel?: boolean
}

export interface RvnActionsCellRendererProps {
  /** Action buttons to render */
  actions: Array<{
    /** Icon element */
    icon: React.ReactNode
    /** Button title (required for a11y) */
    title: string
    /** Click handler - receives row data */
    onClick: (data: unknown) => void
    /** Disable this action */
    disabled?: boolean
  }>
  /** Row data (passed by AG-Grid) */
  data?: unknown
}

// -----------------------------------------------------------------------------
// Wrapper Component
// -----------------------------------------------------------------------------

const wrapperStyles = (bordered: boolean): React.CSSProperties => ({
  position: 'relative',
  width: '100%',
  height: '100%',
  border: bordered ? RVN_BORDERS.primary : 'none',
  background: RVN_COLORS.surface,
  overflow: 'hidden',
})

/**
 * RvnDataGrid - Container wrapper for AG-Grid with RVN styling
 *
 * Provides:
 * - 3px brutalist border (optional)
 * - CSS override injection
 * - Styling context
 *
 * @example
 * ```tsx
 * import { AgGridReact } from 'ag-grid-react'
 * import { RvnDataGrid } from '@/lib/rvn'
 *
 * <RvnDataGrid bordered>
 *   <AgGridReact
 *     theme={myTheme}
 *     rowData={data}
 *     columnDefs={columns}
 *   />
 * </RvnDataGrid>
 * ```
 */
export function RvnDataGrid({
  children,
  className,
  style,
  bordered = true,
  injectStyles = true,
}: RvnDataGridProps) {
  const styleId = 'rvn-datagrid-styles'

  // Inject CSS overrides once
  React.useEffect(() => {
    if (!injectStyles) return
    if (typeof document === 'undefined') return
    if (document.getElementById(styleId)) return

    const styleElement = document.createElement('style')
    styleElement.id = styleId
    styleElement.textContent = rvnGridCssOverrides
    document.head.appendChild(styleElement)

    return () => {
      const existing = document.getElementById(styleId)
      if (existing) {
        document.head.removeChild(existing)
      }
    }
  }, [injectStyles])

  return (
    <div
      className={className}
      style={{
        ...wrapperStyles(bordered),
        ...style,
      }}
      data-rvn-datagrid=""
    >
      {children}
    </div>
  )
}

RvnDataGrid.displayName = 'RvnDataGrid'

// -----------------------------------------------------------------------------
// Status Cell Renderer
// -----------------------------------------------------------------------------

const DEFAULT_STATUS_VARIANT_MAP: Record<string, 'default' | 'filled' | 'muted'> = {
  active: 'filled',
  success: 'filled',
  inactive: 'muted',
  offline: 'muted',
  pending: 'default',
  warning: 'default',
  error: 'filled',
}

const statusCellStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  height: '100%',
}

/**
 * RvnStatusCellRenderer - Badge-style status cells for AG-Grid
 *
 * Uses RvnBadge internally for consistent styling.
 *
 * @example Column def
 * ```ts
 * {
 *   field: 'status',
 *   cellRenderer: RvnStatusCellRenderer,
 *   cellRendererParams: {
 *     variantMap: {
 *       active: 'filled',
 *       pending: 'default',
 *       inactive: 'muted',
 *     }
 *   }
 * }
 * ```
 */
export function RvnStatusCellRenderer({
  value,
  variantMap = DEFAULT_STATUS_VARIANT_MAP,
}: RvnStatusCellRendererProps) {
  if (!value) return null

  const normalizedValue = String(value).toLowerCase()
  const variant = variantMap[normalizedValue] ?? 'default'
  const displayValue = String(value).toUpperCase().replace(/_/g, ' ')

  return (
    <div style={statusCellStyles}>
      <RvnBadge variant={variant}>{displayValue}</RvnBadge>
    </div>
  )
}

RvnStatusCellRenderer.displayName = 'RvnStatusCellRenderer'

// -----------------------------------------------------------------------------
// Telemetry Cell Renderer
// -----------------------------------------------------------------------------

/**
 * Exact diagonal stripe pattern from RvnTelemetryBar
 */
const CRITICAL_STRIPE_PATTERN =
  'repeating-linear-gradient(45deg, #000, #000 3px, #fff 3px, #fff 6px)'

const telemetryCellStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  height: '100%',
  paddingRight: '4px',
}

const telemetryTrackStyles: React.CSSProperties = {
  flex: 1,
  height: '16px',
  background: RVN_COLORS.surfaceHighlight,
  border: `1px solid ${RVN_COLORS.black}`,
  position: 'relative',
  overflow: 'hidden',
}

const telemetryFillStyles = (
  percentage: number,
  isCritical: boolean
): React.CSSProperties => ({
  width: `${Math.min(100, Math.max(0, percentage))}%`,
  height: '100%',
  background: isCritical ? CRITICAL_STRIPE_PATTERN : RVN_COLORS.black,
  transition: 'width 0.2s ease-out',
})

const telemetryLabelStyles: React.CSSProperties = {
  fontSize: RVN_FONT_SIZES.label, // 12px - THE FLOOR
  fontFamily: RVN_FONTS.mono,
  fontWeight: RVN_FONT_WEIGHTS.semibold,
  minWidth: '36px',
  textAlign: 'right',
}

/**
 * RvnTelemetryCellRenderer - Inline progress bar cells for AG-Grid
 *
 * 16px height progress bar with black fill.
 * Shows striped pattern when value is below critical threshold.
 *
 * @example Column def
 * ```ts
 * {
 *   field: 'battery',
 *   cellRenderer: RvnTelemetryCellRenderer,
 *   cellRendererParams: {
 *     criticalThreshold: 25,
 *     showLabel: true,
 *   }
 * }
 * ```
 */
export function RvnTelemetryCellRenderer({
  value,
  criticalThreshold = 30,
  showLabel = false,
}: RvnTelemetryCellRendererProps) {
  const percentage = typeof value === 'number' ? value : 0
  const clampedPercentage = Math.min(100, Math.max(0, percentage))
  const isCritical = percentage < criticalThreshold

  return (
    <div
      style={telemetryCellStyles}
      role="meter"
      aria-valuenow={clampedPercentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Telemetry: ${clampedPercentage}%${isCritical ? ' (critical)' : ''}`}
    >
      <div style={telemetryTrackStyles}>
        <div style={telemetryFillStyles(clampedPercentage, isCritical)} />
      </div>
      {showLabel && (
        <span style={telemetryLabelStyles}>{clampedPercentage}%</span>
      )}
    </div>
  )
}

RvnTelemetryCellRenderer.displayName = 'RvnTelemetryCellRenderer'

// -----------------------------------------------------------------------------
// Actions Cell Renderer
// -----------------------------------------------------------------------------

const actionsCellStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: '4px',
  height: '100%',
}

const actionButtonStyles = (
  isHovered: boolean,
  disabled: boolean
): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '24px',
  height: '24px',
  padding: 0,
  background: isHovered && !disabled ? RVN_COLORS.black : 'transparent',
  border: `1px solid ${RVN_COLORS.black}`,
  borderRadius: 0,
  color: isHovered && !disabled ? RVN_COLORS.white : RVN_COLORS.textMain,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? RVN_COLORS.disabledOpacity : 1,
  transition: 'all 0.15s ease',
})

/**
 * Internal action button component with hover state
 */
function ActionButton({
  icon,
  title,
  onClick,
  disabled = false,
  data,
}: {
  icon: React.ReactNode
  title: string
  onClick: (data: unknown) => void
  disabled?: boolean
  data?: unknown
}) {
  const [isHovered, setIsHovered] = React.useState(false)

  const handleClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation() // Prevent row selection
      if (!disabled) {
        onClick(data)
      }
    },
    [disabled, onClick, data]
  )

  return (
    <button
      type="button"
      style={actionButtonStyles(isHovered, disabled)}
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {icon}
    </button>
  )
}

/**
 * RvnActionsCellRenderer - Icon button cells for AG-Grid
 *
 * 24px icon buttons with hover inversion.
 * Prevents row selection on click.
 *
 * @example Column def
 * ```ts
 * {
 *   headerName: '',
 *   width: 100,
 *   cellRenderer: RvnActionsCellRenderer,
 *   cellRendererParams: {
 *     actions: [
 *       {
 *         icon: <EditIcon size={14} />,
 *         title: 'Edit',
 *         onClick: (data) => handleEdit(data),
 *       },
 *       {
 *         icon: <DeleteIcon size={14} />,
 *         title: 'Delete',
 *         onClick: (data) => handleDelete(data),
 *       },
 *     ]
 *   }
 * }
 * ```
 */
export function RvnActionsCellRenderer({
  actions,
  data,
}: RvnActionsCellRendererProps) {
  if (!actions || actions.length === 0) return null

  return (
    <div style={actionsCellStyles}>
      {actions.map((action, index) => (
        <ActionButton
          key={index}
          icon={action.icon}
          title={action.title}
          onClick={action.onClick}
          disabled={action.disabled}
          data={data}
        />
      ))}
    </div>
  )
}

RvnActionsCellRenderer.displayName = 'RvnActionsCellRenderer'

// -----------------------------------------------------------------------------
// Column Definition Helpers
// -----------------------------------------------------------------------------

/**
 * Default column properties for RVN grid styling
 *
 * @example
 * const columnDefs = [
 *   { ...rvnDefaultColDef, field: 'name' },
 *   { ...rvnDefaultColDef, field: 'value' },
 * ]
 */
export const rvnDefaultColDef = {
  sortable: true,
  resizable: true,
  filter: true,
  minWidth: 80,
} as const

/**
 * Status column preset
 */
export const rvnStatusColDef = {
  ...rvnDefaultColDef,
  cellRenderer: RvnStatusCellRenderer,
  width: 120,
  filter: false,
} as const

/**
 * Telemetry column preset
 */
export const rvnTelemetryColDef = {
  ...rvnDefaultColDef,
  cellRenderer: RvnTelemetryCellRenderer,
  width: 150,
  filter: false,
  sortable: true,
} as const

/**
 * Actions column preset
 */
export const rvnActionsColDef = {
  headerName: '',
  cellRenderer: RvnActionsCellRenderer,
  width: 100,
  pinned: 'right' as const,
  sortable: false,
  filter: false,
  resizable: false,
  suppressMenu: true,
} as const

