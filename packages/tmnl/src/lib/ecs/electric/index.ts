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
