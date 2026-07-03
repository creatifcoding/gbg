/**
 * Notary — the automagic authoring surface.
 *
 * Per the service ontology: a Notary witnesses, validates, timestamps,
 * and records. That's exactly what this service does for registry
 * mutations:
 *
 *   - **Witnesses** the caller's intent (they pass a Procedure or Schema)
 *   - **Validates** by serializing through SchemaRepresentation
 *     (catches malformed inputs at the boundary)
 *   - **Timestamps** every event with `Clock.currentTimeMillis`
 *   - **Stamps origin** automatically with the node's `Identity.nodeId`
 *   - **Records** by writing to the registry's `EventLog`
 *
 * Callers pass ergonomic domain values; the Notary handles all the
 * registry-event metadata. This is the production write surface;
 * `EventLog.write` and the lower-level `Publish` helpers remain
 * available for tests, federation simulation, and migration tooling
 * that need explicit metadata control.
 *
 * @module @tmnl/pct/notary/Notary
 */

import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type * as Schema from "effect/Schema"
import type * as EventJournal from "effect/unstable/eventlog/EventJournal"

import type { SchemaId } from "../contracts/Brands.js"
import type { Procedure } from "../procedures/Procedure.js"
import type { ProcedureGroup } from "../procedures/ProcedureGroup.js"
import type {
  PublishedProcedure,
  PublishResult,
} from "../publish/Publish.js"

// ─── Service shape ──────────────────────────────────────────────────────────

export interface DeprecateOptions {
  readonly successor?: SchemaId | string
  readonly reason: string
}

export interface RegisterSchemaOptions {
  readonly description?: string
}

export interface NotaryShape {
  /**
   * Publish an entire ProcedureGroup. Decomposes each procedure into
   * SchemaRegistered + OperationRegistered events. Auto-stamps origin
   * and time.
   */
  readonly publish: (
    group: ProcedureGroup,
  ) => Effect.Effect<PublishResult, EventJournal.EventJournalError>

  /**
   * Publish a single procedure. Same auto-stamping as `publish`.
   */
  readonly publishProcedure: (
    procedure: Procedure,
  ) => Effect.Effect<PublishedProcedure, EventJournal.EventJournalError>

  /**
   * Register a single schema directly (without procedure context).
   */
  readonly registerSchema: (
    name: string,
    version: string,
    schema: Schema.Top,
    options?: RegisterSchemaOptions,
  ) => Effect.Effect<{ readonly schemaId: string }, EventJournal.EventJournalError>

  /**
   * Mark a schema version as deprecated. Auto-stamps origin + time.
   */
  readonly deprecateSchema: (
    schemaName: string,
    version: string,
    options: DeprecateOptions,
  ) => Effect.Effect<void, EventJournal.EventJournalError>

  /**
   * Mark an operation version as deprecated. Auto-stamps origin + time.
   */
  readonly deprecateOperation: (
    operationName: string,
    version: string,
    options: DeprecateOptions,
  ) => Effect.Effect<void, EventJournal.EventJournalError>
}

// ─── Service tag ────────────────────────────────────────────────────────────

/**
 * The Notary service. Provided by `Notary.Default` (which depends on
 * `Identity` + `EventLog.EventLog`).
 *
 * Consumers `yield* Notary` and call high-level methods like
 * `notary.publish(group)` without managing identity, time, or
 * EventLogSchema references.
 */
export class Notary extends Context.Service<Notary, NotaryShape>()(
  "@tmnl/pct/notary/Notary",
) {}
