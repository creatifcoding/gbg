/**
 * RvnTable - Compound Table Component
 *
 * Brutalist data table following RVN design system:
 * - Black header row with white text, uppercase
 * - 1px borders on rows
 * - Monospace font for data cells
 * - Hover state: #f0f0f0
 * - Selected row: inverted (black bg, white text)
 *
 * @example
 * ```tsx
 * <RvnTable>
 *   <RvnTable.Header>
 *     <RvnTable.HeaderCell>Op ID</RvnTable.HeaderCell>
 *     <RvnTable.HeaderCell>Result</RvnTable.HeaderCell>
 *   </RvnTable.Header>
 *   <RvnTable.Body>
 *     <RvnTable.Row>
 *       <RvnTable.Cell>OP_GHOST</RvnTable.Cell>
 *       <RvnTable.Cell>SUCCESS</RvnTable.Cell>
 *     </RvnTable.Row>
 *   </RvnTable.Body>
 * </RvnTable>
 * ```
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

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface RvnTableContextValue {
  /** Whether rows are selectable */
  selectable: boolean
  /** Currently selected row keys */
  selectedKeys: Set<string>
  /** Callback when row selection changes */
  onSelectionChange?: (keys: Set<string>) => void
}

interface RvnTableProps extends React.HTMLAttributes<HTMLTableElement> {
  children: React.ReactNode
  /** Enable row selection */
  selectable?: boolean
  /** Selected row keys (controlled) */
  selectedKeys?: Set<string>
  /** Callback when selection changes */
  onSelectionChange?: (keys: Set<string>) => void
}

interface RvnTableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode
}

interface RvnTableHeaderCellProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode
  /** Text alignment */
  align?: 'left' | 'center' | 'right'
  /** Column width */
  width?: string | number
}

interface RvnTableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode
}

interface RvnTableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  children: React.ReactNode
  /** Unique key for selection (required if table is selectable) */
  rowKey?: string
  /** Whether this row is selected (controlled via parent) */
  selected?: boolean
  /** Whether this row is disabled */
  disabled?: boolean
}

interface RvnTableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode
  /** Text alignment */
  align?: 'left' | 'center' | 'right'
  /** Use sans-serif font instead of monospace */
  sansSerif?: boolean
  /** Truncate content with ellipsis */
  truncate?: boolean
}

interface RvnTableFooterProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode
}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const RvnTableContext = React.createContext<RvnTableContextValue | null>(null)

function useRvnTableContext(): RvnTableContextValue | null {
  return React.useContext(RvnTableContext)
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = {
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.body, // 13px
    lineHeight: 1.4,
    backgroundColor: RVN_COLORS.surface,
  },

  thead: {
    // Container styles if needed
  },

  headerRow: {
    backgroundColor: RVN_COLORS.black,
    color: RVN_COLORS.white,
  },

  headerCell: {
    padding: `${RVN_SPACING.s} ${RVN_SPACING.s}`, // 10px
    textAlign: 'left' as const,
    fontFamily: RVN_FONTS.sans,
    fontSize: RVN_FONT_SIZES.label, // 12px - THE FLOOR
    fontWeight: RVN_FONT_WEIGHTS.bold,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    borderBottom: `2px solid ${RVN_COLORS.black}`,
    whiteSpace: 'nowrap' as const,
  },

  tbody: {
    // Container styles if needed
  },

  row: {
    backgroundColor: RVN_COLORS.surface,
    borderBottom: `1px solid ${RVN_COLORS.borderMuted}`,
    transition: 'background-color 0.1s ease',
    cursor: 'default',
  },

  rowHoverable: {
    cursor: 'pointer',
  },

  rowHover: {
    backgroundColor: RVN_COLORS.surfaceHighlight, // #f0f0f0
  },

  rowSelected: {
    backgroundColor: RVN_COLORS.black,
    color: RVN_COLORS.white,
  },

  rowDisabled: {
    opacity: RVN_COLORS.disabledOpacity,
    cursor: 'not-allowed',
  },

  cell: {
    padding: `8px ${RVN_SPACING.s}`, // 8px 10px
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.body, // 13px
    verticalAlign: 'middle' as const,
    borderBottom: `1px solid ${RVN_COLORS.borderMuted}`,
  },

  cellSans: {
    fontFamily: RVN_FONTS.sans,
  },

  cellTruncate: {
    maxWidth: '200px',
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
  },

  tfoot: {
    backgroundColor: RVN_COLORS.surfaceMuted,
    borderTop: `2px solid ${RVN_COLORS.black}`,
  },

  footerCell: {
    padding: `${RVN_SPACING.s} ${RVN_SPACING.s}`,
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.label, // 12px
    fontWeight: RVN_FONT_WEIGHTS.semibold,
  },
} as const

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

/**
 * Table Header Section
 */
function RvnTableHeader({ children, style, ...props }: RvnTableHeaderProps) {
  return (
    <thead style={{ ...styles.thead, ...style }} {...props}>
      <tr style={styles.headerRow}>{children}</tr>
    </thead>
  )
}
RvnTableHeader.displayName = 'RvnTable.Header'

/**
 * Table Header Cell
 */
