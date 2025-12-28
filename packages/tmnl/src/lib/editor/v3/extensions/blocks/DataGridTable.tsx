/**
 * DataGridTable Extension
 *
 * Custom table block that renders as TmnlDataGrid (AG-Grid).
 * Parses markdown table syntax and stores data as JSON.
 *
 * @module editor/v3/extensions/blocks/DataGridTable
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import type { ColDef, GridApi } from 'ag-grid-community';
import type { NodeViewProps } from '@tiptap/react';

import { TmnlDataGrid, type TmnlDataGridHandle } from '@/lib/data-grid/components/TmnlDataGrid';
import { tmnlDenseDark } from '@/lib/data-grid/variants';
import { VANTA_COLORS, VANTA_BORDERS, VANTA_SPACING } from '@/components/portal/tokens';
import { GripVertical, X, Plus, Minus } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface TableData {
  /** Column headers */
  headers: string[];
  /** Row data (array of arrays) */
  rows: string[][];
}

export interface DataGridTableOptions {
  /** HTML attributes for the container */
  HTMLAttributes: Record<string, unknown>;
  /** Default variant for the grid */
  defaultVariant?: typeof tmnlDenseDark;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    dataGridTable: {
      /** Insert a data grid table */
      insertTable: (options?: { rows?: number; cols?: number; withHeaderRow?: boolean }) => ReturnType;
      /** Delete the current table */
      deleteTable: () => ReturnType;
    };
  }
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Parse markdown table into TableData
 */
export function parseMarkdownTable(markdown: string): TableData {
  const lines = markdown.trim().split('\n').filter((line) => line.trim());

  if (lines.length < 2) {
    return { headers: [], rows: [] };
  }

  // Parse header row
  const headerLine = lines[0];
  const headers = headerLine
    .split('|')
    .map((cell) => cell.trim())
    .filter((cell) => cell);

  // Skip separator line (lines[1])
  // Parse data rows
  const rows = lines.slice(2).map((line) =>
    line
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell) => cell)
  );

  return { headers, rows };
}

/**
 * Convert TableData to markdown table
 */
export function tableDataToMarkdown(data: TableData): string {
  if (data.headers.length === 0) {
    return '';
  }

  const headerRow = `| ${data.headers.join(' | ')} |`;
  const separatorRow = `| ${data.headers.map(() => '---').join(' | ')} |`;
  const dataRows = data.rows.map((row) => `| ${row.join(' | ')} |`);

  return [headerRow, separatorRow, ...dataRows].join('\n');
}

/**
 * Create empty table data
 */
function createEmptyTableData(rows: number, cols: number): TableData {
  return {
    headers: Array.from({ length: cols }, (_, i) => `Column ${i + 1}`),
    rows: Array.from({ length: rows }, () => Array.from({ length: cols }, () => '')),
  };
}

/**
 * Convert TableData to AG-Grid format
 */
function tableDataToGridFormat(data: TableData): { columnDefs: ColDef[]; rowData: Record<string, string>[] } {
  const columnDefs: ColDef[] = data.headers.map((header, index) => ({
    field: `col${index}`,
    headerName: header,
    editable: true,
    flex: 1,
    minWidth: 100,
  }));

  const rowData = data.rows.map((row, rowIndex) => {
    const rowObj: Record<string, string> = { id: `row-${rowIndex}` };
    row.forEach((cell, colIndex) => {
      rowObj[`col${colIndex}`] = cell;
    });
    return rowObj;
  });

  return { columnDefs, rowData };
}

/**
 * Convert AG-Grid data back to TableData
 */
function gridDataToTableData(
  columnDefs: ColDef[],
  rowData: Record<string, string>[]
): TableData {
  const headers = columnDefs.map((col) => col.headerName || col.field || '');
  const rows = rowData.map((row) =>
    columnDefs.map((col) => row[col.field || ''] || '')
  );

  return { headers, rows };
}

// =============================================================================
// NodeView Component
// =============================================================================

