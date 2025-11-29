import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  type TLBaseShape,
  type TLResizeInfo,
  resizeBox,
  stopEventPropagation,
} from 'tldraw';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Table2 } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, type ColDef, type GridReadyEvent, type ICellRendererParams } from 'ag-grid-community';
import { tmnlDataGridTheme, STATUS_COLORS, TMNL_TOKENS } from './data-grid-theme';

// Register all Community modules for ag-grid v34+
ModuleRegistry.registerModules([AllCommunityModule]);

// ============================================
// CUSTOM CELL RENDERERS
// TMNL-styled cell components
// ============================================

function IdCellRenderer(params: ICellRendererParams) {
  return (
    <span style={{
      color: TMNL_TOKENS.colors.textMuted,
      fontSize: TMNL_TOKENS.typography.fontSizeXs,
      letterSpacing: '0.05em',
    }}>
      {params.value}
    </span>
  );
}

function StatusCellRenderer(params: ICellRendererParams) {
  const status = params.value as keyof typeof STATUS_COLORS;
  const color = STATUS_COLORS[status] || STATUS_COLORS.default;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{
        width: '6px',
        height: '6px',
        backgroundColor: color,
        boxShadow: `0 0 4px ${color}60`,
      }} />
      <span style={{
        color,
        fontSize: TMNL_TOKENS.typography.fontSizeXs,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        fontWeight: 500,
      }}>
        {params.value}
      </span>
    </div>
  );
}

function ValueCellRenderer(params: ICellRendererParams) {
  const value = params.value as number;
  const intensity = Math.min(1, value / 100);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
      <span style={{
        color: TMNL_TOKENS.colors.textSecondary,
        fontVariantNumeric: 'tabular-nums',
        minWidth: '24px',
      }}>
        {value}
      </span>
      <div style={{
        flex: 1,
        height: '3px',
        backgroundColor: TMNL_TOKENS.colors.borderMuted,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${intensity * 100}%`,
          height: '100%',
          backgroundColor: TMNL_TOKENS.colors.accentCyan,
          opacity: 0.7,
          transition: 'width 0.2s ease-out',
        }} />
      </div>
    </div>
  );
}

// ============================================
// DATA GRID WIDGET SHAPE
// Embeds ag-grid Community inside tldraw
// ============================================

export interface DataGridRow {
  id: string;
  name: string;
  value: number;
  status: 'active' | 'pending' | 'inactive';
}

export type DataGridWidgetShape = TLBaseShape<
  "data-grid-widget",
  {
    w: number;
    h: number;
    rowData: DataGridRow[];
    title: string;
  }
>;

function DataGridComponent({ shape }: { shape: DataGridWidgetShape }) {
  const { rowData, title, w, h } = shape.props;
  const gridRef = useRef<AgGridReact>(null);
  // Header is 20px (h-5), borders are 2px total
  const gridHeight = h - 22;
  const gridWidth = w - 2; // account for border

  const columnDefs = useMemo<ColDef<DataGridRow>[]>(() => [
    {
      field: 'id',
      headerName: 'ID',
      width: 60,
      suppressSizeToFit: true,
      cellRenderer: IdCellRenderer,
    },
    {
      field: 'name',
      headerName: 'NAME',
      flex: 1,
      editable: true,
      cellStyle: {
        textTransform: 'uppercase',
        letterSpacing: '0.02em',
      },
    },
    {
      field: 'value',
      headerName: 'VALUE',
      width: 100,
      editable: true,
      cellRenderer: ValueCellRenderer,
    },
    {
      field: 'status',
      headerName: 'STATUS',
      width: 100,
      cellRenderer: StatusCellRenderer,
    },
  ], []);

  const defaultColDef = useMemo<ColDef>(() => ({
    resizable: true,
    sortable: true,
  }), []);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    params.api.sizeColumnsToFit();
  }, []);

  // Resize columns when shape dimensions change
  useEffect(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.sizeColumnsToFit();
    }
  }, [w, h]);

  return (
    <div
      className="w-full h-full bg-black border border-neutral-800 flex flex-col overflow-hidden group relative"
      onPointerDown={stopEventPropagation}
      onPointerMove={stopEventPropagation}
      onPointerUp={stopEventPropagation}
      onWheel={stopEventPropagation}
      onKeyDown={stopEventPropagation}
    >
      {/* Corner decorations */}
      <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-neutral-700" />
      <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-neutral-700" />
      <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-neutral-700" />
      <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-neutral-700" />

      {/* Header */}
      <div className="h-5 flex-shrink-0 flex items-center px-2 border-b border-neutral-800 bg-neutral-900/30">
        <Table2 size={10} className="text-neutral-600 mr-1.5" />
        <span className="text-[8px] font-mono uppercase tracking-widest text-neutral-500 group-hover:text-white transition-colors">
          {title}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[7px] font-mono text-neutral-600 uppercase">
            {rowData.length} rows
          </span>
          <div className="w-1.5 h-1.5 bg-cyan-500/70" style={{ boxShadow: '0 0 4px rgba(0, 162, 255, 0.5)' }} />
        </div>
      </div>

      {/* Grid Area - ag-grid requires explicit pixel dimensions */}
      <div style={{ height: gridHeight, width: gridWidth }}>
        <AgGridReact
          ref={gridRef}
          theme={tmnlDataGridTheme}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onGridReady={onGridReady}
          animateRows={true}
          rowSelection="single"
          suppressMovableColumns={true}
        />
      </div>
    </div>
  );
}

export class DataGridWidgetShapeUtil extends BaseBoxShapeUtil<DataGridWidgetShape> {
  static override type = "data-grid-widget" as const;
  static override props = {
    w: T.number,
    h: T.number,
    rowData: T.arrayOf(T.object({
      id: T.string,
      name: T.string,
      value: T.number,
      status: T.string,
    })),
    title: T.string,
  };

  override canResize() {
    return true;
  }

  override canEdit() {
    return false;
  }

  getDefaultProps(): DataGridWidgetShape["props"] {
    return {
      w: 340,
      h: 220,
      title: "DATA_GRID",
      rowData: [
        { id: "001", name: "Alpha Signal", value: 42, status: "active" },
        { id: "002", name: "Beta Channel", value: 87, status: "pending" },
        { id: "003", name: "Gamma Flux", value: 23, status: "active" },
        { id: "004", name: "Delta Wave", value: 56, status: "inactive" },
        { id: "005", name: "Epsilon Core", value: 91, status: "active" },
      ],
    };
  }

  override onResize(shape: DataGridWidgetShape, info: TLResizeInfo<DataGridWidgetShape>) {
    return resizeBox(shape, info);
  }

  override component(shape: DataGridWidgetShape) {
    return (
      <HTMLContainer id={shape.id} style={{ width: "100%", height: "100%", pointerEvents: "all" }}>
        <DataGridComponent shape={shape} />
      </HTMLContainer>
    );
  }

  override indicator(shape: DataGridWidgetShape) {
    return <rect x={0} y={0} width={shape.props.w} height={shape.props.h} />;
  }
}
