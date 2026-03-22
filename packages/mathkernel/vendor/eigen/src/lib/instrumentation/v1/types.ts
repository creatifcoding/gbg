/**
 * @module instrumentation/v1/types
 * @description Core types for Effect-based instrumentation and telemetry
 *
 * DESIGN PRINCIPLES:
 * - OpenTelemetry-compliant span attributes
 * - AI-friendly structured data (LLM-queryable)
 * - NATS KV/ObjectStore persistence backend
 * - Minimal performance overhead
 */

import { Schema } from 'effect';

/**
 * Span attribute value types (OpenTelemetry-compliant)
 */
export type SpanAttributeValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | boolean[];

/**
 * Span attributes (OpenTelemetry semantic conventions)
 */
export interface SpanAttributes {
  readonly [key: string]: SpanAttributeValue;
}

/**
 * Span event (point-in-time occurrence during span)
 */
export const SpanEvent = Schema.Struct({
  name: Schema.NonEmptyString,
  timestamp: Schema.DateFromSelf,
  attributes: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown })
  ),
});
export interface SpanEvent extends Schema.Schema.Type<typeof SpanEvent> {}

/**
 * Span status (follows OpenTelemetry spec)
 */
export const SpanStatus = Schema.Literal('unset', 'ok', 'error');
export type SpanStatus = Schema.Schema.Type<typeof SpanStatus>;

/**
 * Span kind (follows OpenTelemetry spec)
 */
export const SpanKind = Schema.Literal(
  'internal', // Default - internal operation
  'server', // Server-side request handler
  'client', // Client-side request
  'producer', // Message producer
  'consumer' // Message consumer
);
export type SpanKind = Schema.Schema.Type<typeof SpanKind>;

/**
 * Captured span data (persisted to NATS)
 */
export const CapturedSpan = Schema.Struct({
  spanId: Schema.NonEmptyString,
  traceId: Schema.NonEmptyString,
  parentSpanId: Schema.optional(Schema.NonEmptyString),
  name: Schema.NonEmptyString,
  kind: SpanKind,
  startTime: Schema.DateFromSelf,
  endTime: Schema.optional(Schema.DateFromSelf),
  status: SpanStatus,
  attributes: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  events: Schema.Array(SpanEvent),
  serviceName: Schema.NonEmptyString,
});
export interface CapturedSpan extends Schema.Schema.Type<typeof CapturedSpan> {}

/**
 * Trace context (propagated across service boundaries)
 */
export const TraceContext = Schema.Struct({
  traceId: Schema.NonEmptyString,
  spanId: Schema.NonEmptyString,
  traceFlags: Schema.Number, // Bitmask (0x01 = sampled)
});
export interface TraceContext extends Schema.Schema.Type<typeof TraceContext> {}

export interface InstrumentationConfigShape {
  readonly serviceName: string;
  readonly enableTracing: boolean;
  readonly enableMetrics: boolean;
  readonly sampleRate: number;
  readonly natsUrl?: string;
  readonly otlpEndpoint?: string;
}

/**
 * Span options for withSpan pipe operator
 */
export interface SpanOptions {
  readonly name: string;
  readonly kind?: SpanKind;
  readonly attributes?: SpanAttributes;
  readonly captureStack?: boolean;
}

/**
 * Persisted trace query
 */
export interface TraceQuery {
  readonly traceId?: string;
  readonly serviceName?: string;
  readonly minDuration?: number;
  readonly startTime?: Date;
  readonly endTime?: Date;
  readonly attributes?: Record<string, SpanAttributeValue>;
  readonly limit?: number;
}

/**
 * NATS storage keys (KV bucket organization)
 */
export const NATS_STORAGE = {
  KV_BUCKET: 'tmnl-traces', // Span metadata
  OBJ_BUCKET: 'tmnl-trace-data', // Large payloads
  STREAM: 'TRACES', // JetStream for live feed
} as const;
