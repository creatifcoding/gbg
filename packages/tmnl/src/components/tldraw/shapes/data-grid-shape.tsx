import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  type TLBaseShape,
  type TLResizeInfo,
  resizeBox,
  stopEventPropagation,
  useEditor,
  createShapeId,
} from 'tldraw';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Table2, GripVertical } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import {
  ModuleRegistry,
  AllCommunityModule,
  type ColDef,
  type GridReadyEvent,
  type ICellRendererParams,
  type GridApi,
  type RowDropZoneParams,
  type RowDragEnterEvent,
  type RowDragEndEvent,
} from 'ag-grid-community';
import { gsap } from 'gsap';
import { tmnlDataGridTheme, STATUS_COLORS, TMNL_TOKENS } from './data-grid-theme';
import { DragBadge } from './drag-badge';
import { dispatchGridDragEvent } from '../overlays';

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

// Custom drag handle with TMNL styling
function DragHandleRenderer(_params: ICellRendererParams) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        cursor: 'grab',
        color: TMNL_TOKENS.colors.textMuted,
        transition: 'color 0.15s ease',
      }}
      className="drag-handle"
    >
      <GripVertical size={12} />
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

// ============================================
// SPAWN DATA CARD
// Creates a data-card shape on canvas from row data
// ============================================

function spawnDataCard(
  editor: ReturnType<typeof useEditor>,
  rowData: DataGridRow,
  point: { x: number; y: number },
  sourceGridId: string
) {
  console.log('[spawnDataCard] Creating card for:', rowData.name, 'at', point);

  const cardWidth = 180;
  const cardHeight = 100;
  const shapeId = createShapeId();

  try {
    // Create the data card shape
    editor.createShape({
      id: shapeId,
      type: 'data-card',
      x: point.x - cardWidth / 2,
      y: point.y - cardHeight / 2,
      props: {
        w: cardWidth,
        h: cardHeight,
        rowData: rowData,
        sourceGridId: sourceGridId,
      },
    });

    console.log('[spawnDataCard] Created shape:', shapeId);

    // Select the new shape
    editor.select(shapeId);

    // Animate the spawn with GSAP (after a tick for DOM to update)
    requestAnimationFrame(() => {
      // Find the shape element in the DOM
      const shapeEl = document.querySelector(`[data-shape-id="${shapeId}"]`);
      console.log('[spawnDataCard] Shape element:', shapeEl);
      if (shapeEl) {
        gsap.fromTo(
          shapeEl,
          { scale: 0.5, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.7)' }
        );
      }
    });
  } catch (err) {
    console.error('[spawnDataCard] Error creating shape:', err);
  }
}

// ============================================
// DATA GRID COMPONENT
// Uses addRowDropZone API for external drag-out
// ============================================

