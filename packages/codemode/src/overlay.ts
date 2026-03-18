/**
 * @module overlay
 *
 * CodemodeOverlay — the composable surface contract.
 *
 * An overlay reshapes the entire codemode tool surface:
 * methods, guide sections, prompt steering, RLM profiles,
 * seed procedures, context, rendering, errors, lifecycle.
 *
 * Overlays are stackable (Nix-style composition) and dynamically
 * switchable mid-session. The OverlayManager maintains the stack,
 * recompiles merged state on every mutation.
 *
 * Replaces the earlier CodemodePlugin interface.
 *
 * @example
 * ```ts
 * const metaskill: CodemodeOverlay = {
 *   id: "metaskill",
 *   name: "Skill Governance",
 *   methods: { discover: () => ..., inspect: (n) => ... },
 *   guide: { sections: [{ id: "metaskill-ops", slot: "api", priority: 20, content: "..." }] },
 *   steer: { fragments: [{ id: "val-persona", content: "You are Val..." }] },
 *   lifecycle: { onLoad: (core) => { ... } },
 * }
 * ```
 */

import type { SectionConfig } from "./manifest.js"
import type { CodemodeCore } from "./types.js"

// ── CodemodeOverlay Interface ────────────────────────────────────

export interface CodemodeOverlay {
  /** Unique overlay identifier */
  readonly id: string

  /** Human-readable name */
  readonly name: string

  /** Semver version (for provenance tracking) */
  readonly version?: string

  /**
   * Methods merged onto ms.* in the eval sandbox.
   * Keys become `ms.methodName()`. Later overlays win on collision.
   */
  readonly methods: Record<string, Function>

  /**
   * Tool guide contributions.
   * Sections are compiled into the ToolManifest by slot + priority.
   * Priority overrides let an overlay reorder existing sections.
   */
  readonly guide?: {
    /** Sections added to ToolManifest */
    readonly sections: ReadonlyArray<SectionConfig>
    /** Priority overrides for existing sections (sectionId → new priority) */
    readonly priorities?: Readonly<Record<string, number>>
  }

  /**
   * Prompt steering — fragments injected per-turn.
   * All active fragments concatenated, sorted by priority.
   */
  readonly steer?: {
    /** System prompt fragments */
    readonly fragments: ReadonlyArray<SteerFragment>
    /** Context-aware suppression (e.g. suppress at >80% context) */
    readonly suppress?: {
      readonly threshold: number
      readonly fragmentIds: ReadonlyArray<string>
    }
  }

  /**
   * RLM profiles auto-loaded when overlay activates.
   * Profiles are imported via the store's importStore/profile system.
   */
  readonly profiles?: {
    /** Profile names to auto-import */
    readonly autoLoad: ReadonlyArray<string>
    /** Bundled profile data (inline JSON, not file paths) */
    readonly bundles?: Readonly<Record<string, any>>
  }

  /**
   * Seed procedures registered on overlay activation.
   * Registered into DPA via core.procedures.define().
   */
  readonly procedures?: ReadonlyArray<SeedProcedure>

  /**
   * Context builder — additional fields merged into ms.context.
   * Fields are lazy (functions) — evaluated when ms.context is accessed.
   */
  readonly context?: {
    /** Additional fields merged into ms.context */
    readonly fields: Readonly<Record<string, () => any>>
    /** Replace default context entirely (rare — only one overlay can do this) */
    readonly replace?: boolean
  }

  /**
   * TUI rendering customization.
   * Custom renderers for TUI primitives, layout overrides, grid columns.
   */
  readonly rendering?: {
    /** Custom TUI primitive renderers (tag → render function) */
    readonly renderers?: Readonly<Record<string, Function>>
    /** Layout overrides */
    readonly layout?: Readonly<Record<string, any>>
    /** Grid column definitions */
    readonly grid?: Readonly<Record<string, any>>
  }

  /**
   * Error presentation — map domain error tags to user-friendly messages.
   * Later overlays win on tag collision.
   */
  readonly errors?: {
    readonly formatters: Readonly<Record<string, (error: any) => string>>
  }

