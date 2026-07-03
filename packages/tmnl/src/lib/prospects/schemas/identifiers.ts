/**
 * Prospect Pipeline — Branded Identifiers
 *
 * Type-safe branded IDs for all prospect pipeline entities.
 *
 * @module prospects/schemas/identifiers
 */

import { Schema } from 'effect'

// =============================================================================
// Branded IDs
// =============================================================================

/** Unique identifier for a company/org in the pipeline */
export const CompanyId = Schema.String.pipe(
  Schema.brand('CompanyId'),
  Schema.minLength(1)
)
export type CompanyId = typeof CompanyId.Type

/** Unique identifier for a decision maker */
export const DecisionMakerId = Schema.String.pipe(
  Schema.brand('DecisionMakerId'),
  Schema.minLength(1)
)
export type DecisionMakerId = typeof DecisionMakerId.Type

/** Unique identifier for a signal (hiring post, RFP, news item, etc.) */
export const SignalId = Schema.String.pipe(
  Schema.brand('SignalId'),
  Schema.minLength(1)
)
export type SignalId = typeof SignalId.Type

/** Unique identifier for an outreach attempt */
export const OutreachId = Schema.String.pipe(
  Schema.brand('OutreachId'),
  Schema.minLength(1)
)
export type OutreachId = typeof OutreachId.Type

/** Unique identifier for an enrichment record */
export const EnrichmentId = Schema.String.pipe(
  Schema.brand('EnrichmentId'),
  Schema.minLength(1)
)
export type EnrichmentId = typeof EnrichmentId.Type
