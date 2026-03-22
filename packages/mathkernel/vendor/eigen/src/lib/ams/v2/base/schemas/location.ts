/**
 * AMS v2 Location Schemas
 *
 * Spatial hierarchy: Site → Sector → Container → Carrier
 *
 * @module @gbg/tmnl/ams/v2/base/schemas/location
 */

import { Schema } from 'effect'
import {
  SiteId,
  SectorId,
  ContainerId,
  CarrierId,
  SectorTypeId,
  ContainerTypeId,
} from '../../core/schemas/identifiers'
import { BfoSite, BfoSpatialRegion, BfoObject } from '../../core/schemas/bfo'
import { CreatedAt, UpdatedAt } from '../../core/schemas/timestamps'

// ─────────────────────────────────────────────────────────────────────────────
// Geo Primitives
// ─────────────────────────────────────────────────────────────────────────────

export class GeoPoint extends Schema.TaggedClass<GeoPoint>()('GeoPoint', {
  lat: Schema.Number.pipe(Schema.greaterThanOrEqualTo(-90), Schema.lessThanOrEqualTo(90)),
  lon: Schema.Number.pipe(Schema.greaterThanOrEqualTo(-180), Schema.lessThanOrEqualTo(180)),
  elevationM: Schema.optional(Schema.Number),
}) {}
export type GeoPointType = typeof GeoPoint.Type

export class GeoPolygon extends Schema.TaggedClass<GeoPolygon>()('GeoPolygon', {
  vertices: Schema.Array(GeoPoint).pipe(Schema.minItems(3)),
}) {
  /**
   * Check if polygon has minimum vertices for a valid closed shape
   */
  isValid(): boolean {
    return this.vertices.length >= 3
  }
}
export type GeoPolygonType = typeof GeoPolygon.Type

export class LocationUncertainty extends Schema.TaggedClass<LocationUncertainty>()('LocationUncertainty', {
  radiusM: Schema.optional(Schema.Number.pipe(Schema.positive())),
  altHypotheses: Schema.optional(
    Schema.Array(
      Schema.Struct({
        point: GeoPoint,
        probability: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(1)),
      })
    )
  ),
}) {}
export type LocationUncertaintyType = typeof LocationUncertainty.Type

// ─────────────────────────────────────────────────────────────────────────────
// Site
// ─────────────────────────────────────────────────────────────────────────────

export class GeoFrame extends Schema.TaggedClass<GeoFrame>()('GeoFrame', {
  crs: Schema.String, // Coordinate reference system (e.g., "EPSG:4326")
  origin: GeoPoint,
}) {}
export type GeoFrameType = typeof GeoFrame.Type

export class Site extends Schema.TaggedClass<Site>()('Site', {
  id: SiteId,
  bfoClass: BfoSite,
  name: Schema.String.pipe(Schema.minLength(1)),
  geoFrame: GeoFrame,
  createdAt: CreatedAt,
  updatedAt: UpdatedAt,
}) {}
export type SiteType = typeof Site.Type

// ─────────────────────────────────────────────────────────────────────────────
// Sector
// ─────────────────────────────────────────────────────────────────────────────

export class Sector extends Schema.TaggedClass<Sector>()('Sector', {
  id: SectorId,
  bfoClass: BfoSpatialRegion,
  siteId: SiteId,
  sectorTypeId: SectorTypeId,
  name: Schema.String.pipe(Schema.minLength(1)),
  footprint: GeoPolygon,
  uncertainty: Schema.optional(LocationUncertainty),
  createdAt: CreatedAt,
  updatedAt: UpdatedAt,
}) {}
export type SectorType = typeof Sector.Type

// ─────────────────────────────────────────────────────────────────────────────
// Container
// ─────────────────────────────────────────────────────────────────────────────

export class Container extends Schema.TaggedClass<Container>()('Container', {
  id: ContainerId,
  bfoClass: BfoObject,
  siteId: SiteId,
  sectorId: SectorId,
  containerTypeId: ContainerTypeId,
  label: Schema.String.pipe(Schema.minLength(1)),
  carrierId: Schema.optional(CarrierId), // Set if this is a mobile container
  createdAt: CreatedAt,
  updatedAt: UpdatedAt,
}) {
  /**
   * Check if this container is mobile (attached to a carrier)
   */
  isMobile(): boolean {
    return this.carrierId !== undefined
  }
}
export type ContainerType = typeof Container.Type

// ─────────────────────────────────────────────────────────────────────────────
// Carrier (mobile container: truck, drone, AGV)
// ─────────────────────────────────────────────────────────────────────────────

export const CarrierStatus = Schema.Literal(
  'idle',
  'in_transit',
  'loading',
  'unloading',
  'maintenance'
).pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Carrier/fields/CarrierStatus'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/CarrierStatus',
    description: 'Current status of a carrier',
  })
)
export type CarrierStatus = typeof CarrierStatus.Type

export class Carrier extends Schema.TaggedClass<Carrier>()('Carrier', {
  id: CarrierId,
  bfoClass: BfoObject,
  siteId: SiteId,
  label: Schema.String.pipe(Schema.minLength(1)),
  status: CarrierStatus,
  currentPosition: Schema.optional(GeoPoint),
  createdAt: CreatedAt,
  updatedAt: UpdatedAt,
}) {}
export type CarrierType = typeof Carrier.Type

// ─────────────────────────────────────────────────────────────────────────────
// Asset Location Reference
// ─────────────────────────────────────────────────────────────────────────────

export class AssetLocation extends Schema.TaggedClass<AssetLocation>()('AssetLocation', {
  siteId: SiteId,
  sectorId: Schema.optional(SectorId),
  containerId: Schema.optional(ContainerId),
}) {}
export type AssetLocationType = typeof AssetLocation.Type