  /**
   * Lifecycle hooks — called at overlay lifecycle boundaries.
   * All hooks in a stack are called (load: bottom-up, unload: top-down).
   */
  readonly lifecycle?: {
    /** Called when overlay is loaded — receives core for setup */
    readonly onLoad?: (core: CodemodeCore) => void | Promise<void>
    /** Called when overlay is unloaded */
    readonly onUnload?: () => void | Promise<void>
    /** Transform code before eval (preprocessing) */
    readonly onEval?: (code: string) => string
    /** Transform result after eval (postprocessing) */
    readonly onResult?: (result: any) => any
    /** Called each tool invocation (per-turn hook) */
    readonly onTurn?: () => void | Promise<void>
  }

  /**
   * Dispose — cleanup resources owned by this overlay.
   * Called automatically during unload.
   */
  readonly dispose?: () => void | Promise<void>
}

// ── Supporting Types ─────────────────────────────────────────────

export interface SteerFragment {
  /** Unique fragment identifier */
  readonly id: string
  /** Content — static string or lazy provider */
  readonly content: string | (() => string)
  /** Sort priority (lower = earlier). Default: 50 */
  readonly priority?: number
}

export interface SeedProcedure {
  /** Procedure name (auto-kebab'd at store boundary) */
  readonly name: string
  /** The procedure function — receives (ms, args?) */
  readonly fn: Function
  /** Tool guide manifest entry */
  readonly manifest: string
  /** Optional tags for categorization */
  readonly tags?: ReadonlyArray<string>
}

// ── Compiled State ───────────────────────────────────────────────

/**
 * The merged/compiled state from all active overlays.
 * Rebuilt on every stack mutation. Consumers read from this snapshot.
 */
export interface CompiledOverlayState {
  /** Merged methods from all overlays (later wins) */
  readonly methods: Record<string, Function>
  /** Compiled guide sections (for ToolManifest registration) */
  readonly guideSections: ReadonlyArray<SectionConfig>
  /** Priority overrides (merged from all overlays) */
  readonly guidePriorities: Readonly<Record<string, number>>
  /** Active steer fragments (sorted by priority) */
  readonly steerFragments: ReadonlyArray<SteerFragment & { overlayId: string }>
  /** Steer suppression rules */
  readonly steerSuppress: ReadonlyArray<{ threshold: number; fragmentIds: ReadonlyArray<string>; overlayId: string }>
  /** Profiles to auto-load */
  readonly profiles: ReadonlyArray<string>
  /** Profile bundles (merged) */
  readonly profileBundles: Readonly<Record<string, any>>
  /** Seed procedures to register */
  readonly procedures: ReadonlyArray<SeedProcedure & { overlayId: string }>
  /** Context field providers (merged, later wins) */
  readonly contextFields: Readonly<Record<string, () => any>>
  /** Whether context replaces default (last overlay with replace:true wins) */
  readonly contextReplace: boolean
  /** Rendering overrides (merged, later wins) */
  readonly renderers: Readonly<Record<string, Function>>
  readonly layout: Readonly<Record<string, any>>
  readonly grid: Readonly<Record<string, any>>
  /** Error formatters (merged, later wins on tag collision) */
  readonly errorFormatters: Readonly<Record<string, (error: any) => string>>
  /** Loaded overlay IDs in stack order */
  readonly stack: ReadonlyArray<string>
}

// ── OverlayManager ───────────────────────────────────────────────

export interface OverlayManagerOptions {
  /** Callback fired after every recompile — consumer can re-wire */
  readonly onRecompile?: (state: CompiledOverlayState) => void | Promise<void>
}

/**
 * Manages the overlay stack.
 *
 * Every mutation (load, unload, clear) recompiles the merged state
 * and fires the onRecompile callback so the host can re-wire
 * methods, guide, steer, etc.
 */
export class OverlayManager {
  private stack: CodemodeOverlay[] = []
  private _compiled: CompiledOverlayState = emptyCompiled()
  private core: CodemodeCore | null = null
  private readonly onRecompile: ((state: CompiledOverlayState) => void | Promise<void>) | undefined

