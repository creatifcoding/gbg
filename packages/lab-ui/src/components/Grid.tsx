import type { CSSProperties } from 'react';
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
} from 'ag-grid-community';
import { AgGridReact, type AgGridReactProps } from 'ag-grid-react';
import { chrome } from '../lib/chrome.js';
import { vantaGridTheme } from '../lib/grid-theme.js';
import { HeaderCell, SocketCell, StatusCell, ValueCell } from './grid-cells.js';

ModuleRegistry.registerModules([AllCommunityModule]);

export type GridBridgeHandle = {
  readonly gridOptions: () => Record<string, unknown>;
};

export type GridProps<TData = unknown> = Omit<
  AgGridReactProps<TData>,
  'theme' | 'style'
> & {
  readonly bridge?: GridBridgeHandle;
  readonly style?: CSSProperties;
};

export const BLANK_COLUMNS: ColDef[] = [
  {
    field: 'cell',
    headerName: 'cell',
    headerComponent: HeaderCell,
    cellRenderer: SocketCell,
    flex: 1,
  },
  {
    field: 'status',
    headerName: 'status',
    headerComponent: HeaderCell,
    cellRenderer: StatusCell,
    width: 96,
  },
  {
    field: 'value',
    headerName: 'value',
    headerComponent: HeaderCell,
    cellRenderer: ValueCell,
    flex: 1,
  },
];

export const BLANK_ROWS: ReadonlyArray<Record<string, string>> = [
  { cell: '', status: '', value: '' },
  { cell: '', status: '', value: '' },
  { cell: '', status: '', value: '' },
];

export function Grid<TData = unknown>({
  bridge,
  columnDefs,
  rowData,
  defaultColDef,
  style,
  ...props
}: GridProps<TData>) {
  const bridgeOptions = bridge?.gridOptions() ?? {};

  return (
    <div
      data-grid=""
      style={{
        boxSizing: 'border-box',
        width: '100%',
        height: chrome.space.gridHeight,
        background: chrome.color.void,
        border: `1px solid ${chrome.color.border}`,
        borderRadius: chrome.radius.frame,
        overflow: 'hidden',
        ...style,
      }}
    >
      <AgGridReact<TData>
        theme={vantaGridTheme}
        columnDefs={columnDefs ?? (BLANK_COLUMNS as ColDef<TData>[])}
        rowData={rowData ?? (BLANK_ROWS as TData[])}
        defaultColDef={{
          sortable: false,
          filter: false,
          resizable: true,
          suppressHeaderMenuButton: true,
          ...defaultColDef,
        }}
        {...bridgeOptions}
        {...props}
      />
    </div>
  );
}
