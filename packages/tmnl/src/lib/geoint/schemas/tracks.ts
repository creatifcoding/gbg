import { Schema } from 'effect'
import { TrackId, Classification, ObjectType } from './core'

// =============================================================================
// Track Position
// =============================================================================

/** A single position update for a track */
export class TrackPosition extends Schema.TaggedClass<TrackPosition>(
  'TrackPosition'
)('TrackPosition', {
  /** Latitude in decimal degrees */
  lat: Schema.Number.pipe(Schema.between(-90, 90)),

  /** Longitude in decimal degrees */
  lon: Schema.Number.pipe(Schema.between(-180, 180)),

  /** Timestamp of this position */
  timestamp: Schema.Date,

  /** Heading in degrees (0-360, 0=North) */
  heading: Schema.Number.pipe(Schema.between(0, 360)),

  /** Speed in knots */
  speed: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),

  /** Altitude in meters (optional, defaults to 0) */
  altitude: Schema.optionalWith(Schema.Number, { default: () => 0 })
}) {}

// =============================================================================
// Track Metadata
// =============================================================================

/** Metadata about a tracked object */
export class TrackMetadata extends Schema.TaggedClass<TrackMetadata>(
  'TrackMetadata'
)('TrackMetadata', {
  /** Type of object being tracked */
  objectType: ObjectType,

  /** Confidence score (0-1) */
  confidence: Schema.Number.pipe(Schema.between(0, 1)),

  /** Classification (friend/foe identification) */
  classification: Schema.optionalWith(Classification, {
    default: () => 'unknown' as const
  }),

  /** Source of the track data */
  source: Schema.String
}) {}

// =============================================================================
// Track
// =============================================================================

/** A complete track with position history */
export class Track extends Schema.TaggedClass<Track>('Track')('Track', {
  /** Unique track identifier */
  trackId: TrackId,

  /** Array of positions (chronologically ordered) */
  positions: Schema.Array(TrackPosition),

  /** Track metadata */
  metadata: TrackMetadata
}) {
  /** Get the most recent position */
  get latestPosition(): TrackPosition | undefined {
    return this.positions[this.positions.length - 1]
  }

  /** Get track duration in milliseconds */
  get duration(): number {
    if (this.positions.length < 2) return 0
    const first = this.positions[0].timestamp.getTime()
    const last = this.positions[this.positions.length - 1].timestamp.getTime()
    return last - first
  }
}

// =============================================================================
// Track Update Events
// =============================================================================

/** A position update event for appending to a track */
export class TrackPositionUpdate extends Schema.TaggedClass<TrackPositionUpdate>(
  'TrackPositionUpdate'
)('TrackPositionUpdate', {
  /** Track ID to update */
  trackId: TrackId,

  /** New position data */
  position: TrackPosition,

  /** Event timestamp */
  eventTimestamp: Schema.Date
}) {}

/** A classification change event */
export class TrackClassificationUpdate extends Schema.TaggedClass<TrackClassificationUpdate>(
  'TrackClassificationUpdate'
)('TrackClassificationUpdate', {
  /** Track ID to update */
  trackId: TrackId,

  /** New classification */
  classification: Classification,

  /** Reason for classification change */
  reason: Schema.optionalWith(Schema.String, { default: () => '' }),

  /** Event timestamp */
  eventTimestamp: Schema.Date
}) {}

// =============================================================================
// Track Queries
// =============================================================================

/** Query parameters for fetching tracks */
export const TrackQuery = Schema.Struct({
  /** Only return active tracks */
  active: Schema.optionalWith(Schema.Boolean, { default: () => true }),

  /** Filter by object type */
  objectType: Schema.optional(ObjectType),

  /** Filter by classification */
  classification: Schema.optional(Classification),

  /** Minimum confidence threshold */
  minConfidence: Schema.optionalWith(Schema.Number.pipe(Schema.between(0, 1)), {
    default: () => 0
  }),

  /** Maximum number of tracks to return */
  limit: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), {
    default: () => 100
  })
})
export type TrackQuery = typeof TrackQuery.Type

// =============================================================================
// Track Event Union (for pattern matching)
// =============================================================================

/** Union of all track-related events */
export const TrackEvent = Schema.Union(TrackPositionUpdate, TrackClassificationUpdate)
export type TrackEvent = typeof TrackEvent.Type
