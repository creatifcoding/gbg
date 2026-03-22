/**
 * AMS v2 Policy Schema
 *
 * Enrichment, access, and governance policies.
 *
 * @module @gbg/tmnl/ams/v2/base/schemas/policy
 */

import { Schema } from 'effect'
import { PolicyId, SiteId, SectorId, IdentityId } from '../../core/schemas/identifiers'
import { CreatedAt, UpdatedAt } from '../../core/schemas/timestamps'

// ─────────────────────────────────────────────────────────────────────────────
// Enrichment Mode
// ─────────────────────────────────────────────────────────────────────────────

export const EnrichmentMode = Schema.Literal('manual', 'automated', 'hybrid').pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Policy/fields/EnrichmentMode'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/EnrichmentMode',
    description: 'Mode of enrichment execution',
  })
)
export type EnrichmentMode = typeof EnrichmentMode.Type

// ─────────────────────────────────────────────────────────────────────────────
// Enrichment Strategy
// ─────────────────────────────────────────────────────────────────────────────

export const EnrichmentStrategy = Schema.Literal('refresh', 'fill_missing', 'risk_based').pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Policy/fields/EnrichmentStrategy'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/EnrichmentStrategy',
    description: 'Strategy for enrichment execution',
  })
)
export type EnrichmentStrategy = typeof EnrichmentStrategy.Type

// ─────────────────────────────────────────────────────────────────────────────
// Enrichment Policy
// ─────────────────────────────────────────────────────────────────────────────

export class EnrichmentPolicy extends Schema.TaggedClass<EnrichmentPolicy>()('EnrichmentPolicy', {
  id: PolicyId,
  mode: EnrichmentMode,
  allowedAgentIds: Schema.Array(IdentityId),
  maxSpendPerHour: Schema.Number.pipe(Schema.positive()),
  strategy: EnrichmentStrategy,
  createdAt: CreatedAt,
  updatedAt: UpdatedAt,
}) {}
export type EnrichmentPolicyType = typeof EnrichmentPolicy.Type

// ─────────────────────────────────────────────────────────────────────────────
// Budget Pool
// ─────────────────────────────────────────────────────────────────────────────

export const BudgetScope = Schema.Literal('site', 'sector', 'aggregate').pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Policy/fields/BudgetScope'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/BudgetScope',
    description: 'Scope level for budget allocation',
  })
)
export type BudgetScope = typeof BudgetScope.Type

export class BudgetPool extends Schema.TaggedClass<BudgetPool>()('BudgetPool', {
  id: PolicyId,
  scope: BudgetScope,
  siteId: Schema.optional(SiteId),
  sectorId: Schema.optional(SectorId),
  budgetAmount: Schema.Number.pipe(Schema.positive()),
  currency: Schema.String.pipe(Schema.minLength(3), Schema.maxLength(3)), // ISO 4217
  windowHours: Schema.Number.pipe(Schema.positive()),
  createdAt: CreatedAt,
  updatedAt: UpdatedAt,
}) {
  /**
   * Calculate hourly rate for this budget pool
   */
  hourlyRate(): number {
    return this.budgetAmount / this.windowHours
  }
}
export type BudgetPoolType = typeof BudgetPool.Type