  constructor(options?: OverlayManagerOptions) {
    this.onRecompile = options?.onRecompile
  }

  /** Bind the core reference — called once during codemode init */
  setCore(core: CodemodeCore): void {
    this.core = core
  }

  /** Load an overlay onto the top of the stack */
  async load(overlay: CodemodeOverlay): Promise<void> {
    if (this.stack.some(o => o.id === overlay.id)) {
      throw new Error(`Overlay "${overlay.id}" is already loaded`)
    }
    this.stack.push(overlay)

    // Call onLoad (bottom-up — this is the newest, so it's last)
    if (overlay.lifecycle?.onLoad && this.core) {
      await overlay.lifecycle.onLoad(this.core)
    }

    await this.recompile()
  }

  /** Unload a specific overlay by id */
  async unload(id: string): Promise<void> {
    const idx = this.stack.findIndex(o => o.id === id)
    if (idx === -1) {
      throw new Error(`Overlay "${id}" is not loaded`)
    }

    const overlay = this.stack[idx]

    // Call onUnload
    if (overlay.lifecycle?.onUnload) {
      await overlay.lifecycle.onUnload()
    }

    // Dispose
    if (overlay.dispose) {
      await overlay.dispose()
    }

    this.stack.splice(idx, 1)
    await this.recompile()
  }

  /** Load multiple overlays in stack order */
  async loadBatch(overlays: ReadonlyArray<CodemodeOverlay>): Promise<void> {
    for (const overlay of overlays) {
      if (this.stack.some(o => o.id === overlay.id)) {
        throw new Error(`Overlay "${overlay.id}" is already loaded`)
      }
      this.stack.push(overlay)

      if (overlay.lifecycle?.onLoad && this.core) {
        await overlay.lifecycle.onLoad(this.core)
      }
    }

    await this.recompile()
  }

  /** Unload all overlays (top-down order for lifecycle) */
  async clear(): Promise<void> {
    // Unload top-down
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const overlay = this.stack[i]
      if (overlay.lifecycle?.onUnload) {
        await overlay.lifecycle.onUnload()
      }
      if (overlay.dispose) {
        await overlay.dispose()
      }
    }

    this.stack = []
    await this.recompile()
  }

  /** Switch to a single overlay (clear + load) */
  async switchTo(overlay: CodemodeOverlay): Promise<void> {
    await this.clear()
    await this.load(overlay)
  }

  /** List active overlays in stack order */
  active(): ReadonlyArray<{ id: string; name: string; version?: string }> {
    return this.stack.map(o => ({ id: o.id, name: o.name, version: o.version }))
  }

  /** Check if an overlay is loaded */
  has(id: string): boolean {
    return this.stack.some(o => o.id === id)
  }

  /** Get the compiled state snapshot */
  compiled(): CompiledOverlayState {
    return this._compiled
  }

  /** Get an overlay by id (or undefined) */
  get(id: string): CodemodeOverlay | undefined {
    return this.stack.find(o => o.id === id)
  }

  /** Number of loaded overlays */
  get size(): number {
    return this.stack.length
  }

  // ── Recompile ────────────────────────────────────────────

  private async recompile(): Promise<void> {
    this._compiled = compile(this.stack)

    if (this.onRecompile) {
      await this.onRecompile(this._compiled)
    }
  }
}

// ── Compile ──────────────────────────────────────────────────────

/**
 * Compile a stack of overlays into merged state.
 * Later overlays win on collision (methods, formatters, context fields).
 * Lists concatenate (sections, fragments, procedures, profiles).
 */