function DataGridComponent({ shape }: { shape: DataGridWidgetShape }) {
  const editor = useEditor();
  const { rowData, title, w, h } = shape.props;
  const gridRef = useRef<AgGridReact>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gridApiRef = useRef<GridApi | null>(null);
  const dropZoneRef = useRef<RowDropZoneParams | null>(null);

  // Header is 20px (h-5), borders are 2px total
  const gridHeight = h - 22;
  const gridWidth = w - 2; // account for border

  const columnDefs = useMemo<ColDef<DataGridRow>[]>(() => [
    {
      headerName: '',
      width: 28,
      rowDrag: true,
      suppressSizeToFit: true,
      cellRenderer: DragHandleRenderer,
      cellStyle: {
        padding: 0,
      },
    },
    {
      field: 'id',
      headerName: 'ID',
      width: 50,
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
      width: 90,
      editable: true,
      cellRenderer: ValueCellRenderer,
    },
    {
      field: 'status',
      headerName: 'STATUS',
      width: 90,
      cellRenderer: StatusCellRenderer,
    },
  ], []);

  const defaultColDef = useMemo<ColDef>(() => ({
    resizable: true,
    sortable: true,
  }), []);

  // Setup external drop zone on grid ready
  const onGridReady = useCallback((params: GridReadyEvent) => {
    params.api.sizeColumnsToFit();
    gridApiRef.current = params.api;

    // Find the tldraw canvas element to use as drop zone
    const canvasEl = document.querySelector('.tl-container') as HTMLElement;
    if (!canvasEl) {
      console.warn('[AG-Grid] Could not find .tl-container for drop zone');
      return;
    }

    console.log('[AG-Grid] Registering canvas drop zone');

    // Create drop zone for the canvas
    const dropZone: RowDropZoneParams = {
      getContainer: () => canvasEl,
      onDragEnter: (params) => {
        console.log('[AG-Grid] Drag entered canvas');
        const rowData = params.node.data as DataGridRow;

        // Dispatch event for drop zone overlay
        dispatchGridDragEvent('ENTER', { rowName: rowData.name, status: rowData.status });

        // Visual feedback - glow the container (monochrome)
        if (containerRef.current) {
          gsap.to(containerRef.current, {
            borderColor: 'rgba(255, 255, 255, 0.6)',
            boxShadow: '0 0 12px rgba(255, 255, 255, 0.25)',
            duration: 0.2,
          });
        }
      },
      onDragLeave: () => {
        console.log('[AG-Grid] Drag left canvas');

        // Dispatch event for drop zone overlay
        dispatchGridDragEvent('LEAVE');

        // Reset visual feedback
        if (containerRef.current) {
          gsap.to(containerRef.current, {
            borderColor: TMNL_TOKENS.colors.border,
            boxShadow: 'none',
            duration: 0.2,
          });
        }
      },
      onDragStop: (dragParams) => {
        console.log('[AG-Grid] Drop on canvas:', dragParams);

        // Dispatch event for drop zone overlay
        dispatchGridDragEvent('DROP');

        // Reset visual feedback
        if (containerRef.current) {
          gsap.to(containerRef.current, {
            borderColor: TMNL_TOKENS.colors.border,
            boxShadow: 'none',
            duration: 0.2,
          });
        }

        // Get row data and mouse position
        const droppedRowData = dragParams.node.data as DataGridRow;
        const mouseEvent = dragParams.event as MouseEvent;

        if (!droppedRowData || !mouseEvent) {
          console.warn('[AG-Grid] Missing row data or mouse event');
          return;
        }

        const screenPos = { x: mouseEvent.clientX, y: mouseEvent.clientY };
        console.log('[AG-Grid] Screen position:', screenPos);

        // Convert screen coords to tldraw page coords
        const pagePoint = editor.screenToPage(screenPos);
        console.log('[AG-Grid] Page position:', pagePoint);

        // Spawn the data card
        spawnDataCard(editor, droppedRowData, pagePoint, shape.id);
      },
    };

    dropZoneRef.current = dropZone;
    params.api.addRowDropZone(dropZone);
  }, [editor, shape.id]);

  // Cleanup drop zone on unmount
  useEffect(() => {
    return () => {
      if (gridApiRef.current && dropZoneRef.current) {
        try {
          gridApiRef.current.removeRowDropZone(dropZoneRef.current);
        } catch (e) {
          // Grid may already be destroyed
        }
      }
    };
  }, []);

  // Resize columns when shape dimensions change
  useEffect(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.sizeColumnsToFit();
    }
  }, [w, h]);

  // Row drag enter - highlight source row and grid (monochrome)
  const onRowDragEnter = useCallback((event: RowDragEnterEvent) => {
    console.log('[AG-Grid] Row drag enter:', event.node.data);

    // Highlight the dragged row - monochrome
    const rowEl = event.node.rowElement;
    if (rowEl) {
      gsap.to(rowEl, {
        boxShadow: 'inset 0 0 15px rgba(255, 255, 255, 0.15)',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        duration: 0.2,
        ease: 'power2.out',
      });
    }

    // Glow the grid container - monochrome
    if (containerRef.current) {
      gsap.to(containerRef.current, {
        borderColor: 'rgba(255, 255, 255, 0.5)',
        boxShadow: '0 0 15px rgba(255, 255, 255, 0.2), inset 0 0 20px rgba(255, 255, 255, 0.05)',
        duration: 0.3,
        ease: 'power2.out',
      });
    }
  }, []);

  // Row drag end - reset highlights
  const onRowDragEnd = useCallback((event: RowDragEndEvent) => {
    console.log('[AG-Grid] Row drag end');

    // Reset row highlight
    const rowEl = event.node.rowElement;
    if (rowEl) {
      gsap.to(rowEl, {
        boxShadow: 'none',
        backgroundColor: 'transparent',
        duration: 0.2,
      });
    }

    // Reset grid container
    if (containerRef.current) {
      gsap.to(containerRef.current, {
        borderColor: TMNL_TOKENS.colors.border,
        boxShadow: 'none',
        duration: 0.2,
      });
    }
  }, []);

  // Custom row drag text for the badge
  const rowDragText = useCallback((params: { rowNode: { data: DataGridRow }; defaultTextValue: string }) => {
    return params.rowNode.data.name;
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-black border border-neutral-800 flex flex-col overflow-hidden group relative"
      style={{ transition: 'border-color 0.15s ease' }}
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
          rowDragManaged={true}
          // Custom drag ghost
          dragAndDropImageComponent={DragBadge}
          rowDragText={rowDragText}
          // Row drag feedback
          onRowDragEnter={onRowDragEnter}
          onRowDragEnd={onRowDragEnd}
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
