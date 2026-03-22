/**
 * Scene3DBlock ↔ Kori Bridge
 *
 * Bidirectional mapping between Scene3D EntityData and kori traits.
 * Enables Entity data to flow: Stream → kori World → React.
 *
 * @module editor/v3/extensions/blocks/Scene3DBlock/kori-bridge
 */

import { Schema } from 'effect'
import type { TraitId } from '@/lib/kori/schemas/trait'
import type { KoriEntity } from '@/lib/kori/services/world'
import type { TraitData, MaterializeOptions } from '@/lib/connection-ports'
import type { EntityData } from './atoms'

// =============================================================================
// Trait Mapping
// =============================================================================

/**
 * Convert Scene3D EntityData to kori TraitData array.
 * Maps position/velocity/color/scale/type to corresponding traits.
 */
export function entityToTraits(entity: EntityData): TraitData[] {
  return [
    {
      id: 'Position3D' as TraitId,
      data: {
        _tag: 'Position3D',
        x: entity.position[0],
        y: entity.position[1],
        z: entity.position[2],
      },
    },
    {
      id: 'Velocity3D' as TraitId,
      data: {
        _tag: 'Velocity3D',
        vx: entity.velocity[0],
        vy: entity.velocity[1],
        vz: entity.velocity[2],
      },
    },
    {
      id: 'Renderable3D' as TraitId,
      data: {
        _tag: 'Renderable3D',
        type: entity.type,
        color: entity.color,
        scale: entity.scale,
        metalness: 0.7,
        roughness: 0.3,
        emissiveIntensity: 0.2,
      },
    },
    {
      id: 'Name' as TraitId,
      data: {
        _tag: 'Name',
        value: entity.id,
      },
    },
  ]
}

/**
 * Convert kori entity traits back to Scene3D EntityData.
 * Reconstructs EntityData from Position3D, Velocity3D, Renderable3D traits.
 */
export function traitsToEntity(entity: KoriEntity): EntityData | null {
  const position = entity.traits.get('Position3D' as TraitId) as
    | { x: number; y: number; z: number }
    | undefined
  const velocity = entity.traits.get('Velocity3D' as TraitId) as
    | { vx: number; vy: number; vz: number }
    | undefined
  const renderable = entity.traits.get('Renderable3D' as TraitId) as
    | { type: EntityData['type']; color: string; scale: number }
    | undefined

  // Require at least position and renderable
  if (!position || !renderable) {
    return null
  }

  return {
    id: entity.id as string,
    position: [position.x, position.y, position.z],
    velocity: velocity ? [velocity.vx, velocity.vy, velocity.vz] : [0, 0, 0],
    color: renderable.color,
    scale: renderable.scale,
    type: renderable.type,
  }
}

/**
 * Convert array of kori entities to Scene3D EntityData array.
 * Filters out entities that can't be converted (missing required traits).
 */
export function entitiesToEntityData(entities: readonly KoriEntity[]): EntityData[] {
  return entities
    .map(traitsToEntity)
    .filter((e): e is EntityData => e !== null)
}

// =============================================================================
// Stream Materialization Config
// =============================================================================

/**
 * Schema for stream entity payload.
 * Expected format: { entities: EntityData[] }
 */
export const StreamEntityPayload = Schema.Struct({
  entities: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      position: Schema.Tuple(Schema.Number, Schema.Number, Schema.Number),
      velocity: Schema.Tuple(Schema.Number, Schema.Number, Schema.Number),
      color: Schema.String,
      scale: Schema.Number,
      type: Schema.Literal('sphere', 'box', 'torus'),
    })
  ),
})

export type StreamEntityPayload = typeof StreamEntityPayload.Type

/**
 * Create materialization options for Scene3D stream binding.
 * Used with StreamToWorld.materialize() to sync stream → kori World.
 */
export function createScene3DMaterializeOptions(
  streamId: string,
  options?: {
    replay?: boolean
    fromOffset?: string
    clearOnStart?: boolean
  }
): MaterializeOptions<StreamEntityPayload> {
  return {
    streamId,
    schema: StreamEntityPayload,
    toTraits: (payload) => {
      // Flatten: each entity in payload becomes separate entities
      // This mapper is called once per stream message, but we need per-entity mapping
      // For now, return null and handle batch separately
      // TODO: StreamToWorld needs batch support
      return null
    },
    entityIdFrom: (payload) => {
      // For batch payloads, use first entity ID as batch ID
      return payload.entities[0]?.id ?? 'unknown'
    },
    replay: options?.replay ?? false,
    fromOffset: options?.fromOffset,
    clearOnStart: options?.clearOnStart ?? false,
  }
}

// =============================================================================
// Individual Entity Mapper (for per-entity streams)
// =============================================================================

/**
 * Schema for single entity from stream.
 */
export const StreamEntity = Schema.Struct({
  id: Schema.String,
  position: Schema.Tuple(Schema.Number, Schema.Number, Schema.Number),
  velocity: Schema.Tuple(Schema.Number, Schema.Number, Schema.Number),
  color: Schema.String,
  scale: Schema.Number,
  type: Schema.Literal('sphere', 'box', 'torus'),
})

export type StreamEntity = typeof StreamEntity.Type

/**
 * Create materialization options for per-entity stream.
 * Each stream message is a single entity update.
 */
export function createEntityMaterializeOptions(
  streamId: string,
  options?: {
    replay?: boolean
    fromOffset?: string
    clearOnStart?: boolean
  }
): MaterializeOptions<StreamEntity> {
  return {
    streamId,
    schema: StreamEntity,
    toTraits: (entity) => entityToTraits({
      id: entity.id,
      position: entity.position as [number, number, number],
      velocity: entity.velocity as [number, number, number],
      color: entity.color,
      scale: entity.scale,
      type: entity.type,
    }),
    entityIdFrom: (entity) => entity.id,
    replay: options?.replay ?? false,
    fromOffset: options?.fromOffset,
    clearOnStart: options?.clearOnStart ?? false,
  }
}

// =============================================================================
// Utility: Sync kori World to local atoms
// =============================================================================

/**
 * Query kori World for Renderable3D entities and convert to EntityData.
 * Returns Effect that queries World and transforms results.
 */
import { Effect } from 'effect'
import { KoriWorld } from '@/lib/kori/services/world'

export const queryScene3DEntities = Effect.gen(function* () {
  const world = yield* KoriWorld
  const entities = yield* world.queryWith('Renderable3D' as TraitId)
  return entitiesToEntityData(entities)
})