function DataGridTableView({ node, updateAttributes, selected, editor, deleteNode }: NodeViewProps) {
  const gridRef = useRef<TmnlDataGridHandle>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Parse stored data
  const tableData = useMemo<TableData>(() => {
    try {
      return node.attrs.data || createEmptyTableData(3, 3);
    } catch {
      return createEmptyTableData(3, 3);
    }
  }, [node.attrs.data]);

  // Convert to grid format
  const { columnDefs, rowData } = useMemo(
    () => tableDataToGridFormat(tableData),
    [tableData]
  );

  // Handle cell value changes
  const handleCellValueChanged = useCallback(
    (params: { data: Record<string, string>; colDef: ColDef; newValue: string }) => {
      if (!gridRef.current?.api) return;

      const allRowData: Record<string, string>[] = [];
      gridRef.current.api.forEachNode((node) => {
        if (node.data) allRowData.push(node.data);
      });

      const newTableData = gridDataToTableData(columnDefs, allRowData);
      updateAttributes({ data: newTableData });
    },
    [columnDefs, updateAttributes]
  );

  // Handle delete
  const handleDelete = useCallback(() => {
    deleteNode();
  }, [deleteNode]);

  // Shared button style
  const controlButtonStyle = {
    padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`,
    fontSize: '12px',
    fontFamily: 'var(--tmnl-font-mono)',
    background: 'transparent',
    border: `1px solid ${VANTA_COLORS.surface.border}`,
    color: VANTA_COLORS.text.secondary,
    borderRadius: VANTA_BORDERS.radius.sm,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: VANTA_SPACING['1'],
    transition: 'all 150ms ease',
  };

  const showControls = selected || isHovered;

  return (
    <NodeViewWrapper
      className="tmnl-datagrid-table"
      data-type="dataGridTable"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        margin: '16px 0',
        borderRadius: VANTA_BORDERS.radius.md,
        overflow: 'hidden',
        border: selected
          ? `1px solid ${VANTA_COLORS.accent.cyan}`
          : `1px solid ${VANTA_COLORS.surface.border}`,
        transition: 'border-color 150ms ease',
        position: 'relative',
      }}
    >
      {/* Header bar with drag handle and close button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`,
          background: VANTA_COLORS.surface.elevated,
          borderBottom: `1px solid ${VANTA_COLORS.surface.border}`,
          opacity: showControls ? 1 : 0.5,
          transition: 'opacity 150ms ease',
        }}
      >
        {/* Drag handle */}
        <div
          data-drag-handle
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: VANTA_SPACING['2'],
            cursor: 'grab',
            color: VANTA_COLORS.text.muted,
            padding: VANTA_SPACING['1'],
            borderRadius: VANTA_BORDERS.radius.sm,
          }}
          title="Drag to reorder"
        >
          <GripVertical size={14} />
          <span style={{
            fontSize: '11px',
            fontFamily: 'var(--tmnl-font-mono)',
            color: VANTA_COLORS.text.tertiary,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Data Grid
          </span>
        </div>

        {/* Close button */}
        {editor.isEditable && (
          <button
            onClick={handleDelete}
            style={{
              padding: VANTA_SPACING['1'],
              background: 'transparent',
              border: 'none',
              color: VANTA_COLORS.text.muted,
              cursor: 'pointer',
              borderRadius: VANTA_BORDERS.radius.sm,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 150ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = VANTA_COLORS.accent.roseGlow;
              e.currentTarget.style.color = VANTA_COLORS.accent.rose;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = VANTA_COLORS.text.muted;
            }}
            title="Delete table"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Grid container */}
      <div
        style={{
          height: Math.min(300, 40 + rowData.length * 32),
          minHeight: 120,
        }}
      >
        <TmnlDataGrid
          ref={gridRef}
          variant={tmnlDenseDark}
          rowData={rowData}
          columnDefs={columnDefs}
          getRowId={(params) => params.data.id}
          onCellValueChanged={handleCellValueChanged}
          autoSizeOnReady={false}
          style={{ height: '100%', width: '100%' }}
        />
      </div>

      {/* Table controls - only show when selected */}
      {selected && editor.isEditable && (
        <div
          style={{
            display: 'flex',
            gap: VANTA_SPACING['2'],
            padding: VANTA_SPACING['2'],
            background: VANTA_COLORS.surface.elevated,
            borderTop: `1px solid ${VANTA_COLORS.surface.border}`,
          }}
        >
          <button
            onClick={() => {
              const newData = {
                ...tableData,
                rows: [...tableData.rows, Array(tableData.headers.length).fill('')],
              };
              updateAttributes({ data: newData });
            }}
            style={controlButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = VANTA_COLORS.accent.cyanMuted;
              e.currentTarget.style.color = VANTA_COLORS.accent.cyan;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = VANTA_COLORS.surface.border;
              e.currentTarget.style.color = VANTA_COLORS.text.secondary;
            }}
          >
            <Plus size={12} /> Row
          </button>
          <button
            onClick={() => {
              const newData = {
                headers: [...tableData.headers, `Column ${tableData.headers.length + 1}`],
                rows: tableData.rows.map((row) => [...row, '']),
              };
              updateAttributes({ data: newData });
            }}
            style={controlButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = VANTA_COLORS.accent.cyanMuted;
              e.currentTarget.style.color = VANTA_COLORS.accent.cyan;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = VANTA_COLORS.surface.border;
              e.currentTarget.style.color = VANTA_COLORS.text.secondary;
            }}
          >
            <Plus size={12} /> Column
          </button>

          <div style={{ flex: 1 }} />

          <button
            onClick={() => {
              if (tableData.rows.length > 1) {
                const newData = {
                  ...tableData,
                  rows: tableData.rows.slice(0, -1),
                };
                updateAttributes({ data: newData });
              }
            }}
            disabled={tableData.rows.length <= 1}
            style={{
              ...controlButtonStyle,
              color: tableData.rows.length > 1 ? VANTA_COLORS.accent.rose : VANTA_COLORS.text.muted,
              opacity: tableData.rows.length > 1 ? 1 : 0.5,
              cursor: tableData.rows.length > 1 ? 'pointer' : 'not-allowed',
            }}
          >
            <Minus size={12} /> Row
          </button>
          <button
            onClick={() => {
              if (tableData.headers.length > 1) {
                const newData = {
                  headers: tableData.headers.slice(0, -1),
                  rows: tableData.rows.map((row) => row.slice(0, -1)),
                };
                updateAttributes({ data: newData });
              }
            }}
            disabled={tableData.headers.length <= 1}
            style={{
              ...controlButtonStyle,
              color: tableData.headers.length > 1 ? VANTA_COLORS.accent.rose : VANTA_COLORS.text.muted,
              opacity: tableData.headers.length > 1 ? 1 : 0.5,
              cursor: tableData.headers.length > 1 ? 'pointer' : 'not-allowed',
            }}
          >
            <Minus size={12} /> Column
          </button>
        </div>
      )}
    </NodeViewWrapper>
  );
}

