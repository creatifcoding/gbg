/**
 * AMS v2 Provenance Schema
 *
 * Audit trail for property values — who/what set it, when, confidence level.
 *
 * @module @gbg/tmnl/ams/v2/core/schemas/provenance
 */

import { Schema } from 'effect';
import { IdentityId } from './identifiers';
import { CreatedAt } from './timestamps';

// ─────────────────────────────────────────────────────────────────────────────
// Source Type
// ─────────────────────────────────────────────────────────────────────────────

// TODO: SourceTypes need to be made flexible in the core, need concretes, but allow for abstract extension. Profiles will define SourceTypes. This Schema.Literal will be attached to, or just have a corresponding Schema.TaggedClass that is the acquistion workflow itself. The sourcetype would be derived.
// TODO: Need a robust way of programmatically sharing descriptions, rules and policy for particular SourceTypes, and more specific SourceTypes, like e.g. a particular agent.
export const SourceType = Schema.Literal(
  'manual',
  'sensor',
  'ingestion_agent',
  'external_system'
).pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Provenance/fields/SourceType'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/SourceType',
    description: 'Source type for a property value',
  })
);
export type SourceType = typeof SourceType.Type;

// ─────────────────────────────────────────────────────────────────────────────
// Confidence
// ─────────────────────────────────────────────────────────────────────────────

// TODO: Confidence is computed during Sourcing workflows.
export const Confidence = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(1),
  Schema.brand('@gbg/tmnl/ams/v2/Provenance/fields/Confidence'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/Confidence',
    description: 'Confidence score 0..1 for property value',
  })
);
export type Confidence = typeof Confidence.Type;

// ─────────────────────────────────────────────────────────────────────────────
// Attestation Reference
// ─────────────────────────────────────────────────────────────────────────────

// TODO: Attestation ref is computed during Sourcing workflows.
export const AttestationRef = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('@gbg/tmnl/ams/v2/Provenance/fields/AttestationRef'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/AttestationRef',
    description: 'Reference to on-chain attestation (e.g., Sui object ID)',
  })
);
export type AttestationRef = typeof AttestationRef.Type;

// ─────────────────────────────────────────────────────────────────────────────
// Provenance Record
// ─────────────────────────────────────────────────────────────────────────────
// TODO: Provenance record is computed during Sourcing workflows.
export class Provenance extends Schema.TaggedClass<Provenance>()('Provenance', {
  sourceType: SourceType,
  sourceId: Schema.optional(IdentityId),
  timestamp: CreatedAt,
  confidence: Schema.optional(Confidence),
  attestationRef: Schema.optional(AttestationRef),
}) {
  /**
   * Check if this provenance indicates high confidence (>= 0.8)
   */
  isHighConfidence(): boolean {
    return this.confidence !== undefined && this.confidence >= 0.8;
  }

  /**
   * Check if this provenance has on-chain attestation
   */
  isAttested(): boolean {
    return this.attestationRef !== undefined;
  }
}
export type ProvenanceType = typeof Provenance.Type;
