import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import type { CSSProperties } from 'react';
import { chrome } from '../lib/chrome.js';
import { Label } from './Label.js';
import { Socket } from './Socket.js';

export type TableRow = Record<string, string>;

export type TableProps<TData extends TableRow = TableRow> = {
  readonly columns?: ColumnDef<TData, string>[];
  readonly data?: TData[];
  readonly style?: CSSProperties;
};

export const BLANK_TABLE_COLUMNS: ColumnDef<TableRow, string>[] = [
  { accessorKey: 'a', header: 'col' },
  { accessorKey: 'b', header: 'col' },
  { accessorKey: 'c', header: 'col' },
];

export const BLANK_TABLE_ROWS: TableRow[] = [
  { a: '', b: '', c: '' },
  { a: '', b: '', c: '' },
  { a: '', b: '', c: '' },
];

const cellFrame: CSSProperties = {
  boxSizing: 'border-box',
  border: `1px solid ${chrome.color.border}`,
  padding: chrome.space.pillInlinePadding,
  background: chrome.color.void,
};

export function Table<TData extends TableRow = TableRow>({
  columns,
  data,
  style,
}: TableProps<TData>) {
  const table = useReactTable({
    data: data ?? (BLANK_TABLE_ROWS as TData[]),
    columns: columns ?? (BLANK_TABLE_COLUMNS as ColumnDef<TData, string>[]),
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <table
      data-table=""
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        background: chrome.color.void,
        color: chrome.color.primary,
        fontFamily: chrome.font.mono,
        ...style,
      }}
    >
      <thead>
        {table.getHeaderGroups().map((group) => (
          <tr key={group.id}>
            {group.headers.map((header) => (
              <th
                key={header.id}
                style={{
                  ...cellFrame,
                  background: chrome.color.elevated,
                  textAlign: 'left',
                  fontWeight: chrome.type.weight.regular,
                }}
              >
                <Label>
                  {header.isPlaceholder
                    ? ' '
                    : String(flexRender(header.column.columnDef.header, header.getContext()) ?? ' ')}
                </Label>
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => {
              const value = cell.getValue();
              const text = typeof value === 'string' ? value : '';
              return (
                <td key={cell.id} style={cellFrame}>
                  {text === '' ? <Socket /> : <Socket>{text}</Socket>}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
