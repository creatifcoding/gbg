/**
 * DataGridBlockView Component
 *
 * React node view for DataGridBlock in TipTap editor.
 * Uses EmbeddedBlockWrapper for foldable, badged UI with dataplane integration.
 * Embeds AG-Grid with TMNL theming.
 *
 * @module editor/v3/extensions/blocks/DataGridBlock/DataGridBlockView
 */

import {
  useRef,
  useCallback,
  useMemo,
  useEffect,
  useContext,
  useState,
} from 'react';
import { type NodeViewProps } from '@tiptap/react';
import { useAtom, useAtomValue } from '@effect-atom/atom-react';
import type { ColDef, GridApi, RowDataUpdatedEvent } from 'ag-grid-community';
import { Grid3x3, Settings2, Link2, Columns3, Palette } from 'lucide-react';

import {
  VANTA_COLORS,
  VANTA_BORDERS,
  VANTA_SPACING,
} from '@/components/portal/tokens';
import {
  EmbeddedBlockWrapper,
  EmbeddedBlockContext,
  type SettingsTab,
  type BlockBadge,
  type DataplaneConfig,
} from '../EmbeddedBlockWrapper';
import {
  TmnlDataGrid,
  type TmnlDataGridHandle,
} from '@/lib/data-grid/components/TmnlDataGrid';
import {
  tmnlDenseDark,
  tmnlDenseDarkMuted,
  tmnlUltraOps,
  tmnlAnalystLight,
  GRID_VARIANTS,
  DEFAULT_VARIANT,
} from '@/lib/data-grid/variants';
import type { GridVariant } from '@/lib/data-grid/schemas';
import {
  createDataGridBlockAtoms,
  disposeDataGridBlockAtoms,
  DEFAULT_COLUMN_DEFS,
  type DataGridRow,
} from './atoms';

// =============================================================================
// Badge Config
// =============================================================================

const DATA_GRID_BADGE: BlockBadge = {
  tag: 'data-grid',
  label: 'Data Grid',
  icon: Grid3x3,
};

// =============================================================================
// Dataplane Config
// =============================================================================

/**
 * Default dataplane configuration for DataGridBlock.
 * Creates input port (left) for receiving data and output port (right) for sending.
 */
const DATA_GRID_DATAPLANE_CONFIG: DataplaneConfig = {
  enabled: true,
  ports: [
    {
      direction: 'in',
      dataType: 'table',
      position: 'left',
      label: 'Data In',
    },
    {
      direction: 'out',
      dataType: 'table',
      position: 'right',
      label: 'Data Out',
    },
  ],
  showIndicators: true,
};

// =============================================================================
// Settings Components
// =============================================================================

interface ColumnsSettingsProps {
  columnDefs: readonly ColDef[];
  onColumnDefsChange: (defs: readonly ColDef[]) => void;
}

function ColumnsSettings({ columnDefs, onColumnDefsChange }: ColumnsSettingsProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: VANTA_SPACING['2'],
      }}
    >
      <div style={{ color: VANTA_COLORS.text.muted, fontSize: '12px' }}>
        {columnDefs.length} columns configured
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: VANTA_SPACING['1'],
          maxHeight: '150px',
          overflowY: 'auto',
        }}
      >
        {columnDefs.map((col, idx) => (
          <div
            key={col.field || idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: VANTA_SPACING['2'],
              padding: VANTA_SPACING['1'],
              background: VANTA_COLORS.surface.elevated,
              borderRadius: VANTA_BORDERS.radius.sm,
            }}
          >
            <span
              style={{
                color: VANTA_COLORS.text.secondary,
                fontSize: '11px',
                fontFamily: 'var(--tmnl-font-mono)',
              }}
            >
              {col.field || 'unknown'}
            </span>
            <span
              style={{
                color: VANTA_COLORS.text.muted,
                fontSize: '10px',
              }}
            >
              {col.headerName}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface DataSettingsProps {
  rowCount: number;
  dataplaneRowCount: number;
  isLoading: boolean;
}

function DataSettings({ rowCount, dataplaneRowCount, isLoading }: DataSettingsProps) {
  const source = dataplaneRowCount > 0 ? 'dataplane' : 'local';
  const displayCount = dataplaneRowCount > 0 ? dataplaneRowCount : rowCount;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: VANTA_SPACING['2'],
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: VANTA_SPACING['2'],
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: isLoading
              ? VANTA_COLORS.accent.amber
              : VANTA_COLORS.accent.emerald,
            boxShadow: isLoading
              ? `0 0 6px ${VANTA_COLORS.accent.amberGlow}`
              : `0 0 6px ${VANTA_COLORS.accent.emeraldGlow}`,
          }}
        />
        <span style={{ color: VANTA_COLORS.text.secondary, fontSize: '12px' }}>
          {isLoading ? 'Loading...' : `${displayCount} rows (${source})`}
        </span>
      </div>
    </div>
  );
}

