/**
 * ECS Electric Integration
 *
 * ElectricSQL shapes for real-time entity sync.
 * Postgres → Electric → HTTP stream → React
 *
 * @module ecs/electric
 */

import { useShape } from '@electric-sql/react'
import { ShapeStream, Shape } from '@electric-sql/client'
import type { EntityType } from '../schemas/core'

// =============================================================================
// Configuration
// =============================================================================

/**
 * Default Electric server URL.
 * Override via environment variable or config.
 */
export const ELECTRIC_URL = import.meta.env['VITE_ELECTRIC_URL'] ?? 'http://localhost:3000'

/**
 * Shape API endpoint.
 */
export const SHAPE_ENDPOINT = `${ELECTRIC_URL}/v1/shape`

// =============================================================================
// Entity Shape Types
// =============================================================================

/**
 * Row shape for entity.entities table.
 * Index signature required by Electric's Row<T> constraint.
 */
export interface EntityRow {
  readonly id: string
  readonly entity_id: string
  readonly entity_type: EntityType
  readonly created_at: string
  readonly updated_at: string
  readonly revision: number
  readonly confidence: number
  readonly is_stale: boolean
  readonly ttl_seconds: number
  readonly provenance: string // JSONB as string
  readonly metadata: string // JSONB as string
  readonly [key: string]: unknown
}

/**
 * Parsed entity with hydrated JSONB fields.
 */
export interface ParsedEntity extends Omit<EntityRow, 'provenance' | 'metadata'> {
  provenance: Record<string, unknown>
  metadata: Record<string, unknown>
}

// =============================================================================
// Shape Utilities
// =============================================================================

/**
 * Parse JSONB fields from row.
 */
export const parseEntityRow = (row: EntityRow): ParsedEntity => ({
  ...row,
  provenance: JSON.parse(row.provenance || '{}'),
  metadata: JSON.parse(row.metadata || '{}'),
})

/**
 * Create entity shape params.
 */
export const entityShapeParams = (options?: {
  entityType?: EntityType
  isStale?: boolean
  columns?: string[]
}) => ({
  table: 'entity.entities',
  where: [
    options?.entityType ? `entity_type = '${options.entityType}'` : null,
    options?.isStale !== undefined ? `is_stale = ${options.isStale}` : null,
  ]
    .filter(Boolean)
    .join(' AND ') || undefined,
  columns: options?.columns,
})

// =============================================================================
// React Hooks
// =============================================================================

/**
 * Subscribe to all entities.
 *
 * @example
 * ```tsx
 * function EntityList() {
 *   const { data, isLoading } = useEntities()
 *   if (isLoading) return <Loading />
 *   return <ul>{data.map(e => <li key={e.id}>{e.entity_id}</li>)}</ul>
 * }
 * ```
 */
export function useEntities(options?: { entityType?: EntityType; isStale?: boolean }) {
  const shape = useShape<EntityRow>({
    url: SHAPE_ENDPOINT,
    params: entityShapeParams(options),
  })

  return {
    ...shape,
    data: shape.data?.map(parseEntityRow) ?? [],
  }
}

/**
 * Subscribe to active (non-stale) entities.
 */
export function useActiveEntities(entityType?: EntityType) {
  return useEntities({ entityType, isStale: false })
}

/**
 * Subscribe to entities by type.
 */
export function useEntitiesByType(entityType: EntityType) {
  return useEntities({ entityType })
}

/**
 * Subscribe to flights.
 */
export function useFlightEntities() {
  return useEntitiesByType('flight')
}

/**
 * Subscribe to POIs.
 */
export function usePoiEntities() {
  return useEntitiesByType('poi')
}

/**
 * Subscribe to tracks.
 */
export function useTrackEntities() {
  return useEntitiesByType('track')
}

/**
 * Subscribe to weather.
 */
export function useWeatherEntities() {
  return useEntitiesByType('weather')
}

/**
 * Subscribe to imagery.
 */
export function useImageryEntities() {
  return useEntitiesByType('imagery')
}

// =============================================================================
// Trait Shape Types
// =============================================================================

/**
 * Row shape for entity.spatial table (position trait).
 */
export interface SpatialTraitRow {
  readonly entity_id: string
  readonly position: string // PostGIS geometry as WKT/EWKT
  readonly updated_at: string
  readonly [key: string]: unknown
}

/**
 * Row shape for entity.kinetic table (movement trait).
 */
export interface KineticTraitRow {
  readonly entity_id: string
  readonly heading: number
  readonly speed: number
  readonly vertical_rate: number
  readonly updated_at: string
  readonly [key: string]: unknown
}

/**
 * Row shape for entity.identifiable table (identification trait).
 */
