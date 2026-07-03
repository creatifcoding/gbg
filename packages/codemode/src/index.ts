/**
 * @tmnl/codemode — Domain SDK
 *
 * Composable knowledge engine with persistent state, stored procedures,
 * overlay system, and eval sandbox.
 *
 * @example
 * ```ts
 * import { createCodemode } from "@tmnl/codemode"
 * import { sqliteNodeLayer } from "@tmnl/codemode/adapters/sqlite-node"
 * import { metaskillOverlay } from "@tmnl/codemode/plugins/metaskill"
 *
 * const codemode = await createCodemode({
 *   sqlLayer: sqliteNodeLayer({ filename: ".pi/rlm/store.db" }),
 *   overlays: [metaskillOverlay(cwd, fsLayer)],
 *   cwd: process.cwd(),
 * })
 *
 * const result = await codemode.eval('await ms.discover()')
 * await codemode.dispose()
 * ```
 *
 * @module
 */

import type * as Layer from "effect/Layer"
import type { SqlClient } from "effect/unstable/sql/SqlClient"
import type { FileSystem } from "effect/FileSystem"

import { createStoreApi, type StoreApi } from "./store/api.js"
import { createProcedureApi, type ProcedureApi } from "./store/procedures.js"
import { createIoApi, type IoApi } from "./primitives/io.js"
import { OverlayManager, pluginToOverlay, type CodemodeOverlay, type CompiledOverlayState } from "./overlay.js"
import type { CodemodeCore, CodemodeConfig, CodemodeInstance } from "./types.js"

// Legacy compat
import type { CodemodePlugin } from "./plugin.js"

// ── Options ──────────────────────────────────────────────────────

export interface CreateCodemodeOptions {
  /** Effect Layer providing SqlClient — pick your backend */
  readonly sqlLayer: Layer.Layer<SqlClient>

  /** Effect Layer providing FileSystem — needed for read/write/export/import */
  readonly fsLayer: Layer.Layer<FileSystem>

  /** Overlays to load (preferred — full surface control) */
  readonly overlays?: ReadonlyArray<CodemodeOverlay>

  /**
   * Legacy plugin support — auto-wrapped to overlays.
   * @deprecated Use `overlays` instead.
   */
  readonly plugins?: ReadonlyArray<CodemodePlugin>

  /** Working directory for file/shell ops */
  readonly cwd: string
}

// ── Factory ──────────────────────────────────────────────────────

/**
 * Create a codemode instance.
 *
 * Assembles: store + procedures + primitives + overlays → merged API + eval sandbox.
 */
