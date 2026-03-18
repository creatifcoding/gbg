/**
 * @module types
 *
 * Core type definitions for @tmnl/codemode.
 */

import type { StoreApi } from "./store/api.js"
import type { ProcedureApi } from "./store/procedures.js"
import type { OverlayManager } from "./overlay.js"

// ── CodemodeCore ─────────────────────────────────────────────────

/**
 * The core infrastructure that plugins receive during setup.
 * Everything domain-agnostic lives here.
 */
export interface CodemodeCore {
  /** RLM persistent store */
  readonly store: StoreApi

  /** DPA stored procedures */
  readonly procedures: ProcedureApi

  /** Working directory */
  readonly cwd: string

  /** Read a file (cwd-relative or absolute). Async — must await. */
  readonly read: (path: string) => Promise<string>

  /** Write a file (cwd-relative or absolute, auto-creates parent dirs). Async — must await. */
  readonly write: (path: string, content: string) => Promise<void>

  /** Execute a shell command (cwd-scoped, 15s timeout). Async — must await. */
  readonly sh: (cmd: string) => Promise<string>
}

// ── CodemodeConfig ───────────────────────────────────────────────

export interface CodemodeConfig {
  /** Working directory for file/shell ops */
  readonly cwd: string

  /** Database file path (for SQLite adapters) */
  readonly dbPath?: string
}

// ── CodemodeInstance ──────────────────────────────────────────────

/**
 * The assembled codemode instance returned by createCodemode().
 */
export interface CodemodeInstance {
  /** The merged API object — core + all overlay methods (mutated in-place on recompile) */
  readonly api: Record<string, Function>

  /** Always-fresh API snapshot — reads from overlayManager.compiled() on every call */
  getApi(): Record<string, Function>

  /** Evaluate code in the sandbox against the merged API */
  readonly eval: (code: string) => Promise<any>

  /** The underlying core — for programmatic access */
  readonly core: CodemodeCore

  /** Loaded overlay IDs (backward compat — same as overlays.active().map(o => o.id)) */
  readonly plugins: ReadonlyArray<string>

  /** Overlay manager — load, unload, switch overlays dynamically */
  readonly overlays: OverlayManager

  /** Dispose all resources */
  readonly dispose: () => Promise<void>
}
