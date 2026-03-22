/**
 * BindingSourceRegistry — Hotkey Binding Source Management
 *
 * A TokenRegistry-backed registry for binding sources.
 * Prevents invalid source strings like 'builtin' from slipping through.
 *
 * @module
 */

import { TokenRegistry } from "@/lib/primitives/TokenRegistry"
import type { Token } from "@/lib/primitives/TokenRegistry"

// ─────────────────────────────────────────────────────────────────────────────
// Source Metadata
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Metadata for a binding source token.
 */
export interface BindingSourceMetadata {
  /** Priority for conflict resolution (higher = more authoritative) */
  readonly priority: number
  /** Whether bindings from this source can be overwritten */
  readonly overwritable: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Binding source token type — branded string from the registry.
 */
export type BindingSourceToken = Token<"binding-source">

/**
 * BindingSourceRegistry — Effect-native binding source management.
 *
 * Built-in sources:
 * - default: System-provided bindings (lowest priority)
 * - user: User-configured bindings (highest priority)
 * - extension: Extension-provided bindings (medium priority)
 *
 * @example
 * ```ts
 * import { BindingSources } from "@/lib/hotkeys/BindingSourceRegistry"
 *
 * // Use validated source constants
 * const binding = {
 *   keys: [...],
 *   commandId: 'foo',
 *   source: BindingSources.DEFAULT, // ✓ Type-safe
 * }
 *
 * // This would be caught at compile time with proper typing:
 * // source: 'builtin' // ✗ Error: not a valid BindingSourceId
 * ```
 */
export const BindingSourceRegistry = TokenRegistry.create<"binding-source", BindingSourceMetadata>({
  identifier: "tmnl/hotkeys/BindingSourceRegistry",
  namespace: "binding-source",
  name: "Binding Sources",
  allowRuntimeRegistration: false, // Fixed set of sources
  allowOverwrite: false,
  defaultMetadata: { priority: 0, overwritable: true },
  builtins: [
    {
      id: "default",
      name: "Default",
      description: "System-provided bindings (lowest priority)",
      metadata: { priority: 0, overwritable: true },
    },
    {
      id: "user",
      name: "User",
      description: "User-configured bindings (highest priority)",
      metadata: { priority: 100, overwritable: false },
    },
    {
      id: "extension",
      name: "Extension",
      description: "Extension-provided bindings (medium priority)",
      metadata: { priority: 50, overwritable: true },
    },
  ],
})

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Built-in binding source IDs for ergonomic access.
 *
 * These are the raw string IDs — use BindingSourceRegistry.get() to obtain
 * validated BindingSourceToken values when type safety is required.
 */
export const BindingSources = {
  DEFAULT: "default",
  USER: "user",
  EXTENSION: "extension",
} as const

/**
 * Type of built-in binding source IDs.
 */
export type BuiltinBindingSourceId = (typeof BindingSources)[keyof typeof BindingSources]

// ─────────────────────────────────────────────────────────────────────────────
// Type Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a string is a valid binding source at compile time.
 *
 * For runtime validation, use BindingSourceRegistry.get() or BindingSourceRegistry.has().
 */
export const isBuiltinBindingSource = (id: string): id is BuiltinBindingSourceId =>
  Object.values(BindingSources).includes(id as BuiltinBindingSourceId)