interface LinksSettingsProps {
  isReady: boolean;
  portCount: number;
}

function LinksSettings({ isReady, portCount }: LinksSettingsProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: VANTA_SPACING['2'],
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: VANTA_SPACING['2'],
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: isReady
              ? VANTA_COLORS.accent.emerald
              : VANTA_COLORS.accent.amber,
            boxShadow: isReady
              ? `0 0 6px ${VANTA_COLORS.accent.emeraldGlow}`
              : `0 0 6px ${VANTA_COLORS.accent.amberGlow}`,
          }}
        />
        <span style={{ color: VANTA_COLORS.text.secondary, fontSize: '12px' }}>
          {isReady ? `${portCount} ports registered` : 'Registering ports...'}
        </span>
      </div>
      <div
        style={{
          color: VANTA_COLORS.text.muted,
          fontSize: '11px',
          lineHeight: 1.4,
        }}
      >
        Connect this block to other data sources by dragging from port indicators.
        <br />
        <strong>In port</strong> (left): Receives table data
        <br />
        <strong>Out port</strong> (right): Sends filtered/modified data
      </div>
    </div>
  );
}

// =============================================================================
// Variant Settings
// =============================================================================

interface VariantSettingsProps {
  currentVariant: string;
  onVariantChange: (variantId: string) => void;
}

const VARIANT_OPTIONS = [
  { id: 'tmnl-dense-dark', label: 'Dense Dark', description: 'Default dark theme' },
  { id: 'tmnl-dense-dark-muted', label: 'Dark Muted', description: 'Subdued contrast' },
  { id: 'tmnl-ultra-ops', label: 'Ultra Ops', description: 'High density operations' },
  { id: 'tmnl-analyst-light', label: 'Analyst Light', description: 'Light mode for analysis' },
];