function compile(stack: ReadonlyArray<CodemodeOverlay>): CompiledOverlayState {
  const methods: Record<string, Function> = {}
  const guideSections: SectionConfig[] = []
  const guidePriorities: Record<string, number> = {}
  const steerFragments: Array<SteerFragment & { overlayId: string }> = []
  const steerSuppress: Array<{ threshold: number; fragmentIds: ReadonlyArray<string>; overlayId: string }> = []
  const profiles: string[] = []
  const profileBundles: Record<string, any> = {}
  const procedures: Array<SeedProcedure & { overlayId: string }> = []
  const contextFields: Record<string, () => any> = {}
  let contextReplace = false
  const renderers: Record<string, Function> = {}
  const layout: Record<string, any> = {}
  const grid: Record<string, any> = {}
  const errorFormatters: Record<string, (error: any) => string> = {}
  const stackIds: string[] = []

  for (const overlay of stack) {
    stackIds.push(overlay.id)

    // Methods — later wins
    Object.assign(methods, overlay.methods)

    // Guide sections — accumulate
    if (overlay.guide) {
      guideSections.push(...overlay.guide.sections)
      if (overlay.guide.priorities) {
        Object.assign(guidePriorities, overlay.guide.priorities)
      }
    }

    // Steer — accumulate
    if (overlay.steer) {
      for (const frag of overlay.steer.fragments) {
        steerFragments.push({ ...frag, overlayId: overlay.id })
      }
      if (overlay.steer.suppress) {
        steerSuppress.push({ ...overlay.steer.suppress, overlayId: overlay.id })
      }
    }

    // Profiles — union
    if (overlay.profiles) {
      for (const p of overlay.profiles.autoLoad) {
        if (!profiles.includes(p)) profiles.push(p)
      }
      if (overlay.profiles.bundles) {
        Object.assign(profileBundles, overlay.profiles.bundles)
      }
    }

    // Procedures — accumulate
    if (overlay.procedures) {
      for (const proc of overlay.procedures) {
        procedures.push({ ...proc, overlayId: overlay.id })
      }
    }

    // Context — later wins on field collision
    if (overlay.context) {
      Object.assign(contextFields, overlay.context.fields)
      if (overlay.context.replace) contextReplace = true
    }

    // Rendering — later wins
    if (overlay.rendering) {
      if (overlay.rendering.renderers) Object.assign(renderers, overlay.rendering.renderers)
      if (overlay.rendering.layout) Object.assign(layout, overlay.rendering.layout)
      if (overlay.rendering.grid) Object.assign(grid, overlay.rendering.grid)
    }

    // Errors — later wins on tag collision
    if (overlay.errors) {
      Object.assign(errorFormatters, overlay.errors.formatters)
    }
  }

  // Sort steer fragments by priority
  steerFragments.sort((a, b) => (a.priority ?? 50) - (b.priority ?? 50))

  return {
    methods,
    guideSections,
    guidePriorities,
    steerFragments,
    steerSuppress,
    profiles,
    profileBundles,
    procedures,
    contextFields,
    contextReplace,
    renderers,
    layout,
    grid,
    errorFormatters,
    stack: stackIds,
  }
}

function emptyCompiled(): CompiledOverlayState {
  return {
    methods: {},
    guideSections: [],
    guidePriorities: {},
    steerFragments: [],
    steerSuppress: [],
    profiles: [],
    profileBundles: {},
    procedures: [],
    contextFields: {},
    contextReplace: false,
    renderers: {},
    layout: {},
    grid: {},
    errorFormatters: {},
    stack: [],
  }
}

// ── Backward Compat ──────────────────────────────────────────────

/**
 * Convert a legacy CodemodePlugin to an Overlay.
 * Preserves all existing plugin fields, maps them to overlay shape.
 *
 * @deprecated Use CodemodeOverlay directly.
 */
export function pluginToOverlay(plugin: {
  id: string
  name: string
  methods: Record<string, Function>
  manifest?: SectionConfig
  setup?: (core: CodemodeCore) => void | Promise<void>
  dispose?: () => void | Promise<void>
}): CodemodeOverlay {
  return {
    id: plugin.id,
    name: plugin.name,
    methods: plugin.methods,
    guide: plugin.manifest ? { sections: [plugin.manifest] } : undefined,
    lifecycle: plugin.setup ? { onLoad: plugin.setup } : undefined,
    dispose: plugin.dispose,
  }
}
