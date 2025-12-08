/**
 * TMNL Hotkeys — Core Types
 *
 * Effect-native command orchestration with emacs-inspired ergonomics.
 */

import type { Effect } from 'effect'

// ─────────────────────────────────────────────────────────────────────────────
// Key Primitives
// ─────────────────────────────────────────────────────────────────────────────

/** Modifier keys — platform-normalized */
export interface Modifiers {
  readonly ctrl: boolean
  readonly alt: boolean
  readonly shift: boolean
  readonly meta: boolean // Command on Mac, Win on Windows
}

/** A single key press with modifiers */
export interface KeyChord extends Modifiers {
  readonly key: string // Normalized: 'a', 'Enter', 'ArrowUp', 'F1'
}

/** A sequence of key chords (e.g., 'g i' = two chords) */
export type KeySequence = readonly KeyChord[]

/** String representation of a key sequence */
export type KeyString = string // 'ctrl+shift+p', 'g i', 'leader f f'

// ─────────────────────────────────────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────────────────────────────────────

/** Error during command execution */
export class CommandError {
  readonly _tag = 'CommandError'
  constructor(
    readonly commandId: string,
    readonly message: string,
    readonly cause?: unknown
  ) {}
}

/** Context available during command execution */
export interface CommandContext {
  readonly activeScope: string
  readonly activeLayers: readonly string[]
  readonly event: KeyboardEvent
  readonly repeatCount: number // For vim-style '5dd'
  readonly prefix: KeySequence // Keys pressed to trigger this
}

/** Command definition */
export interface Command<R = never> {
  readonly id: string // 'editor.save', 'file.open'
  readonly name: string // 'Save File'
  readonly description?: string
  readonly category?: string // 'File', 'Edit', 'View'
  readonly icon?: string // Lucide icon name or emoji
  readonly handler: Effect.Effect<void, CommandError, R>
  readonly when?: (ctx: CommandContext) => boolean
}

/** Simplified command for registration */
export interface CommandConfig {
  readonly id: string
  readonly name: string
  readonly description?: string
  readonly category?: string
  readonly icon?: string
  readonly when?: (ctx: CommandContext) => boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Bindings
// ─────────────────────────────────────────────────────────────────────────────

/** Source of a binding */
export type BindingSource = 'default' | 'user' | 'extension'

/** Maps a key sequence to a command */
export interface Binding {
  readonly keys: KeySequence
  readonly commandId: string
  readonly scope: string // 'global', 'editor', 'grid', 'tldraw'
  readonly priority: number // Higher wins on conflict
  readonly source: BindingSource
  readonly description?: string // Override command description in which-key
}

/** Binding lookup result */
export interface BindingMatch {
  readonly exact: Binding | null
  readonly partial: readonly Binding[] // Prefix matches for which-key
}

// ─────────────────────────────────────────────────────────────────────────────
// Scopes
// ─────────────────────────────────────────────────────────────────────────────

/** Scope for contextual bindings */
export interface Scope {
  readonly id: string
  readonly name: string
  readonly parent?: string // Inheritance: 'editor' -> 'global'
  readonly layer?: string // Integration with LayerManager
}

/** Built-in scope IDs */
export const Scopes = {
  GLOBAL: 'global',
  EDITOR: 'editor',
  GRID: 'grid',
  TLDRAW: 'tldraw',
  MODAL: 'modal',
  PALETTE: 'palette',
} as const

export type ScopeId = (typeof Scopes)[keyof typeof Scopes] | string

// ─────────────────────────────────────────────────────────────────────────────
// which-key
// ─────────────────────────────────────────────────────────────────────────────

/** which-key popup state */
export interface WhichKeyState {
  readonly visible: boolean
  readonly prefix: KeySequence
  readonly bindings: readonly WhichKeyEntry[]
  readonly position: { x: number; y: number }
}

/** Entry in the which-key popup */
export interface WhichKeyEntry {
  readonly key: string // Next key to press
  readonly label: string // Command name or '+prefix'
  readonly isPrefix: boolean // True if this leads to more keys
  readonly binding?: Binding
}

// ─────────────────────────────────────────────────────────────────────────────
// Command Palette (M-x)
// ─────────────────────────────────────────────────────────────────────────────

/** Command palette state */
export interface CommandPaletteState {
  readonly visible: boolean
  readonly query: string
  readonly results: readonly PaletteEntry[]
  readonly selectedIndex: number
  readonly recentCommands: readonly string[]
}

/** Entry in the command palette */
export interface PaletteEntry {
  readonly command: Command
  readonly binding?: Binding
  readonly score: number // Fuzzy match score
  readonly highlights: readonly [number, number][] // Character ranges to highlight
}

// ─────────────────────────────────────────────────────────────────────────────
// Macro DSL
// ─────────────────────────────────────────────────────────────────────────────

/** Macro program AST node */
export type MacroNode =
  | { type: 'cmd'; commandId: string }
  | { type: 'seq'; children: readonly MacroNode[] }
  | { type: 'par'; children: readonly MacroNode[] }
  | { type: 'repeat'; count: number; body: MacroNode }
  | { type: 'when'; condition: string; body: MacroNode }
  | { type: 'bind'; keys: KeyString; body: MacroNode }

/** Recorded macro */
export interface Macro {
  readonly id: string
  readonly name: string
  readonly program: MacroNode
  readonly createdAt: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/** Hotkey system configuration */
export interface HotkeyConfig {
  /** Timeout before showing which-key popup (ms) */
  readonly whichKeyTimeout: number
  /** Leader key (vim-style) */
  readonly leaderKey: KeyString
  /** Enable/disable hotkeys in input fields */
  readonly enableInInputs: boolean
  /** Custom scope inheritance */
  readonly scopeInheritance: Record<string, string>