// =============================================================================
// Extension
// =============================================================================

export const DataGridTable = Node.create<DataGridTableOptions>({
  name: 'dataGridTable',

  addOptions() {
    return {
      HTMLAttributes: {},
      defaultVariant: tmnlDenseDark,
    };
  },

  group: 'block',

  atom: true,

  selectable: true,

  draggable: true,

  addAttributes() {
    return {
      data: {
        default: createEmptyTableData(3, 3),
        parseHTML: (element) => {
          const dataAttr = element.getAttribute('data-table');
          if (dataAttr) {
            try {
              return JSON.parse(dataAttr);
            } catch {
              return createEmptyTableData(3, 3);
            }
          }
          // Try to parse from table HTML
          const headers: string[] = [];
          const rows: string[][] = [];

          element.querySelectorAll('th').forEach((th) => {
            headers.push(th.textContent || '');
          });

          element.querySelectorAll('tbody tr').forEach((tr) => {
            const row: string[] = [];
            tr.querySelectorAll('td').forEach((td) => {
              row.push(td.textContent || '');
            });
            rows.push(row);
          });

          if (headers.length > 0) {
            return { headers, rows };
          }

          return createEmptyTableData(3, 3);
        },
        renderHTML: (attributes) => {
          return {
            'data-table': JSON.stringify(attributes.data),
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="dataGridTable"]',
      },
      {
        tag: 'table',
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const data = node.attrs.data as TableData;

    // Render as HTML table for non-React contexts (e.g., HTML export)
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'dataGridTable',
        'data-table': JSON.stringify(data),
      }),
      [
        'table',
        [
          'thead',
          [
            'tr',
            ...data.headers.map((header) => ['th', header]),
          ],
        ],
        [
          'tbody',
          ...data.rows.map((row) => [
            'tr',
            ...row.map((cell) => ['td', cell]),
          ]),
        ],
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DataGridTableView);
  },

  addCommands() {
    return {
      insertTable:
        (options = {}) =>
        ({ commands }) => {
          const { rows = 3, cols = 3 } = options;
          return commands.insertContent({
            type: this.name,
            attrs: {
              data: createEmptyTableData(rows, cols),
            },
          });
        },
      deleteTable:
        () =>
        ({ commands }) => {
          return commands.deleteNode(this.name);
        },
    };
  },
});
