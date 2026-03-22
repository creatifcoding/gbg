/**
 * Track Entity - Generic Tracked Objects
 *
 * Represents generic tracked objects (vehicles, vessels, persons).
 * Composes: Spatial, Temporal, Kinetic, Classified, Identifiable traits
 *
 * @module geoint/entities/track
 */

import { Schema } from 'effect'
import { EntityId, Confidence, EntityProvenance } from '@/lib/ecs'
import {
  SpatialTrait,
  TemporalTrait,
  KineticTrait,
  ClassifiedTrait,
  IdentifiableTrait,
} from '../schemas/traits'

// =============================================================================
// Track-Specific Schemas
// =============================================================================

/**
 * Track status.
 */
export const TrackStatus = Schema.Literal(
  'active',     // Currently being tracked
  'coasting',   // No recent updates, extrapolating
  'lost',       // Lost track
  'terminated'  // Manually terminated
).pipe(
  Schema.annotations({
    identifier: 'TrackStatus',
    title: 'Track Status',
    description: 'Current tracking status.',
  })
)
export type TrackStatus = typeof TrackStatus.Type

/**
 * Track source type.
 */
export const TrackSourceType = Schema.Literal(
  'radar',
  'ais',
  'adsb',
  'visual',
  'ir',
  'sigint',
  'fusion',
  'manual'
).pipe(
  Schema.annotations({
    identifier: 'TrackSourceType',
    title: 'Track Source Type',
    description: 'Type of sensor/source that generated this track.',
  })
)
export type TrackSourceType = typeof TrackSourceType.Type

// =============================================================================
// Track Entity
// =============================================================================

/**
 * Track entity - generic tracked object (vehicle, vessel, person).
 */
export class TrackEntity extends Schema.TaggedClass<TrackEntity>()(
  'TrackEntity',
  {
    // Base entity fields
    id: EntityId,
    entityType: Schema.Literal('track'),
    provenance: EntityProvenance,
    metadata: Schema.optionalWith(
      Schema.Record({ key: Schema.String, value: Schema.Unknown }),
      { default: () => ({}) }
    ),

    // Embedded traits
    spatial: SpatialTrait,
    temporal: TemporalTrait,
    kinetic: KineticTrait,
    classified: ClassifiedTrait,
    identifiable: IdentifiableTrait,

    // Track-specific fields
    /** Track ID (domain-specific identifier). */
    trackId: Schema.String,
    /** Last position seen timestamp. */
    lastSeen: Schema.Date,
    /** Track quality score (0-1). */
    trackQuality: Schema.optionalWith(Confidence, { default: () => 0.5 as Confidence }),
    /** Is this track currently active? */
    isActive: Schema.optionalWith(Schema.Boolean, { default: () => true }),
    /** Number of position updates received. */
    updateCount: Schema.optionalWith(Schema.Number, { default: () => 1 }),
    /** Track status. */
    status: Schema.optionalWith(TrackStatus, { default: () => 'active' as const }),
    /** Source type that generated this track. */
    sourceType: Schema.optional(TrackSourceType),
  },
  {
    identifier: 'TrackEntity',
    title: 'Track Entity',
    description: 'Generic tracked object. Includes all core traits plus classification.',
  }
) {
  get displayLabel(): string {
    return this.identifiable.name ?? this.identifiable.callsign ?? this.trackId
  }

  isLive(now: Date = new Date()): boolean {
    const ageMs = now.getTime() - this.lastSeen.getTime()
    return this.status === 'active' && ageMs < 120_000
  }

  markUpdated(at: Date = new Date()): TrackEntity {
    return new TrackEntity({
      ...this,
      lastSeen: at,
      updateCount: this.updateCount + 1,
      status: 'active',
    })
  }

  toSummary(): string {
    return `${this.displayLabel} · ${this.classified.objectType} · ${this.status}`
  }
}
