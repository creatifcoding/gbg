/**
 * ECS Core Schemas - Foundational Types
 *
 * Platform-level primitives for the Canonical Entity System.
 * These types are used across all systems, not just GEOINT.
 *
 * @module ecs/schemas/core
 */

import { Schema } from 'effect'

// =============================================================================
// Branded Identifiers
// =============================================================================

/**
 * Unique identifier for any canonical entity.
 * Format: {type}-{uuid} (e.g., flight-a1b2c3d4-e5f6-7890-abcd-ef1234567890)
 *
 * Generated via EntityIdService, not directly constructed.
 */
export const EntityId = Schema.String.pipe(
  Schema.pattern(/^[a-z]+-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  Schema.brand('EntityId'),
  Schema.annotations({
    identifier: 'EntityId',
    title: 'Entity Identifier',
    description: 'Unique identifier with type prefix. Format: {type}-{uuid}. Examples: flight-a1b2c3d4-..., poi-12345678-...',
  })
)
export type EntityId = typeof EntityId.Type

/**
 * Intelligence source identifier.
 * Represents the origin of data (e.g., 'opensky', 'overpass', 'manual').
 */
export const IntelSource = Schema.Literal(
  // Flight data sources
  'opensky',
  'adsb-lol',
  'flightradar24',
  // Geospatial sources
  'overpass',
  'osm',
  'nominatim',
  // Satellite imagery
  'planet',
  'sentinel',
  'maxar',
  // Weather
  'openmeteo',
  'noaa',
  // Internal sources
  'manual',
  'derived',
  'fused',
  // Generic
  'unknown'
).pipe(
  Schema.annotations({
    identifier: 'IntelSource',
    title: 'Intelligence Source',
    description: 'Origin of data. Categories: flight (opensky, adsb-lol, flightradar24), geospatial (overpass, osm, nominatim), imagery (planet, sentinel, maxar), weather (openmeteo, noaa), internal (manual, derived, fused).',
  })
)
export type IntelSource = typeof IntelSource.Type

/**
 * Entity type discriminator.
 * Used for single-table inheritance and routing.
 */
export const EntityType = Schema.Literal(
  'flight',
  'poi',
  'track',
  'weather',
  'imagery',
  'feature',
  'vessel',
  'vehicle'
).pipe(
  Schema.annotations({
    identifier: 'EntityType',
    title: 'Entity Type',
    description: 'Discriminator for entity polymorphism. Used for routing, storage, and type narrowing.',
  })
)
export type EntityType = typeof EntityType.Type

// =============================================================================
// Geometric Primitives (reusable across platform)
// =============================================================================

/**
 * [longitude, latitude] coordinate pair.
 * WGS84 (EPSG:4326).
 */
export const Position2D = Schema.Tuple(
  Schema.Number.pipe(Schema.between(-180, 180)),
  Schema.Number.pipe(Schema.between(-90, 90))
).pipe(
  Schema.annotations({
    identifier: 'Position2D',
    title: '2D Position',
    description: '[longitude, latitude] coordinate pair in WGS84 (EPSG:4326).',
  })
)
export type Position2D = typeof Position2D.Type

/**
 * [longitude, latitude, altitude] coordinate triple.
 * Altitude in meters above WGS84 ellipsoid.
 */
export const Position3D = Schema.Tuple(
  Schema.Number.pipe(Schema.between(-180, 180)),
  Schema.Number.pipe(Schema.between(-90, 90)),
  Schema.Number
).pipe(
  Schema.annotations({
    identifier: 'Position3D',
    title: '3D Position',
    description: '[longitude, latitude, altitude] coordinate triple. Altitude in meters above WGS84 ellipsoid.',
  })
)
export type Position3D = typeof Position3D.Type

/**
 * [minLon, minLat, maxLon, maxLat] bounding box.
 */
export const BBox = Schema.Tuple(
  Schema.Number.pipe(Schema.between(-180, 180)),
  Schema.Number.pipe(Schema.between(-90, 90)),
  Schema.Number.pipe(Schema.between(-180, 180)),
  Schema.Number.pipe(Schema.between(-90, 90))
).pipe(
  Schema.annotations({
    identifier: 'BBox',
    title: 'Bounding Box',
    description: '[minLon, minLat, maxLon, maxLat] geographic bounding box in WGS84.',
  })
)
export type BBox = typeof BBox.Type

// =============================================================================
// Classification (IFF)
// =============================================================================

/**
 * Friend/Foe Identification classification.
 */
export const Classification = Schema.Literal(
  'friendly',
  'hostile',
  'neutral',
  'unknown',
  'pending'
).pipe(
  Schema.annotations({
    identifier: 'Classification',
    title: 'IFF Classification',
    description: 'Friend/Foe Identification. Used for tactical assessment and display symbology.',
  })
)
export type Classification = typeof Classification.Type

/**
 * Object type taxonomy.
 */
export const ObjectType = Schema.Literal(
  'aircraft',
  'vessel',
  'vehicle',
  'person',
  'structure',
  'natural',
  'unknown'
).pipe(
  Schema.annotations({
    identifier: 'ObjectType',
    title: 'Object Type',
    description: 'Physical object category. Used for symbology and behavior inference.',
  })
)
export type ObjectType = typeof ObjectType.Type

// =============================================================================
// Confidence & Quality
// =============================================================================

/**
 * Confidence score (0.0 - 1.0).
 * 0 = no confidence, 1 = absolute confidence.
 */
export const Confidence = Schema.Number.pipe(
  Schema.between(0, 1),
  Schema.brand('Confidence'),
  Schema.annotations({
    identifier: 'Confidence',
    title: 'Confidence Score',
    description: 'Normalized confidence value 0.0-1.0. Used for fusion weighting and display.',
  })
)
export type Confidence = typeof Confidence.Type

/**
 * Data quality assessment.
 */
export const DataQuality = Schema.Literal(
  'verified',    // Human-verified
  'high',        // High-confidence automated
  'medium',      // Standard automated
  'low',         // Low-confidence or stale
  'unverified'   // Not yet assessed
).pipe(
  Schema.annotations({
    identifier: 'DataQuality',
    title: 'Data Quality',
    description: 'Assessment of data reliability. Affects fusion priority and display treatment.',
  })
)
export type DataQuality = typeof DataQuality.Type
