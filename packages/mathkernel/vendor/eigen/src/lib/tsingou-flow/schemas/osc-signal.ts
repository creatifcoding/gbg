/**
 * OSC Signal Schema (Open Sound Control)
 *
 * Source: UDP listener for OSC messages
 * Covers: OSC messages with address patterns and typed arguments
 *
 * @module tsingou-flow/schemas/osc-signal
 */

import { Schema } from 'effect'
import { BaseSignal } from './base-signal'

// =============================================================================
// OSC Argument Types
// =============================================================================

/**
 * OSC supports these argument types in the spec:
 * i = int32, f = float32, s = string, b = blob (Uint8Array)
 * T = true, F = false, N = nil
 */
export const OscArgument = Schema.Union(
  Schema.Number,
  Schema.String,
  Schema.Boolean,
  Schema.Uint8ArrayFromSelf,
  Schema.Null,
)
export type OscArgument = typeof OscArgument.Type

// =============================================================================
// OSC Payload
// =============================================================================

export const OscPayload = Schema.Struct({
  /** OSC address pattern (e.g. "/synth/filter/cutoff") */
  address: Schema.String.pipe(Schema.startsWith('/')),

  /** Typed argument list */
  args: Schema.Array(OscArgument),

  /** OSC timetag (NTP timestamp) if present in bundle */
  timetag: Schema.optional(Schema.Number),

  /** Whether this message was part of an OSC bundle */
  isBundle: Schema.optional(Schema.Boolean),

  /** Source host:port */
  remoteAddress: Schema.optional(Schema.String),
})
export type OscPayload = typeof OscPayload.Type

// =============================================================================
// OscSignal
// =============================================================================

export const OscSignal = Schema.extend(
  BaseSignal,
  Schema.Struct({
    kind: Schema.Literal('osc'),
    payload: OscPayload,
  }),
)
export type OscSignal = typeof OscSignal.Type
