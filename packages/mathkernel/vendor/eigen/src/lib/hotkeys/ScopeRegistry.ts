/**
 * ScopeRegistry — Hotkey Scope Management
 *
 * A TokenRegistry-backed registry for hotkey scopes.
 * Enables runtime registration of custom scopes (Emacs minor-mode pattern).
 *
 * @module
 */

import { TokenRegistry } from "@/lib/primitives/TokenRegistry"
import type { Token } from "@/lib/primitives/TokenRegistry"

// ─────────────────────────────────────────────────────────────────────────────
// Scope Metadata
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Metadata for a scope token.
 */
export interface ScopeMetadata {
  /** Parent scope for inheritance (e.g., "editor" inherits from "global") */
  readonly parent?: string
  /** Associated layer ID (optional) */
  readonly layer?: string
  /** Priority for conflict resolution (higher wins) */
  readonly priority?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scope token type — branded string from the registry.
 */
export type ScopeToken = Token<"scope">

/**
 * ScopeRegistry — Effect-native scope management.
 *
 * Built-in scopes:
 * - global: Root scope, always active
 * - editor: Code editing context
 * - grid: Data grid context
 * - tldraw: Canvas context
 * - modal: Modal/dialog context
 * - palette: Command palette context
 * - minibuffer: Emacs-style minibuffer
 *
 * @example
 * ```ts
 * import { ScopeRegistry } from "@/lib/hotkeys/ScopeRegistry"
 *
 * // Use in Effect
 * const program = Effect.gen(function* () {
 *   const registry = yield* ScopeRegistry.Tag
 *
 *   // Get validated scope token
 *   const globalScope = yield* registry.get("global")
 *
 *   // Register custom scope
 *   const customScope = yield* registry.register({
 *     id: "my-mode",
 *     name: "My Custom Mode",
 *     metadata: { parent: "global", priority: 50 }
 *   })
 * }).pipe(Effect.provide(ScopeRegistry.Live))
 * ```
 */
export const ScopeRegistry = TokenRegistry.create<"scope", ScopeMetadata>({
  identifier: "tmnl/hotkeys/ScopeRegistry",
  namespace: "scope",
  name: "Hotkey Scopes",
  allowRuntimeRegistration: true,
  allowOverwrite: false,
  defaultMetadata: { priority: 0 },
  builtins: [
    {
      id: "global",
      name: "Global",
      description: "Root scope, always active",
      metadata: { priority: 0 },
    },
    {
      id: "editor",
      name: "Editor",
      description: "Code editing context",
      metadata: { parent: "global", priority: 10 },
    },
    {
      id: "grid",
      name: "Grid",
      description: "Data grid context",
      metadata: { parent: "global", priority: 10 },
    },
    {
      id: "tldraw",
      name: "Canvas",
      description: "tldraw canvas context",
      metadata: { parent: "global", priority: 10 },
    },
    {
      id: "modal",
      name: "Modal",
      description: "Modal/dialog context",
      metadata: { parent: "global", priority: 20 },
    },
    {
      id: "palette",
      name: "Palette",
      description: "Command palette context",
      metadata: { parent: "modal", priority: 30 },
    },
    {
      id: "minibuffer",
      name: "Minibuffer",
      description: "Emacs-style minibuffer context",
      metadata: { parent: "global", priority: 25 },
    },
    {
      id: "terminal",
      name: "Terminal",
      description: "Terminal/PTY context",
      metadata: { parent: "global", priority: 15 },
    },
    {
      id: "geoint",
      name: "GEOINT",
      description: "Geointelligence dashboard context",
      metadata: { parent: "global", priority: 15 },
    },
  ],
})

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Built-in scope IDs for ergonomic access.
 *
 * These are the raw string IDs — use ScopeRegistry.get() to obtain
 * validated ScopeToken values when type safety is required.
 */
export const Scopes = {
  GLOBAL: "global",
  EDITOR: "editor",
  GRID: "grid",
  TLDRAW: "tldraw",
  MODAL: "modal",
  PALETTE: "palette",
  MINIBUFFER: "minibuffer",
  TERMINAL: "terminal",
  GEOINT: "geoint",
} as const

/**
 * Type of built-in scope IDs.
 */
export type BuiltinScopeId = (typeof Scopes)[keyof typeof Scopes]

// ─────────────────────────────────────────────────────────────────────────────
// Type Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a string is a valid scope at compile time.
 *
 * For runtime validation, use ScopeRegistry.get() or ScopeRegistry.has().
 */
export const isBuiltinScope = (id: string): id is BuiltinScopeId =>
  Object.values(Scopes).includes(id as BuiltinScopeId)