function RvnTableHeaderCell({
  children,
  align = 'left',
  width,
  style,
  ...props
}: RvnTableHeaderCellProps) {
  return (
    <th
      style={{
        ...styles.headerCell,
        textAlign: align,
        width: width,
        ...style,
      }}
      {...props}
    >
      {children}
    </th>
  )
}
RvnTableHeaderCell.displayName = 'RvnTable.HeaderCell'

/**
 * Table Body Section
 */
function RvnTableBody({ children, style, ...props }: RvnTableBodyProps) {
  return (
    <tbody style={{ ...styles.tbody, ...style }} {...props}>
      {children}
    </tbody>
  )
}
RvnTableBody.displayName = 'RvnTable.Body'

/**
 * Table Row
 */
function RvnTableRow({
  children,
  rowKey,
  selected,
  disabled,
  style,
  onClick,
  ...props
}: RvnTableRowProps) {
  const [isHovered, setIsHovered] = React.useState(false)
  const ctx = useRvnTableContext()

  const isSelectable = ctx?.selectable ?? false
  const isSelected = selected ?? (rowKey ? ctx?.selectedKeys.has(rowKey) : false)

  const handleClick = React.useCallback(
    (e: React.MouseEvent<HTMLTableRowElement>) => {
      if (disabled) return

      if (isSelectable && rowKey && ctx?.onSelectionChange) {
        const newKeys = new Set(ctx.selectedKeys)
        if (newKeys.has(rowKey)) {
          newKeys.delete(rowKey)
        } else {
          newKeys.add(rowKey)
        }
        ctx.onSelectionChange(newKeys)
      }

      onClick?.(e)
    },
    [disabled, isSelectable, rowKey, ctx, onClick]
  )

  const computedStyle: React.CSSProperties = {
    ...styles.row,
    ...(isSelectable && !disabled ? styles.rowHoverable : {}),
    ...(isHovered && !disabled && !isSelected ? styles.rowHover : {}),
    ...(isSelected ? styles.rowSelected : {}),
    ...(disabled ? styles.rowDisabled : {}),
    ...style,
  }

  return (
    <tr
      style={computedStyle}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-selected={isSelected ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      {...props}
    >
      {children}
    </tr>
  )
}
RvnTableRow.displayName = 'RvnTable.Row'

/**
 * Table Cell
 */
function RvnTableCell({
  children,
  align = 'left',
  sansSerif,
  truncate,
  style,
  ...props
}: RvnTableCellProps) {
  return (
    <td
      style={{
        ...styles.cell,
        textAlign: align,
        ...(sansSerif ? styles.cellSans : {}),
        ...(truncate ? styles.cellTruncate : {}),
        ...style,
      }}
      {...props}
    >
      {children}
    </td>
  )
}
RvnTableCell.displayName = 'RvnTable.Cell'

/**
 * Table Footer Section
 */
function RvnTableFooter({ children, style, ...props }: RvnTableFooterProps) {
  return (
    <tfoot style={{ ...styles.tfoot, ...style }} {...props}>
      <tr>{children}</tr>
    </tfoot>
  )
}
RvnTableFooter.displayName = 'RvnTable.Footer'

/**
 * Table Footer Cell (alias for Cell with footer styles)
 */
function RvnTableFooterCell({
  children,
  align = 'left',
  style,
  ...props
}: RvnTableCellProps) {
  return (
    <td
      style={{
        ...styles.footerCell,
        textAlign: align,
        ...style,
      }}
      {...props}
    >
      {children}
    </td>
  )
}
RvnTableFooterCell.displayName = 'RvnTable.FooterCell'

// -----------------------------------------------------------------------------
// Root Component
// -----------------------------------------------------------------------------

/**
 * RvnTable - Brutalist Data Table
 *
 * Compound component for displaying tabular data in the RVN design system.
 *
 * Features:
 * - Black header row with white uppercase text
 * - Monospace font for data cells
 * - 1px borders on rows
 * - Hover state (#f0f0f0)
 * - Optional row selection with inverted colors
 */
function RvnTableRoot({
  children,
  selectable = false,
  selectedKeys = new Set<string>(),
  onSelectionChange,
  style,
  ...props
}: RvnTableProps) {
  const contextValue = React.useMemo<RvnTableContextValue>(
    () => ({
      selectable,
      selectedKeys,
      onSelectionChange,
    }),
    [selectable, selectedKeys, onSelectionChange]
  )

  return (
    <RvnTableContext.Provider value={contextValue}>
      <table
        style={{ ...styles.table, ...style }}
        data-rvn-table=""
        {...props}
      >
        {children}
      </table>
    </RvnTableContext.Provider>
  )
}
RvnTableRoot.displayName = 'RvnTable'

// -----------------------------------------------------------------------------
// Compound Component Assembly
// -----------------------------------------------------------------------------

export const RvnTable = Object.assign(RvnTableRoot, {
  Header: RvnTableHeader,
  HeaderCell: RvnTableHeaderCell,
  Body: RvnTableBody,
  Row: RvnTableRow,
  Cell: RvnTableCell,
  Footer: RvnTableFooter,
  FooterCell: RvnTableFooterCell,
})

// -----------------------------------------------------------------------------
// Type Exports
// -----------------------------------------------------------------------------

export type {
  RvnTableProps,
  RvnTableHeaderProps,
  RvnTableHeaderCellProps,
  RvnTableBodyProps,
  RvnTableRowProps,
  RvnTableCellProps,
  RvnTableFooterProps,
}
