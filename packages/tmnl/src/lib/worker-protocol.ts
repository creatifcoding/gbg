/**
 * Worker Protocol DTOs
 *
 * Plain TypeScript DTO types for serialized worker communication.
 * All types are serializable (no functions or class instances).
 *
 * IMPORTANT: These types cross the worker boundary via structured clone.
 * Do not include functions, DOM nodes, or non-transferable objects.
 */

// ============================================================================
// Raw Table DTOs (Input)
// ============================================================================

/**
 * Raw table data in object-column format.
 * This is the format typically received from data sources before processing.
 */
export interface RawTableDTO {
  /**
   * Column names in order
   */
  readonly columns: readonly string[];

  /**
   * Row data as array of objects (column name -> value)
   * Values should be primitives: string | number | boolean | null
   */
  readonly rows: readonly Record<string, string | number | boolean | null>[];
}

/**
 * Binary representation of table data optimized for Transferable transfer.
 *
 * Numeric columns are extracted into Float64Array buffers that can be
 * transferred (zero-copy) to the worker. Non-numeric columns remain as
 * serialized arrays.
 *
 * @remarks
 * - numericBuffers are ArrayBuffers that will be transferred (not copied)
 * - After transfer, the original ArrayBuffers become detached (length 0)
 * - Use this format when dispatching to workers to avoid copying large arrays
 */
export interface RawTableBinary {
  /**
   * Total number of rows
   */
  readonly rowCount: number;

  /**
   * Ordered list of column names
   */
  readonly columns: readonly string[];

  /**
   * Map of column name -> column type
   */
  readonly columnTypes: Record<string, 'numeric' | 'string' | 'boolean' | 'null'>;

  /**
   * Map of numeric column name -> ArrayBuffer containing Float64Array data.
   * These buffers are Transferable and should be registered with
   * Transferable.addAll before posting to worker.
   */
  readonly numericBuffers: Record<string, ArrayBuffer>;

  /**
   * Non-numeric column data as regular arrays (will be structured-cloned)
   */
  readonly stringColumns: Record<string, readonly (string | null)[]>;

  /**
   * Boolean column data as regular arrays
   */
  readonly booleanColumns: Record<string, readonly (boolean | null)[]>;
}

// ============================================================================
// Processor Configuration
// ============================================================================

/**
 * Configuration for processing operations.
 * All fields are primitives to ensure serializability.
 */
export interface ProcessorConfig {
  /**
   * Column name to group by (must exist in input)
   */
  readonly groupByColumn: string;

  /**
   * Column name to aggregate (must be numeric)
   */
  readonly aggregateColumn: string;

  /**
   * Aggregation function to apply
   */
  readonly aggregationFn: 'sum' | 'avg' | 'min' | 'max' | 'count';

  /**
   * Optional: Maximum iterations per chunk before yielding for cancellation check.
   * Default: 1000
   */
  readonly chunkSize?: number;

  /**
   * Optional: Chart title
   */
  readonly chartTitle?: string;
}

// ============================================================================
// Chart Output DTOs
// ============================================================================

/**
 * A single data series for charting
 */
export interface SeriesDTO {
  readonly name: string;
  readonly data: readonly number[];
}

/**
 * Axis configuration for charts
 */
export interface AxisDTO {
  readonly title: string;
  readonly categories?: readonly string[];
}

/**
 * Chart data transfer object.
 *
 * SECURITY NOTE: If any string fields (title, axis labels, categories, series names)
 * come from user input or external sources, sanitize them on the main thread
 * before rendering to prevent XSS attacks.
 */
export interface ChartDTO {
  readonly title: string;
  readonly xAxis: AxisDTO;
  readonly yAxis: AxisDTO;
  readonly series: readonly SeriesDTO[];
}

// ============================================================================
// Tagged Request/Response Protocol
// ============================================================================

/**
 * Tagged union discriminator for request types
 */
export type RequestTag = 'Process' | 'Ping';

/**
 * Process request - transform raw binary data into chart output
 */
export interface ProcessRequest {
  readonly _tag: 'Process';
  readonly payload: {
    readonly raw: RawTableBinary;
    readonly config: ProcessorConfig;
  };
}

/**
 * Ping request - health check / keep-alive
 */
export interface PingRequest {
  readonly _tag: 'Ping';
  readonly payload: {
    readonly timestamp: number;
  };
}

/**
 * Union of all request types
 */
export type ProcessorRequest = ProcessRequest | PingRequest;

/**
 * Successful process response
 */
export interface ProcessResponse {
  readonly _tag: 'ProcessResult';
  readonly payload: {
    readonly chart: ChartDTO;
    readonly processingTimeMs: number;
  };
}

/**
 * Pong response to ping
 */
export interface PongResponse {
  readonly _tag: 'Pong';
  readonly payload: {
    readonly requestTimestamp: number;
    readonly responseTimestamp: number;
  };
}

/**
 * Error response
 */
export interface ErrorResponse {
  readonly _tag: 'Error';
  readonly payload: {
    readonly message: string;
    readonly code: string;
  };
}

/**
 * Union of all response types
 */
export type ProcessorResponse = ProcessResponse | PongResponse | ErrorResponse;

// ============================================================================
// Type Guards
// ============================================================================

export function isProcessRequest(req: ProcessorRequest): req is ProcessRequest {
  return req._tag === 'Process';
}

export function isPingRequest(req: ProcessorRequest): req is PingRequest {
  return req._tag === 'Ping';
}

export function isProcessResponse(res: ProcessorResponse): res is ProcessResponse {
  return res._tag === 'ProcessResult';
}

export function isPongResponse(res: ProcessorResponse): res is PongResponse {
  return res._tag === 'Pong';
}

export function isErrorResponse(res: ProcessorResponse): res is ErrorResponse {
  return res._tag === 'Error';
}
