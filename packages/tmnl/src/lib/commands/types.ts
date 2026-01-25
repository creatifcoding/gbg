/**
 * TMNL Commands — Type Definitions
 *
 * Two command classes:
 * 1. Global commands - operate without entity context (save, palette, navigation)
 * 2. Entity commands - require a target entity (delete row, format selection)
 */

import { Effect } from 'effect'

// ─────────────────────────────────────────────────────────────────────────────
// Core Types
// ─────────────────────────────────────────────────────────────────────────────

/** Scope determines when a command is available */
export type CommandScope = 'global' | 'editor' | 'grid' | 'tldraw' | 'modal'

/** Command categories for organization */
export type CommandCategory =
  | 'file'
  | 'edit'
  | 'view'
  | 'navigation'
  | 'selection'
  | 'grid'
  | 'canvas'
  | 'system'
  | 'window'

/** Base command metadata */
export interface CommandMeta {
  readonly id: string
  readonly name: string
  readonly description?: string
  readonly category: CommandCategory
  readonly scope: CommandScope
  readonly icon?: string
  readonly when?: string // Conditional expression (future: monaco-style)
}

/** Keybinding definition */
export interface KeyBinding {
  readonly keys: string // e.g., 'ctrl+s', 'g i'
  readonly commandId: string
  readonly scope: CommandScope
  readonly when?: string
  readonly args?: Record<string, unknown>
}

/** Command execution context */
export interface CommandContext<TEntity = unknown> {
  readonly scope: CommandScope
  readonly entity?: TEntity
  readonly args?: Record<string, unknown>
}

/** Command error types */
export type CommandError =
  | { readonly _tag: 'NotFound'; readonly commandId: string }
  | { readonly _tag: 'InvalidContext'; readonly reason: string }
  | { readonly _tag: 'ExecutionFailed'; readonly cause: unknown }

// ─────────────────────────────────────────────────────────────────────────────
// Command Definitions
// ─────────────────────────────────────────────────────────────────────────────

/** Global command - no entity required */
export interface GlobalCommand extends CommandMeta {
  readonly type: 'global'
  readonly execute: Effect.Effect<void, CommandError>
}

/** Entity command - requires target entity */
export interface EntityCommand<TEntity = unknown> extends CommandMeta {
  readonly type: 'entity'
  readonly entityType: string // e.g., 'grid.row', 'tldraw.shape'
  readonly execute: (entity: TEntity, ctx: CommandContext<TEntity>) => Effect.Effect<void, CommandError>
}

/** Union of all command types */
export type Command = GlobalCommand | EntityCommand

// ─────────────────────────────────────────────────────────────────────────────
// Registry Types
// ─────────────────────────────────────────────────────────────────────────────

/** User keybinding override */
export interface KeyBindingOverride {
  readonly commandId: string
  readonly keys: string | null // null = unbind
  readonly scope?: CommandScope
}

/** Keybindings configuration */
export interface KeyBindingsConfig {
  readonly defaults: readonly KeyBinding[]
  readonly overrides: readonly KeyBindingOverride[]
}

/** Command registry state */
export interface CommandRegistryState {
  readonly commands: ReadonlyMap<string, Command>
  readonly bindings: KeyBindingsConfig
}
