/**
 * Worker Schema Definitions
 *
 * Effect Schema definitions that mirror the DTO types from worker-protocol.ts.
 * Used by makePoolSerialized for boundary validation.
 *
 * @remarks
 * - Schemas validate data at the worker boundary
 * - Transferable.schema wrapper marks ArrayBuffers for zero-copy transfer
 * - Keep schemas in sync with DTO types in worker-protocol.ts
 */

import * as Schema from 'effect/Schema';

// ============================================================================
// Column and Table Schemas
// ============================================================================

/**
 * Schema for column type discriminator
 */
export const ColumnTypeSchema = Schema.Literal('numeric', 'string', 'boolean', 'null');

/**
 * Schema for raw table in binary format.
 *
 * Note: numericBuffers contains ArrayBuffer objects which are Transferable.
 * When using with makePoolSerialized, these will be registered via
 * Transferable.addAll in the encode function.
 */
export const RawTableBinarySchema = Schema.Struct({
  rowCount: Schema.Number,
  columns: Schema.Array(Schema.String),
  columnTypes: Schema.Record({ key: Schema.String, value: ColumnTypeSchema }),
  // ArrayBuffers are opaque to Schema validation but are Transferable
  numericBuffers: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  stringColumns: Schema.Record({ key: Schema.String, value: Schema.Array(Schema.NullOr(Schema.String)) }),
  booleanColumns: Schema.Record({ key: Schema.String, value: Schema.Array(Schema.NullOr(Schema.Boolean)) }),
});

export type RawTableBinaryEncoded = Schema.Schema.Encoded<typeof RawTableBinarySchema>;

// ============================================================================
// Processor Config Schema
// ============================================================================

export const AggregationFnSchema = Schema.Literal('sum', 'avg', 'min', 'max', 'count');

export const ProcessorConfigSchema = Schema.Struct({
  groupByColumn: Schema.String,
  aggregateColumn: Schema.String,
  aggregationFn: AggregationFnSchema,
  chunkSize: Schema.optional(Schema.Number),
  chartTitle: Schema.optional(Schema.String),
});

export type ProcessorConfigEncoded = Schema.Schema.Encoded<typeof ProcessorConfigSchema>;

// ============================================================================
// Chart Output Schemas
// ============================================================================

export const SeriesSchema = Schema.Struct({
  name: Schema.String,
  data: Schema.Array(Schema.Number),
});

export const AxisSchema = Schema.Struct({
  title: Schema.String,
  categories: Schema.optional(Schema.Array(Schema.String)),
});

export const ChartSchema = Schema.Struct({
  title: Schema.String,
  xAxis: AxisSchema,
  yAxis: AxisSchema,
  series: Schema.Array(SeriesSchema),
});

export type ChartEncoded = Schema.Schema.Encoded<typeof ChartSchema>;

// ============================================================================
// Tagged Request Schemas
// ============================================================================

/**
 * Schema for Process request
 */
export const ProcessRequestSchema = Schema.Struct({
  _tag: Schema.Literal('Process'),
  payload: Schema.Struct({
    raw: RawTableBinarySchema,
    config: ProcessorConfigSchema,
  }),
});

/**
 * Schema for Ping request
 */
export const PingRequestSchema = Schema.Struct({
  _tag: Schema.Literal('Ping'),
  payload: Schema.Struct({
    timestamp: Schema.Number,
  }),
});

/**
 * Union schema for all requests
 */
export const ProcessorRequestSchema = Schema.Union(ProcessRequestSchema, PingRequestSchema);

export type ProcessorRequestEncoded = Schema.Schema.Encoded<typeof ProcessorRequestSchema>;

// ============================================================================
// Tagged Response Schemas
// ============================================================================

/**
 * Schema for successful process response
 */
export const ProcessResponseSchema = Schema.Struct({
  _tag: Schema.Literal('ProcessResult'),
  payload: Schema.Struct({
    chart: ChartSchema,
    processingTimeMs: Schema.Number,
  }),
});

/**
 * Schema for pong response
 */
export const PongResponseSchema = Schema.Struct({
  _tag: Schema.Literal('Pong'),
  payload: Schema.Struct({
    requestTimestamp: Schema.Number,
    responseTimestamp: Schema.Number,
  }),
});

/**
 * Schema for error response
 */
export const ErrorResponseSchema = Schema.Struct({
  _tag: Schema.Literal('Error'),
  payload: Schema.Struct({
    message: Schema.String,
    code: Schema.String,
  }),
});

/**
 * Union schema for all responses
 */
export const ProcessorResponseSchema = Schema.Union(
  ProcessResponseSchema,
  PongResponseSchema,
  ErrorResponseSchema,
);

export type ProcessorResponseEncoded = Schema.Schema.Encoded<typeof ProcessorResponseSchema>;

// ============================================================================
// Schema Type Exports for Type Inference
// ============================================================================

export type RawTableBinaryType = Schema.Schema.Type<typeof RawTableBinarySchema>;
export type ProcessorConfigType = Schema.Schema.Type<typeof ProcessorConfigSchema>;
export type ChartType = Schema.Schema.Type<typeof ChartSchema>;
export type ProcessorRequestType = Schema.Schema.Type<typeof ProcessorRequestSchema>;
export type ProcessorResponseType = Schema.Schema.Type<typeof ProcessorResponseSchema>;
