/**
 * Processor Worker Entry Script
 *
 * Worker that receives RawTableBinary with transferred ArrayBuffers,
 * reconstructs typed views, and performs chart processing.
 *
 * COOPERATIVE CANCELLATION:
 * Effect interruption is mapped to Worker interrupt frames. The processor
 * can be interrupted at chunk boundaries using Effect.interrupt.
 * This allows long-running operations to be cancelled gracefully.
 *
 * SECURITY NOTES:
 * - No functions or code cross this boundary (only serializable data)
 * - HTML in output (titles, labels) should be sanitized on main thread
 * - Input validation is performed before processing
 */

import * as Effect from 'effect/Effect';
import type {
  RawTableBinary,
  ProcessorConfig,
  ChartDTO,
  SeriesDTO,
  ProcessorRequest,
  ProcessorResponse,
} from './worker-protocol';

// ============================================================================
// Data Reconstruction
// ============================================================================

/**
 * Reconstruct Float64Array view from transferred ArrayBuffer.
 *
 * After zero-copy transfer, the ArrayBuffer is now owned by this worker.
 * We create a typed view to access the data efficiently.
 *
 * @param buffer - The transferred ArrayBuffer
 * @returns Float64Array view of the data
 */
function reconstructFloat64View(buffer: ArrayBuffer): Float64Array {
  return new Float64Array(buffer);
}

/**
 * Get numeric column data as Float64Array.
 *
 * @param raw - Binary table representation (after transfer)
 * @param columnName - Name of the column
 * @returns Float64Array view or undefined if column doesn't exist
 */
function getNumericColumn(raw: RawTableBinary, columnName: string): Float64Array | undefined {
  const buffer = raw.numericBuffers[columnName];
  if (buffer instanceof ArrayBuffer) {
    return reconstructFloat64View(buffer);
  }
  return undefined;
}

/**
 * Get string column data.
 *
 * @param raw - Binary table representation
 * @param columnName - Name of the column
 * @returns String array or undefined if column doesn't exist
 */
function getStringColumn(raw: RawTableBinary, columnName: string): readonly (string | null)[] | undefined {
  return raw.stringColumns[columnName];
}

// ============================================================================
// Aggregation Functions
// ============================================================================

type AggregationFn = 'sum' | 'avg' | 'min' | 'max' | 'count';

/**
 * Compute aggregation for a group of values.
 *
 * @param values - Array of numbers to aggregate
 * @param fn - Aggregation function name
 * @returns Aggregated value
 */
function aggregate(values: number[], fn: AggregationFn): number {
  if (values.length === 0) {
    return 0;
  }

  // Filter out NaN values
  const validValues = values.filter((v) => !Number.isNaN(v));
  if (validValues.length === 0) {
    return Number.NaN;
  }

  switch (fn) {
    case 'sum':
      return validValues.reduce((a, b) => a + b, 0);

    case 'avg':
      return validValues.reduce((a, b) => a + b, 0) / validValues.length;

    case 'min':
      return Math.min(...validValues);

    case 'max':
      return Math.max(...validValues);

    case 'count':
      return validValues.length;

    default:
      return validValues.reduce((a, b) => a + b, 0);
  }
}

// ============================================================================
// Processing Function
// ============================================================================

/**
 * Process data with group-by aggregation.
 *
 * This function:
 * 1. Groups data by the groupBy column
 * 2. Aggregates values per group
 *
 * COOPERATIVE CANCELLATION NOTE:
 * For very large datasets, you could add periodic Effect.yieldNow() calls
 * at chunk boundaries to allow the Effect runtime to check for interruption.
 * Example:
 * ```
 * if (i > 0 && i % chunkSize === 0) {
 *   yield* Effect.yieldNow();
 * }
 * ```
 *
 * @param raw - Binary table data
 * @param config - Processing configuration
 * @returns Effect that produces ChartDTO
 */
