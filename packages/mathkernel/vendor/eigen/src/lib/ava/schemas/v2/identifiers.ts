/**
 * AVA v2 Identifier Schemas
 *
 * Branded identifier types matching proto ava/common/v1/identifiers.proto.
 * These provide compile-time type safety to prevent mixing different ID types.
 *
 * @pattern Effect Schema branded types
 * @see src-ava/proto/ava/common/v1/identifiers.proto
 * @module
 */

import { Schema } from 'effect'

// ============================================================================
// Branded Identifier Types
// ============================================================================

/**
 * ViewId - Unique identifier for a registered view profile
 * Proto: ava.common.v1.ViewId
 */
export const ViewId = Schema.String.pipe(
  Schema.brand('ViewId'),
  Schema.annotations({
    title: 'ViewId',
    description: 'Unique identifier for a registered view profile',
  })
)
export type ViewId = typeof ViewId.Type

/** Construct a ViewId from a string */
export const makeViewId = (value: string): ViewId => value as ViewId

// ----------------------------------------------------------------------------

/**
 * ChannelId - Unique identifier for a data channel within a view
 * Proto: ava.common.v1.ChannelId
 */
export const ChannelId = Schema.String.pipe(
  Schema.brand('ChannelId'),
  Schema.annotations({
    title: 'ChannelId',
    description: 'Unique identifier for a data channel within a view',
  })
)
export type ChannelId = typeof ChannelId.Type

/** Construct a ChannelId from a string */
export const makeChannelId = (value: string): ChannelId => value as ChannelId

// ----------------------------------------------------------------------------

/**
 * AssemblageId - Unique identifier for an asset assemblage/collection
 * Proto: ava.common.v1.AssemblageId
 */
export const AssemblageId = Schema.String.pipe(
  Schema.brand('AssemblageId'),
  Schema.annotations({
    title: 'AssemblageId',
    description: 'Unique identifier for an asset assemblage/collection',
  })
)
export type AssemblageId = typeof AssemblageId.Type

/** Construct an AssemblageId from a string */
export const makeAssemblageId = (value: string): AssemblageId =>
  value as AssemblageId

// ----------------------------------------------------------------------------

/**
 * AssetId - Unique identifier for an asset in the AMS
 * Proto: ava.common.v1.AssetId
 */
export const AssetId = Schema.String.pipe(
  Schema.brand('AssetId'),
  Schema.annotations({
    title: 'AssetId',
    description: 'Unique identifier for an asset in the AMS',
  })
)
export type AssetId = typeof AssetId.Type

/** Construct an AssetId from a string */
export const makeAssetId = (value: string): AssetId => value as AssetId

// ----------------------------------------------------------------------------

/**
 * SourceId - Unique identifier for a data source
 * Proto: ava.common.v1.SourceId
 */
export const SourceId = Schema.String.pipe(
  Schema.brand('SourceId'),
  Schema.annotations({
    title: 'SourceId',
    description: 'Unique identifier for a data source',
  })
)
export type SourceId = typeof SourceId.Type

/** Construct a SourceId from a string */
export const makeSourceId = (value: string): SourceId => value as SourceId

// ----------------------------------------------------------------------------

/**
 * FiberId - Unique identifier for a reconciler fiber
 * Proto: ava.common.v1.FiberId
 */
export const FiberId = Schema.String.pipe(
  Schema.brand('FiberId'),
  Schema.annotations({
    title: 'FiberId',
    description: 'Unique identifier for a reconciler fiber',
  })
)
export type FiberId = typeof FiberId.Type

/** Construct a FiberId from a string */
export const makeFiberId = (value: string): FiberId => value as FiberId

// ----------------------------------------------------------------------------

/**
 * SessionId - Client session identifier for multiplexed connections
 * Proto: ava.common.v1.SessionId
 */
export const SessionId = Schema.String.pipe(
  Schema.brand('SessionId'),
  Schema.annotations({
    title: 'SessionId',
    description: 'Client session identifier for multiplexed connections',
  })
)
export type SessionId = typeof SessionId.Type

/** Construct a SessionId from a string */
export const makeSessionId = (value: string): SessionId => value as SessionId

// ----------------------------------------------------------------------------

/**
 * CorrelationId - Request correlation for distributed tracing
 * Proto: ava.common.v1.CorrelationId
 */
export const CorrelationId = Schema.String.pipe(
  Schema.brand('CorrelationId'),
  Schema.annotations({
    title: 'CorrelationId',
    description: 'Request correlation for distributed tracing',
  })
)
export type CorrelationId = typeof CorrelationId.Type

/** Construct a CorrelationId from a string */
export const makeCorrelationId = (value: string): CorrelationId =>
  value as CorrelationId

// ----------------------------------------------------------------------------

/**
 * EventSequence - Monotonic sequence number for event ordering
 * Proto: ava.common.v1.EventSequence (uint64 → bigint)
 *
 * Note: JSON transport uses string to preserve precision for u64
 */
export const EventSequence = Schema.BigInt.pipe(
  Schema.brand('EventSequence'),
  Schema.annotations({
    title: 'EventSequence',
    description: 'Monotonic sequence number for event ordering',
  })
)
export type EventSequence = typeof EventSequence.Type

/** Construct an EventSequence from a bigint */
export const makeEventSequence = (value: bigint): EventSequence =>
  value as EventSequence

/**
 * EventSequence schema for JSON transport (string → bigint)
 * Use this when decoding from JSON where u64 is serialized as string
 */
export const EventSequenceFromString = Schema.transform(
  Schema.String,
  Schema.BigIntFromSelf.pipe(Schema.brand('EventSequence')),
  {
    strict: true,
    decode: (s) => BigInt(s),
    encode: (n) => n.toString(),
  }
).pipe(
  Schema.annotations({
    title: 'EventSequenceFromString',
    description: 'EventSequence decoded from JSON string representation',
  })
)
