/**
 * Provenance Writer — shared by all entity handlers.
 *
 * Thin bridge: builds FieldWrite entries from an entity payload
 * and dispatches to ProvenanceService.trackBatch.
 *
 * NOT a service itself — a utility function that handlers call inline.
 *
 * @module prospects/entity/handlers/_provenance
 */

import { Effect } from 'effect'
import { ProvenanceService } from '../../services/provenance'
import type { FieldWrite, ProvenanceSource, ProvenanceTransform, EntityType } from '../../services/provenance'

/**
 * Build FieldWrite entries from a flat record and dispatch to provenance.
 *
 * @param entityType - Which entity table
 * @param entityId - Row ID
 * @param source - Where the data came from
 * @param fields - Key-value pairs to track, with per-field overrides
 */
export const trackFields = (
  entityType: EntityType,
  entityId: string,
  source: ProvenanceSource,
  fields: ReadonlyArray<{
    readonly name: string
    readonly value: string | null
    readonly confidence?: number
    readonly transform?: ProvenanceTransform
  }>
): Effect.Effect<void, unknown, ProvenanceService> =>
  Effect.gen(function* () {
    const provenance = yield* ProvenanceService

    const writes: ReadonlyArray<FieldWrite> = fields
      .filter((f) => f.value !== undefined)
      .map((f) => ({
        entityType,
        entityId,
        fieldName: f.name,
        value: f.value,
        source,
        transform: f.transform,
        confidence: f.confidence ?? 0.8,
      }))

    if (writes.length > 0) {
      yield* provenance.trackBatch(writes)
    }
  })
