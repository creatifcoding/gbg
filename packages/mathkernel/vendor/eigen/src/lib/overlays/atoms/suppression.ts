/**
 * Suppression Atoms
 *
 * Manages overlay suppression state for programmatic show/hide control.
 * Supports both type-level and instance-level suppression.
 *
 * Usage:
 * - Type-level: useSuppressOverlay("modal") suppresses ALL modals
 * - Instance-level: useSuppressOverlay("modal:settings") suppresses specific instance
 *
 * @module
 */

import { Atom } from "@effect-atom/atom-react"
import {
  type SuppressionKey,
  type VisualOverlayId,
  type VisualOverlayType,
  typeSuppressionKey,
  instanceSuppressionKey,
  parseSuppressionKey,
} from "../schemas/visual"

// ─────────────────────────────────────────────────────────────
// Core State Atom
// ─────────────────────────────────────────────────────────────

/**
 * Set of active suppression keys.
 * Format: "type" (e.g., "modal") or "type:instance" (e.g., "modal:settings")
 *
 * NOTE: Uses keepAlive to persist across registry instances.
 */
export const suppressionsAtom = Atom.keepAlive(
  Atom.make<Set<SuppressionKey>>(new Set())
)

// ─────────────────────────────────────────────────────────────
// Derived Atoms
// ─────────────────────────────────────────────────────────────

/**
 * Check if an overlay should be suppressed.
 * Returns true if EITHER type-level OR instance-level suppression is active.
 *
 * @example
 * // Checks both "modal" and "modal:settings"
 * get(isSuppressedAtom({ type: "modal", id: "settings" }))
 */
export const isSuppressedAtom = Atom.family(
  ({ type, id }: { type: VisualOverlayType; id: VisualOverlayId }) =>
    Atom.make((get) => {
      const suppressions = get(suppressionsAtom)
      const tKey = typeSuppressionKey(type)
      const iKey = instanceSuppressionKey(type, id as string)
      return suppressions.has(tKey) || suppressions.has(iKey)
    })
)

/**
 * Check if ALL overlays of a type are suppressed.
 *
 * @example
 * get(isTypeSuppressedAtom("modal")) // true if "modal" key is in suppressions
 */
export const isTypeSuppressedAtom = Atom.family((type: VisualOverlayType) =>
  Atom.make((get) => {
    const suppressions = get(suppressionsAtom)
    return suppressions.has(typeSuppressionKey(type))
  })
)

/**
 * Get all active suppression keys.
 */
export const activeSuppressionKeysAtom = Atom.make((get) => {
  const suppressions = get(suppressionsAtom)
  return Array.from(suppressions)
})

/**
 * Get suppression count.
 */
export const suppressionCountAtom = Atom.make((get) => {
  const suppressions = get(suppressionsAtom)
  return suppressions.size
})

// ─────────────────────────────────────────────────────────────
// Mutation Functions (pure, return new state)
// ─────────────────────────────────────────────────────────────

/**
 * Add a suppression key.
 * Idempotent - adding an existing key returns same state.
 */
export const addSuppression = (
  suppressions: Set<SuppressionKey>,
  key: SuppressionKey,
): Set<SuppressionKey> => {
  if (suppressions.has(key)) return suppressions
  const next = new Set(suppressions)
  next.add(key)
  return next
}

/**
 * Remove a suppression key.
 * Idempotent - removing a non-existent key returns same state.
 */
export const removeSuppression = (
  suppressions: Set<SuppressionKey>,
  key: SuppressionKey,
): Set<SuppressionKey> => {
  if (!suppressions.has(key)) return suppressions
  const next = new Set(suppressions)
  next.delete(key)
  return next
}

/**
 * Toggle a suppression key.
 */
export const toggleSuppression = (
  suppressions: Set<SuppressionKey>,
  key: SuppressionKey,
): Set<SuppressionKey> => {
  if (suppressions.has(key)) {
    return removeSuppression(suppressions, key)
  }
  return addSuppression(suppressions, key)
}

/**
 * Clear all suppressions.
 */
export const clearAllSuppressions = (
  _suppressions: Set<SuppressionKey>,
): Set<SuppressionKey> => {
  return new Set()
}

/**
 * Clear all suppressions for a specific type.
 * Removes both type-level and all instance-level suppressions.
 */
export const clearTypeSuppressions = (
  suppressions: Set<SuppressionKey>,
  type: VisualOverlayType,
): Set<SuppressionKey> => {
  const next = new Set<SuppressionKey>()
  for (const key of suppressions) {
    const parsed = parseSuppressionKey(key)
    if (parsed.type !== type) {
      next.add(key)
    }
  }
  return next
}

// ─────────────────────────────────────────────────────────────
// Re-export helpers for convenience
// ─────────────────────────────────────────────────────────────

export { typeSuppressionKey, instanceSuppressionKey, parseSuppressionKey }
