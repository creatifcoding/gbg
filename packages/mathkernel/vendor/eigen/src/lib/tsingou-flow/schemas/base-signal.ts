/**
 * BaseSignal — The foundational signal schema for Tsingou.
 *
 * Every signal entering the pipeline carries these common fields regardless
 * of source. Source-specific extensions use Schema.extend to add typed payload
 * shapes while preserving the base contract.
 *
 * Naming: After Mary Tsingou (1928–2023), MANIAC programmer at Los Alamos.
 *
 * @see TSINGOU_FLOW_ARCHITECTURE.md §3.1
 * @module tsingou-flow/schemas/base-signal
 */

import { Schema } from 'effect'

// =============================================================================
// Branded Identity Types
// =============================================================================

/**
 * Unique signal identifier.
 * Generated per ingestion event — every signal gets exactly one.
 */
export const SignalId = Schema.String.pipe(
  Schema.brand('SignalId'),
  Schema.minLength(1),
)
export type SignalId = typeof SignalId.Type

/**
 * Source adapter identifier.
 * Stable across reconnections — identifies the *logical* source.
 */
export const SourceId = Schema.String.pipe(
  Schema.brand('SourceId'),
  Schema.minLength(1),
)
export type SourceId = typeof SourceId.Type

/**
 * Session identifier for analysis workspaces.
 */
export const SessionId = Schema.String.pipe(
  Schema.brand('SessionId'),
  Schema.minLength(1),
)
export type SessionId = typeof SessionId.Type

// =============================================================================
// Version Tuple (d2ts multi-dimensional)
// =============================================================================

/**
 * Multi-dimensional version for d2ts partial ordering.
 *
 * Dimension 0: Global logical tick (monotonic, incremented per processing cycle)
 * Dimension 1: Per-source sequence number (allows independent source ordering)
 *
 * This enables simultaneous transport-locked AND real-time signal processing
 * without blocking sources on each other.
 *
 * @see d2ts Version type, Antichain frontier
 */
export const SignalVersion = Schema.Tuple(
  Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
)
export type SignalVersion = typeof SignalVersion.Type

// =============================================================================
// Signal Kind Discriminator
// =============================================================================

/**
 * Known signal kinds — compile-time discriminator for schema dispatch.
 * Additional kinds can be registered at runtime via the schema registry.
 */
export const KnownSignalKind = Schema.Literal(
  'midi',
  'osc',
  'nats',
  'http',
  'serial',
  'rss',
  'websocket',
  'file-watch',
)
export type KnownSignalKind = typeof KnownSignalKind.Type

/**
 * Signal kind — either a known kind or an arbitrary string for runtime-registered types.
 */
export const SignalKind = Schema.Union(KnownSignalKind, Schema.String)
export type SignalKind = typeof SignalKind.Type

// =============================================================================
// Signal Metadata
// =============================================================================

/**
 * Optional metadata bag carried with every signal.
 * Adapters can attach source-specific context here.
 */
export const SignalMetadata = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
})
export type SignalMetadata = typeof SignalMetadata.Type

// =============================================================================
// BaseSignal
// =============================================================================

/**
 * The universal signal contract.
 *
 * Every signal in Tsingou — MIDI, OSC, NATS, HTTP, serial, RSS, WebSocket,
 * file watch, or any future custom type — carries these fields.
 *
 * Source-specific extensions add typed payload shapes via Schema.extend().
 *
 * @example
 * ```typescript
 * const signal: BaseSignal = {
 *   id: 'sig_abc123' as SignalId,
 *   sourceId: 'midi-controller-1' as SourceId,
 *   timestamp: new Date(),
 *   version: [42, 7],  // tick 42, source seq 7
 *   kind: 'midi',
 *   payload: { channel: 0, type: 'note-on', note: 60, velocity: 100 },
 * }
 * ```
 */
export const BaseSignal = Schema.Struct({
  /** Unique signal identifier (generated at ingestion) */
  id: SignalId,

  /** Logical source identifier (stable across reconnections) */
  sourceId: SourceId,

  /** When the signal was produced (source-side timestamp when available) */
  timestamp: Schema.DateFromSelf,

  /** d2ts multi-dimensional version [tick, source_seq] */
  version: SignalVersion,

  /** Discriminator for schema dispatch and registry lookup */
  kind: SignalKind,

  /** Signal payload — typed by source-specific extensions */
  payload: Schema.Unknown,

  /** Optional metadata bag for adapter-specific context */
  metadata: Schema.optional(SignalMetadata),
})

export type BaseSignal = typeof BaseSignal.Type
export type BaseSignalEncoded = typeof BaseSignal.Encoded
