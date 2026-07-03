/**
 * Prospect Pipeline — Value Object Schemas
 *
 * Rich domain types for monetary values, locations, headcounts, contacts,
 * tenure, contract estimates, and capability matching.
 *
 * Each type is a Schema.TaggedStruct for discrimination and runtime validation.
 * These get stored as JSON TEXT columns in SQLite via Model.JsonFromString.
 *
 * @module prospects/schemas/value-objects
 */

import { Schema } from 'effect'

// =============================================================================
// Currency (shared by MoneyRange and ContractEstimate)
// =============================================================================

export const Currency = Schema.Literal('USD', 'EUR', 'GBP', 'CAD', 'AUD')
export type Currency = typeof Currency.Type

export const Confidence = Schema.Literal('exact', 'estimated', 'range', 'unknown')
export type Confidence = typeof Confidence.Type

// =============================================================================
// MoneyRange — revenue, budgets, any dollar amounts
// =============================================================================

export const MoneyRange = Schema.TaggedStruct('MoneyRange', {
  /** Lower bound in cents (avoids floating point) */
  lowCents: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  /** Upper bound in cents. Absent = open-ended ("$5B+") */
  highCents: Schema.optional(Schema.Number.pipe(Schema.int())),
  currency: Schema.optional(Currency),
  confidence: Schema.optional(Confidence),
  /** Where this number came from */
  source: Schema.optional(Schema.String),
})
export type MoneyRange = typeof MoneyRange.Type

/** Format a MoneyRange for display */
export const formatMoney = (m: MoneyRange): string => {
  const fmt = (cents: number): string => {
    if (cents >= 100_000_000_000) return `$${(cents / 100_000_000_000).toFixed(0)}B`
    if (cents >= 100_000_000) return `$${(cents / 100_000_000).toFixed(0)}M`
    if (cents >= 100_000) return `$${(cents / 100_000).toFixed(0)}K`
    return `$${(cents / 100).toFixed(0)}`
  }
  if (m.highCents == null) return `${fmt(m.lowCents)}+`
  if (m.lowCents === m.highCents) return fmt(m.lowCents)
  return `${fmt(m.lowCents)} – ${fmt(m.highCents)}`
}

/** Parse common revenue strings into MoneyRange */
export const parseMoneyRange = (raw: string): MoneyRange | null => {
  const clean = raw.replace(/[,\s]/g, '').toUpperCase()

  // "$5B+" pattern
  const plusMatch = clean.match(/^\$?([\d.]+)(K|M|B)\+?$/i)
  if (plusMatch) {
    const [, num, unit] = plusMatch
    const multiplier = unit === 'B' ? 100_000_000_000 : unit === 'M' ? 100_000_000 : 100_000
    return { _tag: 'MoneyRange', lowCents: Math.round(parseFloat(num) * multiplier), confidence: 'estimated' }
  }

  // "$50M-$200M" or "$50-200M" pattern
  const rangeMatch = clean.match(/^\$?([\d.]+)(K|M|B)?[-–]\$?([\d.]+)(K|M|B)?$/i)
  if (rangeMatch) {
    const [, lo, loUnit, hi, hiUnit] = rangeMatch
    const loMult = (loUnit ?? hiUnit ?? 'M') === 'B' ? 100_000_000_000 : (loUnit ?? hiUnit ?? 'M') === 'K' ? 100_000 : 100_000_000
    const hiMult = (hiUnit ?? loUnit ?? 'M') === 'B' ? 100_000_000_000 : (hiUnit ?? loUnit ?? 'M') === 'K' ? 100_000 : 100_000_000
    return {
      _tag: 'MoneyRange',
      lowCents: Math.round(parseFloat(lo) * loMult),
      highCents: Math.round(parseFloat(hi) * hiMult),
      confidence: 'range',
    }
  }

  return null
}

// =============================================================================
// GeoLocation — structured geography
// =============================================================================