export interface IdentifiableTraitRow {
  readonly entity_id: string
  readonly external_ids: string // JSONB as string
  readonly callsign: string | null
  readonly updated_at: string
  readonly [key: string]: unknown
}

// =============================================================================
// Trait Hooks
// =============================================================================

/**
 * Subscribe to spatial traits.
 */
export function useSpatialTraits() {
  return useShape<SpatialTraitRow>({
    url: SHAPE_ENDPOINT,
    params: { table: 'entity.spatial' },
  })
}

/**
 * Subscribe to kinetic traits.
 */
export function useKineticTraits() {
  return useShape<KineticTraitRow>({
    url: SHAPE_ENDPOINT,
    params: { table: 'entity.kinetic' },
  })
}

/**
 * Subscribe to identifiable traits.
 */
export function useIdentifiableTraits() {
  return useShape<IdentifiableTraitRow>({
    url: SHAPE_ENDPOINT,
    params: { table: 'entity.identifiable' },
  })
}

// =============================================================================
// Composite Hooks - Entities with Traits
// =============================================================================

/**
 * Parsed position from PostGIS geometry.
 * Format: SRID=4326;POINT Z(lon lat alt)
 */
const parsePosition = (posStr: string): [number, number, number] | null => {
  const match = posStr.match(/POINT\s*Z?\s*\(\s*([0-9.-]+)\s+([0-9.-]+)\s*([0-9.-]*)\s*\)/)
  if (!match) return null
  return [
    parseFloat(match[1] ?? '0'),
    parseFloat(match[2] ?? '0'),
    parseFloat(match[3] ?? '0'),
  ]
}

/**
 * Flight entity with all traits hydrated.
 */
export interface FlightEntityWithTraits {
  entityId: string
  dbId: string
  icao24: string
  callsign: string | null
  position: [number, number, number] // [lon, lat, alt]
  heading: number
  speed: number
  verticalRate: number
  confidence: number
  updatedAt: Date
  metadata: Record<string, unknown>
}

/**
 * Subscribe to flight entities with all traits joined.
 * This is the primary hook for displaying flights on a map.
 */
export function useFlightEntitiesWithTraits(): {
  data: FlightEntityWithTraits[]
  isLoading: boolean
  error: unknown
} {
  const entities = useFlightEntities()
  const spatial = useSpatialTraits()
  const kinetic = useKineticTraits()
  const identifiable = useIdentifiableTraits()

  const isLoading = entities.isLoading || spatial.isLoading || kinetic.isLoading || identifiable.isLoading
  const error = entities.error || spatial.error || kinetic.error || identifiable.error

  // Join entities with traits by entity_id (dbId)
  const data: FlightEntityWithTraits[] = []

  for (const entity of entities.data) {
    const dbId = entity['id'] as string

    // Find matching traits
    const spatialTrait = spatial.data?.find((s) => s['entity_id'] === dbId)
    const kineticTrait = kinetic.data?.find((k) => k['entity_id'] === dbId)
    const identifiableTrait = identifiable.data?.find((i) => i['entity_id'] === dbId)

    // Skip if no spatial data (can't display without position)
    if (!spatialTrait) continue

    const position = parsePosition(spatialTrait['position'] as string)
    if (!position) continue

    // Parse external_ids to get icao24
    let icao24 = ''
    try {
      const externalIds = JSON.parse((identifiableTrait?.['external_ids'] as string) || '{}')
      icao24 = externalIds.icao24 ?? ''
    } catch {
      // Ignore parse errors
    }

    data.push({
      entityId: entity['entity_id'] as string,
      dbId,
      icao24,
      callsign: (identifiableTrait?.['callsign'] as string | null) ?? null,
      position,
      heading: (kineticTrait?.['heading'] as number) ?? 0,
      speed: (kineticTrait?.['speed'] as number) ?? 0,
      verticalRate: (kineticTrait?.['vertical_rate'] as number) ?? 0,
      confidence: entity['confidence'] as number,
      updatedAt: new Date(entity['updated_at'] as string),
      metadata: entity['metadata'] as Record<string, unknown>,
    })
  }

  return { data, isLoading, error }
}

// =============================================================================
// Low-Level Primitives (for Effect services)
// =============================================================================

/**
 * Create a ShapeStream for entities.
 * Use this in Effect services for non-React contexts.
 */
export function createEntityStream(options?: {
  entityType?: EntityType
  isStale?: boolean
}) {
  return new ShapeStream<EntityRow>({
    url: SHAPE_ENDPOINT,
    params: entityShapeParams(options),
  })
}

/**
 * Create a materialized Shape for entities.
 * Maintains an in-memory view of the data.
 */
export function createEntityShape(options?: {
  entityType?: EntityType
  isStale?: boolean
}) {
  const stream = createEntityStream(options)
  return new Shape<EntityRow>(stream)
}