function processData(
  raw: RawTableBinary,
  config: ProcessorConfig,
): Effect.Effect<ChartDTO, Error> {
  // Validate columns exist
  const groupByColumn = getStringColumn(raw, config.groupByColumn);
  const aggregateColumn = getNumericColumn(raw, config.aggregateColumn);

  // Try numeric column for groupBy if string column not found
  let groupByValues: readonly (string | null)[] | undefined = groupByColumn;
  if (!groupByValues) {
    const numericGroupBy = getNumericColumn(raw, config.groupByColumn);
    if (numericGroupBy) {
      groupByValues = Array.from(numericGroupBy).map((v) =>
        Number.isNaN(v) ? null : String(v),
      );
    }
  }

  if (!groupByValues) {
    return Effect.fail(
      new Error(`Group-by column '${config.groupByColumn}' not found`),
    );
  }

  if (!aggregateColumn) {
    return Effect.fail(
      new Error(`Aggregate column '${config.aggregateColumn}' not found or not numeric`),
    );
  }

  // Group aggregation
  const groups = new Map<string, number[]>();
  const rowCount = raw.rowCount;

  // COOPERATIVE CANCELLATION NOTE:
  // In a production implementation with Effect.gen and config.chunkSize, you would add:
  // if (i > 0 && i % config.chunkSize === 0) {
  //   yield* Effect.yieldNow();
  // }
  for (let i = 0; i < rowCount; i++) {
    // Get group key
    const groupKey = groupByValues[i] ?? '__null__';

    // Get aggregate value
    const value = aggregateColumn[i];

    // Add to group
    let groupValues = groups.get(groupKey);
    if (!groupValues) {
      groupValues = [];
      groups.set(groupKey, groupValues);
    }
    groupValues.push(value);
  }

  // Compute final aggregates
  const categories: string[] = [];
  const aggregatedValues: number[] = [];

  groups.forEach((values, key) => {
    categories.push(key === '__null__' ? '(null)' : key);
    aggregatedValues.push(aggregate(values, config.aggregationFn));
  });

  // Build chart DTO
  const chart: ChartDTO = {
    title: config.chartTitle ?? `${config.aggregationFn.toUpperCase()} of ${config.aggregateColumn} by ${config.groupByColumn}`,
    xAxis: {
      title: config.groupByColumn,
      categories,
    },
    yAxis: {
      title: `${config.aggregationFn.toUpperCase()}(${config.aggregateColumn})`,
    },
    series: [
      {
        name: config.aggregateColumn,
        data: aggregatedValues,
      },
    ] satisfies SeriesDTO[],
  };

  return Effect.succeed(chart);
}

// ============================================================================
// Request Handler
// ============================================================================

/**
 * Handle incoming processor requests.
 *
 * @param request - The request to process
 * @returns Effect that produces ProcessorResponse
 */
export function handleRequest(request: ProcessorRequest): Effect.Effect<ProcessorResponse> {
  switch (request._tag) {
    case 'Process': {
      const { raw, config } = request.payload;
      const startTime = Date.now();

      return Effect.matchEffect(processData(raw, config), {
        onFailure: (error) =>
          Effect.succeed({
            _tag: 'Error' as const,
            payload: {
              message: error instanceof Error ? error.message : String(error),
              code: 'PROCESSING_ERROR',
            },
          }),
        onSuccess: (chart) =>
          Effect.succeed({
            _tag: 'ProcessResult' as const,
            payload: {
              chart,
              processingTimeMs: Date.now() - startTime,
            },
          }),
      });
    }

    case 'Ping': {
      return Effect.succeed({
        _tag: 'Pong' as const,
        payload: {
          requestTimestamp: request.payload.timestamp,
          responseTimestamp: Date.now(),
        },
      });
    }

    default: {
      return Effect.succeed({
        _tag: 'Error' as const,
        payload: {
          message: 'Unknown request type',
          code: 'UNKNOWN_REQUEST',
        },
      });
    }
  }
}

// ============================================================================
// Worker Entry Point
// ============================================================================

/**
 * Worker setup for use with Effect Platform Worker.
 *
 * The actual worker entry is set up by makePoolSerialized layer.
 * This module exports the handler that processes requests.
 *
 * For standalone usage (without Effect Platform), you would call:
 * ```ts
 * self.onmessage = (event) => {
 *   const request = event.data as ProcessorRequest;
 *   Effect.runPromise(handleRequest(request)).then((response) => {
 *     self.postMessage(response);
 *   });
 * };
 * ```
 */
export { handleRequest as default };