export const GeoRegion = Schema.Literal(
  'northeast', 'southeast', 'midwest', 'southwest',
  'west', 'pacific', 'mountain',
  'uk', 'eu_west', 'eu_central', 'asia_pacific',
  'middle_east', 'other'
)
export type GeoRegion = typeof GeoRegion.Type

export const GeoLocation = Schema.TaggedStruct('GeoLocation', {
  city: Schema.optional(Schema.String),
  /** 2-letter code for US states, full name otherwise */
  state: Schema.optional(Schema.String),
  /** ISO 3166-1 alpha-2 */
  country: Schema.optional(Schema.String),
  region: Schema.optional(GeoRegion),
  /** IANA timezone identifier */
  timezone: Schema.optional(Schema.String),
  lat: Schema.optional(Schema.Number),
  lng: Schema.optional(Schema.Number),
  /** Original freetext preserved for display */
  formatted: Schema.optional(Schema.String),
})
export type GeoLocation = typeof GeoLocation.Type

/** US state to region mapping */
const US_REGIONS: Record<string, GeoRegion> = {
  CT: 'northeast', MA: 'northeast', ME: 'northeast', NH: 'northeast', NJ: 'northeast', NY: 'northeast', PA: 'northeast', RI: 'northeast', VT: 'northeast',
  AL: 'southeast', FL: 'southeast', GA: 'southeast', KY: 'southeast', LA: 'southeast', MS: 'southeast', NC: 'southeast', SC: 'southeast', TN: 'southeast', VA: 'southeast', WV: 'southeast',
  IA: 'midwest', IL: 'midwest', IN: 'midwest', KS: 'midwest', MI: 'midwest', MN: 'midwest', MO: 'midwest', ND: 'midwest', NE: 'midwest', OH: 'midwest', SD: 'midwest', WI: 'midwest',
  AZ: 'southwest', NM: 'southwest', OK: 'southwest', TX: 'southwest',
  CA: 'west', CO: 'west', NV: 'west', OR: 'west', UT: 'west', WA: 'west', WY: 'west',
  AK: 'pacific', HI: 'pacific',
  ID: 'mountain', MT: 'mountain',
}

/** Parse freetext location into structured GeoLocation */
export const parseLocation = (raw: string): GeoLocation => {
  const parts = raw.split(',').map((s) => s.trim())
  const geo: GeoLocation = { _tag: 'GeoLocation', formatted: raw }

  if (parts.length >= 3) {
    geo.city = parts[0]
    geo.state = parts[1]
    geo.country = parts[2]
  } else if (parts.length === 2) {
    // "Memphis, TN" or "London, UK"
    geo.city = parts[0]
    const second = parts[1].toUpperCase()
    if (second.length === 2 && US_REGIONS[second]) {
      geo.state = second
      geo.country = 'US'
      geo.region = US_REGIONS[second]
    } else {
      geo.country = parts[1]
    }
  } else {
    geo.city = parts[0]
  }

  // Derive region from US state
  if (geo.state && !geo.region) {
    const upper = geo.state.toUpperCase()
    if (US_REGIONS[upper]) geo.region = US_REGIONS[upper]
  }

  return geo
}

// =============================================================================
// HeadcountEstimate — employee count with provenance
// =============================================================================

export const HeadcountSource = Schema.Literal(
  'linkedin', 'crunchbase', 'glassdoor', 'website',
  'sec_filing', 'manual', 'other'
)

export const HeadcountEstimate = Schema.TaggedStruct('HeadcountEstimate', {
  low: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  high: Schema.optional(Schema.Number.pipe(Schema.int())),
  source: Schema.optional(HeadcountSource),
  confidence: Schema.optional(Confidence),
  observedAt: Schema.optional(Schema.DateFromString),
  /** Year-over-year delta as decimal (+0.15 = 15% growth) */
  yoyDelta: Schema.optional(Schema.Number),
})
export type HeadcountEstimate = typeof HeadcountEstimate.Type

