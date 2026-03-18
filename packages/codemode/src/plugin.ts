/**
 * @module plugin
 *
 * CodemodePlugin — the contract between @tmnl/codemode core and domain plugins.
 *
 * A plugin registers methods onto the sandbox API object and optionally
 * contributes a manifest section to the tool guide.
 *
 * @example
 * ```ts
 * const myPlugin: CodemodePlugin = {
 *   id: 'geoint',
 *   name: 'GEOINT Operations',
 *   methods: {
 *     analyzeImage: (path) => { ... },
 *     geocode: (query) => { ... },
 *   },
 *   manifest: {
 *     id: 'geoint-ops',
 *     slot: 'api',
 *     priority: 25,
 *     provider: () => '### GEOINT\n  ms.analyzeImage(path) → Analysis',
 *   },
 * }
 * ```
 */

import type { SectionConfig } from "./manifest.js"
import type { CodemodeCore } from "./types.js"

// ── Plugin Interface ─────────────────────────────────────────────

export interface CodemodePlugin {
  /** Unique plugin identifier */
  readonly id: string

  /** Human-readable name */
  readonly name: string

  /**
   * Methods to merge onto the sandbox API object.
   * Keys become `ms.methodName()` in the eval sandbox.
   * Flat namespace — collisions are last-wins with a warning.
   */
  readonly methods: Record<string, Function>

  /**
   * Optional manifest section for the compiled tool guide.
   * Registered into ToolManifest during plugin loading.
   */
  readonly manifest?: SectionConfig

  /**
   * Optional setup hook — called when plugin is loaded.
   * Receives the core API for accessing store, procedures, etc.
   */
  readonly setup?: (core: CodemodeCore) => void | Promise<void>

  /**
   * Optional teardown — called on dispose.
   */
  readonly dispose?: () => void | Promise<void>
}

// ── Plugin Loader ────────────────────────────────────────────────

export interface PluginLoadResult {
  readonly loaded: string[]
  readonly collisions: Array<{ method: string; winner: string; loser: string }>
}

/**
 * Merge plugin methods into a flat API object.
 * Later plugins win on collision (with warning tracking).
 */
export function mergePlugins(
  plugins: ReadonlyArray<CodemodePlugin>,
): { methods: Record<string, Function>; result: PluginLoadResult } {
  const methods: Record<string, Function> = {}
  const owners = new Map<string, string>()
  const collisions: PluginLoadResult['collisions'] = []
  const loaded: string[] = []

  for (const plugin of plugins) {
    for (const [name, fn] of Object.entries(plugin.methods)) {
      const existing = owners.get(name)
      if (existing) {
        collisions.push({ method: name, winner: plugin.id, loser: existing })
      }
      methods[name] = fn
      owners.set(name, plugin.id)
    }
    loaded.push(plugin.id)
  }

  return { methods, result: { loaded, collisions } }
}