export async function createCodemode(options: CreateCodemodeOptions): Promise<CodemodeInstance> {
  const { sqlLayer, fsLayer, overlays: overlayInputs = [], plugins = [], cwd } = options

  // 1. Create store API (Effect ManagedRuntime over SqlClient layer)
  const store: StoreApi = createStoreApi(sqlLayer, fsLayer)

  // 2. IO primitives backed by Effect FileSystem (cwd-scoped)
  const io: IoApi = createIoApi(cwd, fsLayer)

  // 3. Create procedure API with lazy self-reference
  let _api: Record<string, Function> = {}
  const procApi: ProcedureApi = createProcedureApi(
    store.get.bind(store),
    store.put.bind(store),
    store.delete.bind(store),
    store.query.bind(store),
    store.keys.bind(store),
    () => _api,
  )

  // 4. Assemble core
  const core: CodemodeCore = {
    store,
    procedures: procApi,
    cwd,
    read: io.read,
    write: io.write,
    sh: io.sh,
  }

  // 5. Build core methods (the 37 domain-agnostic methods)
  const coreMethods: Record<string, unknown> = {
    // Store (14)
    store: store.store.bind(store),
    put: store.put.bind(store),
    putNow: store.putNow.bind(store),
    get: store.get.bind(store),
    getRaw: store.getRaw.bind(store),
    describe: store.describe.bind(store),
    query: store.query.bind(store),
    keys: store.keys.bind(store),
    delete: store.delete.bind(store),
    collections: store.collections.bind(store),
    clear: store.clear.bind(store),
    vars: store.vars.bind(store),
    catalog: store.catalog.bind(store),
    search: store.search.bind(store),

    // Builders (2)
    from: store.from.bind(store),
    into: store.into.bind(store),

    // Domains (2)
    domain: store.domain.bind(store),
    domains: store.domains.bind(store),

    // Portability (4)
    exportStore: store.exportStore.bind(store),
    importStore: store.importStore.bind(store),
    profiles: store.profiles.bind(store),
    removeProfile: store.removeProfile.bind(store),

    // Procedures / DPA (8)
    define: procApi.define,
    defineCode: procApi.defineCode,
    call: procApi.call,
    procedures: procApi.procedures,
    describeProcedure: procApi.describe,
    removeProcedure: procApi.remove,
    source: procApi.source,
    fn: procApi.fn,

    // Primitives (3) — async, backed by Effect FileSystem
    read: io.read,
    write: io.write,
    sh: io.sh,
  }

  // 6. Create OverlayManager with recompile hook
  //
  // CRITICAL: Mutate _api in-place (not reassign) so that the eval sandbox's
  // `cm` reference stays valid when overlays are loaded mid-eval.
  // If we did `_api = { ... }`, the sandbox would still hold the old object.
  function rebuildApi(compiled: CompiledOverlayState): void {
    for (const k of Object.keys(_api)) delete _api[k]
    Object.assign(_api, coreMethods, compiled.methods, overlayOps)
  }

  const overlayManager = new OverlayManager({
    onRecompile: rebuildApi,
  })
  overlayManager.setCore(core)

  // 7. Overlay management ops (exposed on cm.*)
  //
  // CRITICAL: async ops return void (not the raw Promise) to prevent
  // structuredClone crashes in pi's emitContext. The Promise is awaited
  // internally by the eval sandbox's `await`, but the resolved value
  // must NOT be a Promise object — pi serializes tool results via
  // structuredClone, and Promises are not clonable.
  const overlayOps: Record<string, Function> = {
    loadOverlay: async (overlay: CodemodeOverlay): Promise<void> => { await overlayManager.load(overlay) },
    unloadOverlay: async (id: string): Promise<void> => { await overlayManager.unload(id) },
    switchOverlay: async (overlay: CodemodeOverlay): Promise<void> => { await overlayManager.switchTo(overlay) },
    overlays: () => overlayManager.active(),
    hasOverlay: (id: string) => overlayManager.has(id),
  }

  // 8. Convert legacy plugins → overlays
  const allOverlays: CodemodeOverlay[] = [
    ...overlayInputs,
    ...plugins.map(pluginToOverlay),
  ]

  // 9. Load initial overlays
  if (allOverlays.length > 0) {
    await overlayManager.loadBatch(allOverlays)
  }

  // 10. Merge: core + overlay methods + overlay management (in-place)
  Object.assign(_api, coreMethods, overlayManager.compiled().methods, overlayOps)

  // 11. Eval sandbox with lifecycle hooks
  async function evalCode(code: string): Promise<any> {
    // Apply onEval transforms (bottom-up through stack)
    let transformed = code
    for (const overlay of allOverlays) {
      if (overlay.lifecycle?.onEval) {
        transformed = overlay.lifecycle.onEval(transformed)
      }
    }

    const fn = new Function("cm", `"use strict"; const ms = cm; return (async () => { ${transformed} })()`)
    let result = await fn(_api)

    // Apply onResult transforms (bottom-up through stack)
    for (const overlay of allOverlays) {
      if (overlay.lifecycle?.onResult) {
        result = overlay.lifecycle.onResult(result)
      }
    }

    return result
  }

  // 12. Dispose
  async function dispose(): Promise<void> {
    await overlayManager.clear()
    await io.dispose()
    await store.dispose()
  }

  return {
    api: _api,
    /** Always-fresh API snapshot merging core + overlay methods + overlay ops */
    getApi(): Record<string, Function> {
      return { ...coreMethods, ...overlayManager.compiled().methods, ...overlayOps } as Record<string, Function>
    },
    eval: evalCode,
    core,
    plugins: overlayManager.compiled().stack,
    overlays: overlayManager,
    dispose,
  }
}

// ── Re-exports ───────────────────────────────────────────────────

export type {
  CodemodeOverlay,
  CompiledOverlayState,
  SteerFragment,
  SeedProcedure,
} from "./overlay.js"
export { OverlayManager, pluginToOverlay } from "./overlay.js"
export type { CodemodeHost, RenderAdapter, HostContext, SteerFormatter } from "./host.js"
export { createTestHost } from "./host.js"

// Legacy compat
export type { CodemodePlugin, PluginLoadResult } from "./plugin.js"
export { mergePlugins } from "./plugin.js"

export type { CodemodeCore, CodemodeConfig, CodemodeInstance } from "./types.js"

// Store (most consumers will use the subpath export)
export type { StoreApi } from "./store/api.js"
export type { ProcedureApi, ProcedureRecord, ProcedureSummary } from "./store/procedures.js"