// =============================================================================
// ContactMethod — typed multi-channel contact info
// =============================================================================

export const ContactChannel = Schema.Literal(
  'email', 'phone', 'linkedin', 'twitter',
  'website', 'github', 'other'
)

export const ContactLabel = Schema.Literal('work', 'personal', 'main', 'assistant')

export const ContactMethod = Schema.TaggedStruct('ContactMethod', {
  channel: ContactChannel,
  value: Schema.NonEmptyString,
  label: Schema.optional(ContactLabel),
  verified: Schema.optional(Schema.Boolean),
  verifiedAt: Schema.optional(Schema.DateFromString),
  isPrimary: Schema.optional(Schema.Boolean),
  source: Schema.optional(Schema.String),
})
export type ContactMethod = typeof ContactMethod.Type

export const ContactInfo = Schema.Array(ContactMethod)
export type ContactInfo = typeof ContactInfo.Type

// =============================================================================
// RoleTenure — time in current role with origin context
// =============================================================================

export const TenureOrigin = Schema.Literal(
  'external_hire', 'internal_promotion', 'founder', 'unknown'
)

export const RoleTenure = Schema.TaggedStruct('RoleTenure', {
  startedAt: Schema.optional(Schema.DateFromString),
  origin: Schema.optional(TenureOrigin),
  previousRole: Schema.optional(Schema.String),
  previousCompany: Schema.optional(Schema.String),
})
export type RoleTenure = typeof RoleTenure.Type

/** Is this person new in their role? (<12 months) */
export const isNewInRole = (t: RoleTenure): boolean => {
  if (!t.startedAt) return false
  const months =
    (Date.now() - new Date(t.startedAt).getTime()) / (30 * 24 * 60 * 60 * 1000)
  return months < 12
}

// =============================================================================
// ContractEstimate — our opportunity size
// =============================================================================

export const BillingModel = Schema.Literal(
  'fixed', 'time_and_materials', 'retainer', 'milestone', 'unknown'
)

export const DealConfidence = Schema.Literal('guess', 'informed', 'quoted', 'agreed')

export const ContractEstimate = Schema.TaggedStruct('ContractEstimate', {
  lowCents: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  highCents: Schema.optional(Schema.Number.pipe(Schema.int())),
  durationMonths: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1), Schema.lessThanOrEqualTo(36))
  ),
  billing: Schema.optional(BillingModel),
  /** Win probability 0–1 */
  probability: Schema.optional(
    Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(1))
  ),
  confidence: Schema.optional(DealConfidence),
  notes: Schema.optional(Schema.String),
})
export type ContractEstimate = typeof ContractEstimate.Type

/** Weighted pipeline value in cents */
export const weightedValue = (e: ContractEstimate): number => {
  const mid = e.highCents != null
    ? (e.lowCents + e.highCents) / 2
    : e.lowCents
  return mid * (e.probability ?? 0.5)
}

// =============================================================================
// CapabilityMatch — what TMNL modules fit this prospect
// =============================================================================

export const Capability = Schema.Literal(
  'work_orders', 'dashboards', 'ai_rag', 'scada_hmi',
  'asset_mgmt', 'geospatial', 'streams', 'data_integration',
  'erp_slice', 'mobile_field', 'compliance', 'analytics'
)
export type Capability = typeof Capability.Type

export const CapabilityMatch = Schema.Struct({
  capability: Capability,
  /** 0–1 fit score */
  fit: Schema.Number.pipe(
    Schema.greaterThanOrEqualTo(0),
    Schema.lessThanOrEqualTo(1)
  ),
  rationale: Schema.optional(Schema.String),
})
export type CapabilityMatch = typeof CapabilityMatch.Type

export const CapabilityProfile = Schema.Array(CapabilityMatch)
export type CapabilityProfile = typeof CapabilityProfile.Type