function VariantSettings({ currentVariant, onVariantChange }: VariantSettingsProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: VANTA_SPACING['2'],
      }}
    >
      <label style={{ color: VANTA_COLORS.text.muted, fontSize: '12px' }}>
        Grid Variant
      </label>
      <div
        style={{ display: 'flex', gap: VANTA_SPACING['1'], flexWrap: 'wrap' }}
      >
        {VARIANT_OPTIONS.map((variant) => (
          <button
            key={variant.id}
            onClick={() => onVariantChange(variant.id)}
            title={variant.description}
            style={{
              padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`,
              background:
                currentVariant === variant.id
                  ? VANTA_COLORS.accent.cyanGlow
                  : 'transparent',
              border: `1px solid ${
                currentVariant === variant.id
                  ? VANTA_COLORS.accent.cyanMuted
                  : VANTA_COLORS.surface.border
              }`,
              color:
                currentVariant === variant.id
                  ? VANTA_COLORS.accent.cyan
                  : VANTA_COLORS.text.secondary,
              borderRadius: VANTA_BORDERS.radius.sm,
              cursor: 'pointer',
              fontSize: '11px',
              fontFamily: 'var(--tmnl-font-mono)',
            }}
          >
            {variant.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Grid Content
// =============================================================================

interface GridContentProps {
  rowData: readonly DataGridRow[];
  columnDefs: readonly ColDef[];
  variant: GridVariant;
  onGridReady: (api: GridApi) => void;
  onRowDataUpdated: (event: RowDataUpdatedEvent) => void;
}

function GridContent({
  rowData,
  columnDefs,
  variant,
  onGridReady,
  onRowDataUpdated,
}: GridContentProps) {
  const gridRef = useRef<TmnlDataGridHandle>(null);

  const handleGridReady = useCallback(
    (params: { api: GridApi }) => {
      onGridReady(params.api);
    },
    [onGridReady]
  );

  return (
    <TmnlDataGrid
      ref={gridRef}
      variant={variant}
      rowData={rowData as DataGridRow[]}
      columnDefs={columnDefs as ColDef[]}
      onGridReady={handleGridReady}
      onRowDataUpdated={onRowDataUpdated}
      getRowId={(params) => params.data.id}
      autoSizeOnReady={true}
    />
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function DataGridBlockView(nodeViewProps: NodeViewProps) {
  const { node, updateAttributes } = nodeViewProps;
  const blockId = node.attrs.id || 'default';

  // Per-block atoms
  const atoms = useMemo(() => createDataGridBlockAtoms(blockId), [blockId]);

  const [rowData, setRowData] = useAtom(atoms.rowDataAtom);
  const [columnDefs, setColumnDefs] = useAtom(atoms.columnDefsAtom);
  const [isLoading, setIsLoading] = useAtom(atoms.isLoadingAtom);
  const dataplaneRowCount = useAtomValue(atoms.dataplaneRowCountAtom);

  // Variant state - persisted to node attrs
  const [variantId, setVariantId] = useState<string>(
    node.attrs.variantId || 'tmnl-dense-dark'
  );
  const variant = useMemo<GridVariant>(
    () => GRID_VARIANTS[variantId] || DEFAULT_VARIANT,
    [variantId]
  );

  // Grid reference for API access
  const gridApiRef = useRef<GridApi | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => disposeDataGridBlockAtoms(blockId);
  }, [blockId]);

  // Load saved state from node attrs
  useEffect(() => {
    if (node.attrs.rowData && Array.isArray(node.attrs.rowData)) {
      setRowData(node.attrs.rowData);
    }
    if (node.attrs.columnDefs && Array.isArray(node.attrs.columnDefs)) {
      setColumnDefs(node.attrs.columnDefs);
    }
    if (node.attrs.variantId) {
      setVariantId(node.attrs.variantId);
    }
  }, []);

  // Grid event handlers
  const handleGridReady = useCallback((api: GridApi) => {
    gridApiRef.current = api;
  }, []);

  const handleRowDataUpdated = useCallback(
    (event: RowDataUpdatedEvent) => {
      // Persist to node attrs when data changes
      const allData: DataGridRow[] = [];
      event.api.forEachNode((node) => {
        if (node.data) allData.push(node.data);
      });
      updateAttributes({ rowData: allData });
    },
    [updateAttributes]
  );

  // Column change handler
  const handleColumnDefsChange = useCallback(
    (defs: readonly ColDef[]) => {
      setColumnDefs(defs);
      updateAttributes({ columnDefs: defs });
    },
    [setColumnDefs, updateAttributes]
  );

  // Variant change handler
  const handleVariantChange = useCallback(
    (newVariantId: string) => {
      setVariantId(newVariantId);
      updateAttributes({ variantId: newVariantId });
    },
    [updateAttributes]
  );

  // Build tabs
  const tabs: SettingsTab[] = useMemo(
    () => [
      {
        id: 'variant',
        label: 'Style',
        icon: Palette,
        content: (
          <VariantSettings
            currentVariant={variantId}
            onVariantChange={handleVariantChange}
          />
        ),
      },
      {
        id: 'columns',
        label: 'Columns',
        icon: Columns3,
        content: (
          <ColumnsSettings
            columnDefs={columnDefs}
            onColumnDefsChange={handleColumnDefsChange}
          />
        ),
      },
      {
        id: 'data',
        label: 'Data',
        icon: Settings2,
        content: (
          <DataSettings
            rowCount={rowData.length}
            dataplaneRowCount={dataplaneRowCount}
            isLoading={isLoading}
          />
        ),
      },
      {
        id: 'links',
        label: 'Links',
        icon: Link2,
        content: (
          <LinksSettingsWithContext blockId={blockId} />
        ),
      },
    ],
    [variantId, columnDefs, rowData.length, dataplaneRowCount, isLoading, handleVariantChange, handleColumnDefsChange, blockId]
  );

  return (
    <EmbeddedBlockWrapper
      nodeViewProps={nodeViewProps}
      badge={DATA_GRID_BADGE}
      tabs={tabs}
      expandedHeight={300}
      collapsedHeight={80}
      dataplaneConfig={DATA_GRID_DATAPLANE_CONFIG}
    >
      <GridContent
        rowData={rowData}
        columnDefs={columnDefs}
        variant={variant}
        onGridReady={handleGridReady}
        onRowDataUpdated={handleRowDataUpdated}
      />
    </EmbeddedBlockWrapper>
  );
}

/**
 * LinksSettings that accesses EmbeddedBlockContext for dataplane state.
 * Wrapped to ensure it's rendered inside the EmbeddedBlockWrapper's context.
 */
function LinksSettingsWithContext({ blockId }: { blockId: string }) {
  const blockContext = useContext(EmbeddedBlockContext);
  const dataplaneState = blockContext?.dataplane;

  return (
    <LinksSettings
      isReady={dataplaneState?.isReady ?? false}
      portCount={dataplaneState?.ports.length ?? 0}
    />
  );
}

export default DataGridBlockView;
