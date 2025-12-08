/**
 * Layer System v2 — Type Definitions
 *
 * Core types for the wrapper-free layer system.
 */

import type { CSSProperties } from 'react'

// ─────────────────────────────────────────────────────────────
// Core Types
// ─────────────────────────────────────────────────────────────

/**
 * Position modes for layer placement.
 * Each mode has explicit style contracts in useLayerStyle.
 */
export type PositionMode = 'relative' | 'absolute' | 'fixed' | 'sticky'

/**
 * Pointer event behaviors.
 * - auto: Layer captures clicks
 * - none: Layer ignores clicks entirely
 * - pass-through: Container ignores, children capture
 */
export type PointerEventsBehavior = 'auto' | 'none' | 'pass-through'

/**
 * Core layer instance — the source of truth for a registered layer.
 */
export interface LayerInstance {
  readonly id: string
  readonly name: string
  zIndex: number
  visible: boolean
  positionMode: PositionMode
  pointerEvents: PointerEventsBehavior
}

// ─────────────────────────────────────────────────────────────
// Configuration Types
// ─────────────────────────────────────────────────────────────

/**
 * Configuration for registering a new layer.
 * Sensible defaults for all optional fields.
 */
export interface LayerConfig {
  /** Unique name for debugging/identification */
  name: string
  /** Initial z-index value (default: 0) */
  initialZIndex?: number
  /** Initial visibility (default: true) */
  visible?: boolean
  /** CSS position mode (default: 'relative') */
  positionMode?: PositionMode
  /** Pointer event behavior (default: 'auto') */
  pointerEvents?: PointerEventsBehavior
}

// ─────────────────────────────────────────────────────────────
// Hook Return Types
// ─────────────────────────────────────────────────────────────

/**
 * Operations available on a layer.
 * All operations are synchronous from React's perspective
 * (internally they queue Effect operations).
 */
export interface LayerOps {
  /** Move layer to highest z-index + gap */
  bringToFront: () => void
  /** Move layer to lowest z-index - gap */
  sendToBack: () => void
  /** Toggle layer visibility */
  setVisible: (visible: boolean) => void
  /** Change pointer event behavior */
  setPointerEvents: (behavior: PointerEventsBehavior) => void
  /** Set explicit z-index value */
  setZIndex: (zIndex: number) => void
}

/**
 * Return type for useLayer combined hook.
 */
export interface UseLayerReturn {
  /** Layer ID, null until registered */
  id: string | null
  /** Computed style object to apply to root element */
  style: CSSProperties
  /** Layer operations */
  ops: LayerOps
  /** Current layer instance, null if not found */
  layer: LayerInstance | null
}

// ─────────────────────────────────────────────────────────────
// Service Types
// ─────────────────────────────────────────────────────────────

/**
 * LayerRegistry service operations.
 * Handles storage and retrieval of layers.
 */
export interface LayerRegistryOps {
  /** Register a new layer, returns ID */
  register: (config: LayerConfig) => import('effect/Effect').Effect<string>
  /** Unregister a layer by ID */
  unregister: (id: string) => import('effect/Effect').Effect<void>
  /** Get a single layer by ID */
  getLayer: (id: string) => import('effect/Effect').Effect<LayerInstance | null>
  /** Get all layers (unsorted) */
  getAllLayers: () => import('effect/Effect').Effect<LayerInstance[]>
  /** Get all layers sorted by z-index */
  getSorted: () => import('effect/Effect').Effect<LayerInstance[]>
  /** Update a layer's properties */
  updateLayer: (
    id: string,
    update: Partial<Omit<LayerInstance, 'id' | 'name'>>
  ) => import('effect/Effect').Effect<void>
}

/**
 * LayerOperations service operations.
 * Handles z-index algorithms and mutations.
 */
export interface LayerOperationsOps {
  /** Move layer to front (highest z-index + gap) */
  bringToFront: (id: string) => import('effect/Effect').Effect<void>
  /** Move layer to back (lowest z-index - gap) */
  sendToBack: (id: string) => import('effect/Effect').Effect<void>
  /** Set layer visibility */
  setVisible: (id: string, visible: boolean) => import('effect/Effect').Effect<void>
  /** Set pointer event behavior */
  setPointerEvents: (
    id: string,
    behavior: PointerEventsBehavior
  ) => import('effect/Effect').Effect<void>
  /** Set explicit z-index */
  setZIndex: (id: string, zIndex: number) => import('effect/Effect').Effect<void>
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** Gap between z-index values when reordering */
export const Z_INDEX_GAP = 10

/** Default layer configuration values */
export const LAYER_DEFAULTS = {
  initialZIndex: 0,
  visible: true,
  positionMode: 'relative' as PositionMode,
  pointerEvents: 'auto' as PointerEventsBehavior,
} as const
