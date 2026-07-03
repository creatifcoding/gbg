/**
 * Prospect Pipeline — SQLite Schema Transforms
 *
 * Custom Schema.transform helpers for SQLite column ↔ TypeScript type
 * bidirectional conversion. Following the AMS v2 NullableJsonFromString pattern.
 *
 * @module prospects/models/_transforms
 */

import { Option, Schema } from 'effect'
import {
  MoneyRange,
  GeoLocation,
  HeadcountEstimate,
  ContactMethod,
  RoleTenure,
  ContractEstimate,
  CapabilityMatch,
} from '../schemas/value-objects'

// =============================================================================
// Generic Nullable JSON ↔ Option<T>
// =============================================================================

/**
 * Typed nullable JSON transform for SQLite.
 *
 * DB: null | JSON TEXT string
 * TS: Option<T>
 *
 * Uses Schema.OptionFromSelf (NOT Schema.Option) to avoid the
 * OptionEncoded { _tag, value } wrapper. See AMS asset.ts for rationale.
 */
export const NullableTypedJson = <A, I>(schema: Schema.Schema<A, I>) =>
  Schema.transform(
    Schema.NullOr(Schema.String),
    Schema.OptionFromSelf(schema),
    {
      strict: true,
      decode: (encoded) =>
        encoded === null
          ? Option.none()
          : Option.some(JSON.parse(encoded) as A),
      encode: (decoded) =>
        Option.isNone(decoded) ? null : JSON.stringify(decoded.value),
    }
  )

// =============================================================================
// Typed JSON (non-nullable) — required field stored as JSON TEXT
// =============================================================================

/**
 * Required typed JSON transform.
 *
 * DB: JSON TEXT string (NOT NULL)
 * TS: T
 */
export const TypedJson = <A, I>(schema: Schema.Schema<A, I>) =>
  Schema.transform(Schema.String, schema, {
    strict: true,
    decode: (encoded) => JSON.parse(encoded) as A,
    encode: (decoded) => JSON.stringify(decoded),
  })

// =============================================================================
// PG JSONB Transforms — native objects, not strings
// =============================================================================

/**
 * PG JSONB nullable → Option<T>
 *
 * PG driver returns JSONB as parsed JS objects (not strings).
 * On write, pass the object directly — PG driver serializes.
 */
export const NullableJsonb = <A, I>(schema: Schema.Schema<A, I>) =>
  Schema.transform(
    Schema.NullOr(Schema.Unknown),
    Schema.OptionFromSelf(schema),
    {
      strict: true,
      decode: (encoded) =>
        encoded === null ? Option.none() : Option.some(encoded as A),
      encode: (decoded) =>
        Option.isNone(decoded) ? null : JSON.stringify(decoded.value),
    }
  )

/**
 * PG JSONB required → T
 *
 * Read: PG driver returns parsed JS objects → pass through as T.
 * Write: JSON.stringify for pg driver parameter binding.
 */
export const Jsonb = <A, I>(schema: Schema.Schema<A, I>) =>
  Schema.transform(Schema.Unknown, schema, {
    strict: true,
    decode: (encoded) => encoded as A,
    encode: (decoded) => JSON.stringify(decoded),
  })

// =============================================================================
// Pre-built transforms for our value objects
// =============================================================================

/** MoneyRange: NULL | JSON TEXT ↔ Option<MoneyRange> */
export const MoneyRangeFromJson = NullableTypedJson(MoneyRange)

/** GeoLocation: NULL | JSON TEXT ↔ Option<GeoLocation> */
export const GeoLocationFromJson = NullableTypedJson(GeoLocation)

/** HeadcountEstimate: NULL | JSON TEXT ↔ Option<HeadcountEstimate> */
export const HeadcountFromJson = NullableTypedJson(HeadcountEstimate)

/** ContactMethod[]: NULL | JSON TEXT ↔ Option<ContactMethod[]> */
export const ContactInfoFromJson = NullableTypedJson(Schema.Array(ContactMethod))

/** RoleTenure: NULL | JSON TEXT ↔ Option<RoleTenure> */
export const RoleTenureFromJson = NullableTypedJson(RoleTenure)

/** ContractEstimate: NULL | JSON TEXT ↔ Option<ContractEstimate> */
export const ContractEstimateFromJson = NullableTypedJson(ContractEstimate)

/** CapabilityMatch[]: NULL | JSON TEXT ↔ Option<CapabilityMatch[]> */
export const CapabilityProfileFromJson = NullableTypedJson(Schema.Array(CapabilityMatch))

/** String[] tags: NULL | JSON TEXT ↔ Option<string[]> */
export const TagsFromJson = NullableTypedJson(Schema.Array(Schema.String))
