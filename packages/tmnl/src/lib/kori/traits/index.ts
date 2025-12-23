/**
 * KORI Traits — koota trait() definitions
 *
 * Each trait is created using koota's trait() function.
 * Schema-based traits have default values, tag traits are empty.
 *
 * @pattern koota trait() for ECS components
 * @module
 */

import { trait } from "koota"

// ─────────────────────────────────────────────────────────────────────────────
// Position & Velocity Traits
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 2D Position trait
 */
export const Position2D = trait({ x: 0, y: 0 })

/**
 * 3D Position trait
 */
export const Position3D = trait({ x: 0, y: 0, z: 0 })

/**
 * 2D Velocity trait
 */
export const Velocity2D = trait({ vx: 0, vy: 0 })

/**
 * 3D Velocity trait
 */
export const Velocity3D = trait({ vx: 0, vy: 0, vz: 0 })

// ─────────────────────────────────────────────────────────────────────────────
// Gameplay Traits
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Health trait with current/max values
 */
export const Health = trait({ current: 100, max: 100 })

/**
 * Name trait for entity identification
 */
export const Name = trait({ value: "" })

/**
 * Lifetime trait for temporal entities
 */
export const Lifetime = trait({
  spawnedAt: 0, // timestamp in ms
  ttlMs: 5000,  // time to live
})

// ─────────────────────────────────────────────────────────────────────────────
// Relationship Traits
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ParentOf trait — stores array of child entity IDs
 * Note: koota entities are numbers, so children is number[]
 */
export const ParentOf = trait(() => ({ children: [] as number[] }))

/**
 * ChildOf trait — stores parent entity ID
 */
export const ChildOf = trait({ parentId: 0 })

// ─────────────────────────────────────────────────────────────────────────────
// Tag Traits (Markers — no data)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * IsPlayer — marks entity as player-controlled
 */
export const IsPlayer = trait()

/**
 * IsEnemy — marks entity as enemy
 */
export const IsEnemy = trait()

/**
 * IsActive — marks entity as currently active
 */
export const IsActive = trait()

/**
 * IsDestroyed — marks entity as pending destruction
 */
export const IsDestroyed = trait()

// ─────────────────────────────────────────────────────────────────────────────
// Trait Registry (for dynamic lookup)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All registered traits by string ID
 */
export const TraitRegistry = {
  Position2D,
  Position3D,
  Velocity2D,
  Velocity3D,
  Health,
  Name,
  Lifetime,
  ParentOf,
  ChildOf,
  IsPlayer,
  IsEnemy,
  IsActive,
  IsDestroyed,
} as const

/**
 * Trait ID type (string union of all trait names)
 */
export type TraitId = keyof typeof TraitRegistry

/**
 * Get a trait by its string ID
 */
export function getTrait(id: TraitId) {
  return TraitRegistry[id]
}

/**
 * Check if a string is a valid trait ID
 */
export function isTraitId(id: string): id is TraitId {
  return id in TraitRegistry
}

/**
 * List all trait IDs
 */
export function listTraitIds(): TraitId[] {
  return Object.keys(TraitRegistry) as TraitId[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Type Exports
// ─────────────────────────────────────────────────────────────────────────────

/** Position2D trait data type */
export type Position2DData = { x: number; y: number }

/** Position3D trait data type */
export type Position3DData = { x: number; y: number; z: number }

/** Velocity2D trait data type */
export type Velocity2DData = { vx: number; vy: number }

/** Velocity3D trait data type */
export type Velocity3DData = { vx: number; vy: number; vz: number }

/** Health trait data type */
export type HealthData = { current: number; max: number }

/** Name trait data type */
export type NameData = { value: string }

/** Lifetime trait data type */
export type LifetimeData = { spawnedAt: number; ttlMs: number }

/** ParentOf trait data type */
export type ParentOfData = { children: number[] }

/** ChildOf trait data type */
export type ChildOfData = { parentId: number }
