/**
 * Session Identity Schemas
 *
 * Branded string types for type-safe session identity.
 * Separate ID spaces with explicit mapping (per design decision).
 *
 * - HarnessSessionId: Our ID space (generated, owned by Harness)
 * - PiSessionId: pi's ID space (passed through to pi-ai providers)
 * - SessionIdMapping: Explicit link between the two
 *
 * @module harness/session/v2/identity
 */

import { Schema } from 'effect'

// =============================================================================
// Branded Identifiers
// =============================================================================

/** TMNL-owned session identifier. Generated on session create. */
export const HarnessSessionId = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.brand('HarnessSessionId'),
)
export type HarnessSessionId = typeof HarnessSessionId.Type

/** pi-ai provider session identifier. Used for prompt cache keying. */
export const PiSessionId = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.brand('PiSessionId'),
)
export type PiSessionId = typeof PiSessionId.Type

/** Unique entry identifier within a session tree. */
export const EntryId = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.brand('EntryId'),
)
export type EntryId = typeof EntryId.Type

// =============================================================================
// Identity Mapping
// =============================================================================

/**
 * Explicit mapping between TMNL and pi session identities.
 *
 * Allows N:1 or 1:N relationships — a TMNL session may span
 * multiple pi sessions (e.g., after model switch), or multiple
 * TMNL sessions may share a pi session (e.g., forks).
 */
export const SessionIdMapping = Schema.Struct({
  harnessId: HarnessSessionId,
  piId: PiSessionId,
  createdAt: Schema.DateFromSelf,
})
export type SessionIdMapping = typeof SessionIdMapping.Type
