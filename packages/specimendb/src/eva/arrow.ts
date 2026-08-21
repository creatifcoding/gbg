/**
 * Rows → Apache Arrow table. Catalog columns are text / jsonb; stringify jsonb.
 *
 * @module @tmnl/specimendb/eva/arrow
 */

import { tableFromArrays, tableFromJSON, type Table } from 'apache-arrow';

const cell = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export const emptyArrowTable = (): Table => tableFromJSON([]) as unknown as Table;

export const rowsToArrow = (rows: ReadonlyArray<Record<string, unknown>>): Table => {
  if (rows.length === 0) return emptyArrowTable();
  const keys = Object.keys(rows[0]!);
  const columns: Record<string, Array<string | null>> = {};
  for (const key of keys) {
    columns[key] = rows.map((row) => cell(row[key]));
  }
  return tableFromArrays(columns);
};

export const columnValues = (table: Table, name: string): ReadonlyArray<string | null> => {
  const child = table.getChild(name);
  if (child === null || child === undefined) return [];
  return [...child.toArray()].map((value) => (value === null || value === undefined ? null : String(value)));
};
