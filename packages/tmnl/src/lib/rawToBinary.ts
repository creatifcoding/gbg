/**
 * Raw Table to Binary Conversion
 *
 * Converts RawTableDTO (object-column format) to RawTableBinary format
 * with numeric columns extracted into Float64Array buffers for zero-copy
 * Transferable transfer to workers.
 *
 * @remarks
 * - Call this on the UI thread before dispatching to worker
 * - Numeric columns become Float64Array in ArrayBuffer (Transferable)
 * - Non-numeric columns are kept as regular arrays (structured clone)
 * - NULL values in numeric columns become NaN
 */

import type { RawTableDTO, RawTableBinary } from './worker-protocol';

/**
 * Type detection result for a column
 */
type ColumnAnalysis = {
  readonly name: string;
  readonly type: 'numeric' | 'string' | 'boolean' | 'null';
};

/**
 * Analyze a column to determine its predominant type.
 * Numeric columns are those where all non-null values are numbers.
 *
 * @param rows - The row data
 * @param columnName - Name of the column to analyze
 * @returns Column analysis result
 */
function analyzeColumn(
  rows: readonly Record<string, string | number | boolean | null>[],
  columnName: string,
): ColumnAnalysis {
  let hasNumbers = false;
  let hasStrings = false;
  let hasBooleans = false;
  let allNull = true;

  for (const row of rows) {
    const value = row[columnName];
    if (value === null || value === undefined) {
      continue;
    }
    allNull = false;

    const valueType = typeof value;
    if (valueType === 'number' && !Number.isNaN(value)) {
      hasNumbers = true;
    } else if (valueType === 'string') {
      hasStrings = true;
    } else if (valueType === 'boolean') {
      hasBooleans = true;
    }
  }

  if (allNull) {
    return { name: columnName, type: 'null' };
  }

  // Pure numeric column (no mixed types)
  if (hasNumbers && !hasStrings && !hasBooleans) {
    return { name: columnName, type: 'numeric' };
  }

  // Boolean column
  if (hasBooleans && !hasNumbers && !hasStrings) {
    return { name: columnName, type: 'boolean' };
  }

  // Default to string for mixed or string columns
  return { name: columnName, type: 'string' };
}

/**
 * Extract numeric column data into a Float64Array.
 * NULL values are converted to NaN.
 *
 * @param rows - Row data
 * @param columnName - Column to extract
 * @returns ArrayBuffer containing Float64Array data
 */
function extractNumericColumn(
  rows: readonly Record<string, string | number | boolean | null>[],
  columnName: string,
): ArrayBuffer {
  const float64 = new Float64Array(rows.length);

  for (let i = 0; i < rows.length; i++) {
    const value = rows[i][columnName];
    // Convert null/undefined to NaN
    // For numeric columns, values should already be numbers
    // NaN is handled in aggregation functions
    if (value === null || value === undefined) {
      float64[i] = Number.NaN;
    } else if (typeof value === 'number') {
      float64[i] = value;
    } else {
      // Non-numeric values in a numeric column become NaN
      // This is intentional - NaN is filtered in aggregation
      float64[i] = Number.NaN;
    }
  }

  // Return the underlying ArrayBuffer for Transferable transfer
  return float64.buffer;
}

/**
 * Extract string column data.
 * Non-string values are converted to strings or null.
 *
 * @param rows - Row data
 * @param columnName - Column to extract
 * @returns Array of string or null values
 */
function extractStringColumn(
  rows: readonly Record<string, string | number | boolean | null>[],
  columnName: string,
): (string | null)[] {
  return rows.map((row) => {
    const value = row[columnName];
    if (value === null || value === undefined) {
      return null;
    }
    return String(value);
  });
}

/**
 * Extract boolean column data.
 *
 * @param rows - Row data
 * @param columnName - Column to extract
 * @returns Array of boolean or null values
 */
function extractBooleanColumn(
  rows: readonly Record<string, string | number | boolean | null>[],
  columnName: string,
): (boolean | null)[] {
  return rows.map((row) => {
    const value = row[columnName];
    if (value === null || value === undefined) {
      return null;
    }
    return Boolean(value);
  });
}

/**
 * Convert RawTableDTO to RawTableBinary format.
 *
 * This function:
 * 1. Analyzes each column to determine type
 * 2. Extracts numeric columns into Float64Array buffers (Transferable)
 * 3. Keeps non-numeric columns as regular arrays
 *
 * @example
 * ```ts
 * const raw: RawTableDTO = {
 *   columns: ['category', 'value'],
 *   rows: [
 *     { category: 'A', value: 10 },
 *     { category: 'B', value: 20 },
 *   ]
 * };
 *
 * const binary = rawTableToBinary(raw);
 * // binary.numericBuffers['value'] is an ArrayBuffer (Transferable)
 * // binary.stringColumns['category'] is ['A', 'B']
 * ```
 *
 * @param dto - Raw table in DTO format
 * @returns Binary representation with ArrayBuffer for numeric columns
 */
export function rawTableToBinary(dto: RawTableDTO): RawTableBinary {
  const { columns, rows } = dto;
  const rowCount = rows.length;

  // Analyze all columns
  const columnAnalyses = columns.map((col) => analyzeColumn(rows, col));

  // Build column types map
  const columnTypes: Record<string, 'numeric' | 'string' | 'boolean' | 'null'> = {};
  for (const analysis of columnAnalyses) {
    columnTypes[analysis.name] = analysis.type;
  }

  // Extract data by type
  const numericBuffers: Record<string, ArrayBuffer> = {};
  const stringColumns: Record<string, (string | null)[]> = {};
  const booleanColumns: Record<string, (boolean | null)[]> = {};

  for (const analysis of columnAnalyses) {
    const { name, type } = analysis;

    switch (type) {
      case 'numeric':
        // Extract to Float64Array buffer (Transferable)
        numericBuffers[name] = extractNumericColumn(rows, name);
        break;

      case 'string':
        // Keep as string array (structured clone)
        stringColumns[name] = extractStringColumn(rows, name);
        break;

      case 'boolean':
        // Keep as boolean array (structured clone)
        booleanColumns[name] = extractBooleanColumn(rows, name);
        break;

      case 'null':
        // All-null columns treated as string
        stringColumns[name] = extractStringColumn(rows, name);
        break;
    }
  }

  return {
    rowCount,
    columns: [...columns],
    columnTypes,
    numericBuffers,
    stringColumns,
    booleanColumns,
  };
}

/**
 * Get all ArrayBuffers from a RawTableBinary that should be transferred.
 *
 * Use this to get the list of Transferables before posting to worker.
 *
 * @param binary - The binary table representation
 * @returns Array of ArrayBuffers to transfer
 */
export function getTransferableBuffers(binary: RawTableBinary): ArrayBuffer[] {
  const buffers: ArrayBuffer[] = [];
  for (const key of Object.keys(binary.numericBuffers)) {
    buffers.push(binary.numericBuffers[key]);
  }
  return buffers;
}

/**
 * Calculate the total byte size of transferable buffers.
 * Useful for bandwidth/latency calculations in QoS decisions.
 *
 * @param binary - The binary table representation
 * @returns Total bytes in all numeric buffers
 */
export function calculateTransferSize(binary: RawTableBinary): number {
  let totalBytes = 0;
  for (const key of Object.keys(binary.numericBuffers)) {
    totalBytes += binary.numericBuffers[key].byteLength;
  }
  return totalBytes;
}