  // ─── Native Hotkey Suppression ─────────────────────────────────────────────
  /**
   * Suppress browser/Tauri native hotkeys (Ctrl+S, Ctrl+P, etc.)
   *
   * When true, matched hotkeys will call `event.preventDefault()` to prevent
   * the browser/webview from handling them.
   *
   * Controlled by environment variable: TMNL_SUPPRESS_NATIVE_HOTKEYS
   * - Not present or 'false': Native hotkeys pass through (default)
   * - 'true' or '1': Native hotkeys are suppressed
   *
   * @default false
   */
  readonly suppressNativeHotkeys: boolean

  /**
   * Key sequence to toggle native hotkey passthrough mode.
   * After pressing this sequence, native hotkeys will pass through for
   * `nativePassthroughDuration` milliseconds.
   *
   * Think of it as a "knock" to temporarily let the browser handle keys.
   *
   * @example 'ctrl+alt+n' or 'escape escape'
   * @default 'ctrl+alt+n'
   */
  readonly nativePassthroughKnock: KeyString

  /**
   * Duration (ms) after knock before native suppression re-activates.
   * Set to 0 for "sticky" passthrough (until next knock).
   *
   * @default 5000 (5 seconds)
   */
  readonly nativePassthroughDuration: number

  /**
   * Keys that are ALWAYS passed through to native handlers, regardless of
   * suppression state. Use for critical browser functions.
   *
   * @example ['F12', 'ctrl+shift+i'] - Always allow DevTools
   * @default ['F5', 'ctrl+shift+i', 'ctrl+shift+j', 'F12']
   */
  readonly nativePassthroughAllowlist: readonly KeyString[]
}

/**
 * Read native suppression setting from environment.
 * Returns true if TMNL_SUPPRESS_NATIVE_HOTKEYS is 'true' or '1'.
 */
export const getNativeSuppression = (): boolean => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const val = import.meta.env.TMNL_SUPPRESS_NATIVE_HOTKEYS
    return val === 'true' || val === '1'
  }
  if (typeof process !== 'undefined' && process.env) {
    const val = process.env.TMNL_SUPPRESS_NATIVE_HOTKEYS
    return val === 'true' || val === '1'
  }
  return false
}

export const DEFAULT_CONFIG: HotkeyConfig = {
  whichKeyTimeout: 500,
  leaderKey: 'Space',
  enableInInputs: false,
  scopeInheritance: {
    editor: 'global',
    grid: 'global',
    tldraw: 'global',
    modal: 'global',
    palette: 'modal',
  },
  // Native suppression defaults
  suppressNativeHotkeys: getNativeSuppression(),
  nativePassthroughKnock: 'ctrl+alt+n',
  nativePassthroughDuration: 5000,
  nativePassthroughAllowlist: ['F5', 'ctrl+shift+i', 'ctrl+shift+j', 'F12'],
}
