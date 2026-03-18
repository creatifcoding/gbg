/**
 * API Surface Registry — single source of truth for all `cm.*` methods.
 *
 * Every method exposed on the `cm` sandbox object MUST be declared here.
 * The manifest coverage test verifies:
 *   1. Every declared method appears in the compiled guide
 *   2. Every `cm.xxx` mention in the guide maps to a declared method
 *
 * Function coloring: every method is annotated as sync or async.
 * Sync methods return values directly. Async methods return Promises
 * and MUST be called with `await`.
 *
 * When you add a method to the cm object in index.ts, add it here.
 * The test will tell you if you forgot to document it in a manifest section.
 *
 * @module
 */

export type FunctionColor = 'sync' | 'async'

export interface ApiMethod {
  /** Method name as it appears on `cm.` (e.g., 'put', 'inspect') */
  name: string
  /** Which manifest section should document this method */
  section: string
  /** Brief one-liner for reference */
  signature: string
  /** Source module: 'core' | 'store' | 'builder' | 'domain' | 'context' | 'llm' | 'procedure' | 'overlay' */
  source: 'core' | 'store' | 'builder' | 'domain' | 'context' | 'llm' | 'procedure' | 'overlay'
  /** Function coloring: sync (returns value) or async (returns Promise, needs await) */
  color: FunctionColor
}

/**
 * Complete API surface. Grouped by source for readability,
 * but the array is the canonical flat list.
 *
 * COLORING RULES:
 * - 'async': Returns Promise — caller MUST use `await`
 * - 'sync':  Returns value directly — no await needed
 *   Sync includes: builders (from/into),
 *   properties (context), in-memory reads (history), factories (metaskill),
 *   and overlay queries (overlays, hasOverlay).
 */
export const API_SURFACE: ApiMethod[] = [
  // ── Core overlay methods (populated by metaskill overlay) ──
  // ALL metaskill methods are async (Effect.runPromise at boundary)
  { name: 'discover',         section: 'eval-discipline', signature: 'async () → SkillInfo[]',           source: 'core', color: 'async' },
  { name: 'info',             section: 'eval-discipline', signature: 'async (name) → SkillInfo',         source: 'core', color: 'async' },
  { name: 'inspect',          section: 'eval-discipline', signature: 'async (name) → HealthReport',      source: 'core', color: 'async' },
  { name: 'audit',            section: 'eval-discipline', signature: 'async () → WorkspaceRow[]',        source: 'core', color: 'async' },
  { name: 'frontmatter',      section: 'eval-discipline', signature: 'async (name) → FrontmatterMap',    source: 'core', color: 'async' },
  { name: 'setFrontmatter',   section: 'eval-discipline', signature: 'async (path, field, value) → void', source: 'core', color: 'async' },
  { name: 'protocol',         section: 'eval-discipline', signature: 'async (key) → string',             source: 'core', color: 'async' },
  { name: 'protocols',        section: 'eval-discipline', signature: 'async () → string[]',              source: 'core', color: 'async' },
  { name: 'utils',            section: 'eval-discipline', signature: 'async () → UtilInfo[]',            source: 'core', color: 'async' },
  { name: 'runUtil',          section: 'eval-discipline', signature: 'async (util, skill) → RunResult',  source: 'core', color: 'async' },
  { name: 'adopt',            section: 'eval-discipline', signature: 'async (name) → string',            source: 'core', color: 'async' },
  { name: 'scaffold',         section: 'eval-discipline', signature: 'async (name, opts) → string[]',    source: 'core', color: 'async' },

  // ── Sync primitives (node:fs / child_process) ──────────
  { name: 'read',             section: 'eval-discipline', signature: 'async (path) → string',             source: 'core', color: 'async' },
  { name: 'write',            section: 'eval-discipline', signature: 'async (path, content) → void',      source: 'core', color: 'async' },
  { name: 'sh',               section: 'eval-discipline', signature: 'async (cmd) → string',              source: 'core', color: 'async' },

  // ── Composed helpers (all async — Effect-backed) ────────
  { name: 'profile',          section: 'eval-discipline', signature: 'async (name) → ProfileReport',     source: 'core', color: 'async' },
  { name: 'each',             section: 'eval-discipline', signature: 'async (fn) → T[]',                 source: 'core', color: 'async' },
  { name: 'where',            section: 'eval-discipline', signature: 'async (pred, fn) → T[]',           source: 'core', color: 'async' },
  { name: 'freshnessAll',     section: 'eval-discipline', signature: 'async () → FreshnessSummary',      source: 'core', color: 'async' },
  { name: 'staleAll',         section: 'eval-discipline', signature: 'async () → UpdatePolicy[]',        source: 'core', color: 'async' },
  { name: 'freshness',        section: 'eval-discipline', signature: 'async (name) → FreshnessReport',   source: 'core', color: 'async' },
  { name: 'conformance',      section: 'eval-discipline', signature: 'async (name) → ConformanceResult', source: 'core', color: 'async' },
  { name: 'conformanceAudit', section: 'eval-discipline', signature: 'async () → ConformanceRow[]',      source: 'core', color: 'async' },
  { name: 'setUpdateStatus',  section: 'eval-discipline', signature: 'async (path, status) → void',      source: 'core', color: 'async' },

  // ── Store (RLM v2) — ALL async ─────────────────────────
  { name: 'store',       section: 'store-api',          signature: 'async (ns, key, data, tags?) → void',   source: 'store', color: 'async' },
  { name: 'put',         section: 'store-api',          signature: 'async (ns, key, data, tags?) → void',   source: 'store', color: 'async' },
  { name: 'putNow',      section: 'store-api',          signature: 'async (ns, prefix, data) → {ns,key}',   source: 'store', color: 'async' },
  { name: 'get',         section: 'store-api',          signature: 'async (ns, key) → data | null',         source: 'store', color: 'async' },
  { name: 'getRaw',      section: 'store-api',          signature: 'async (ns, key) → envelope | null',     source: 'store', color: 'async' },
  { name: 'describe',    section: 'store-api',          signature: 'async (ns, key) → _meta | null',        source: 'store', color: 'async' },
  { name: 'query',       section: 'store-api',          signature: 'async (ns, filter?) → results[]',       source: 'store', color: 'async' },
  { name: 'keys',        section: 'store-api',          signature: 'async (ns) → string[]',                 source: 'store', color: 'async' },
  { name: 'delete',      section: 'store-api',          signature: 'async (ns, key) → boolean',             source: 'store', color: 'async' },
  { name: 'collections', section: 'store-api',          signature: 'async () → [{name, count}]',            source: 'store', color: 'async' },
  { name: 'clear',       section: 'store-api',          signature: 'async (ns) → number',                   source: 'store', color: 'async' },
  { name: 'vars',        section: 'store-api',          signature: 'async () → VarInfo[]',                  source: 'store', color: 'async' },
  { name: 'catalog',     section: 'store-api',          signature: 'async (nsGlob?) → CatalogEntry[]',      source: 'store', color: 'async' },
  { name: 'search',      section: 'store-api',          signature: 'async (text, nsGlob?) → SearchHit[]',   source: 'store', color: 'async' },

  // ── Fluent Builders — sync chain, async terminal ────────
  { name: 'from',        section: 'fluent-builders',    signature: '(ns) → QueryBuilder',                   source: 'builder', color: 'sync' },
  { name: 'into',        section: 'fluent-builders',    signature: '(ns) → PutBuilder',                     source: 'builder', color: 'sync' },

  // ── Domains — async ─────────────────────────────────────
  { name: 'domain',      section: 'store-api',          signature: 'async (name, config) → void',           source: 'domain', color: 'async' },
  { name: 'domains',     section: 'store-api',          signature: 'async () → DomainConfig[]',             source: 'domain', color: 'async' },

  // ── Context & History — sync ────────────────────────────
  { name: 'context',     section: 'context-history',    signature: '→ {skills, collections, cwd, project}', source: 'context', color: 'sync' },
  { name: 'history',     section: 'context-history',    signature: '(n?) → HistoryEntry[]',                 source: 'context', color: 'sync' },

  // ── Sub-LM Dispatch — async ─────────────────────────────
  { name: 'llm',         section: 'sub-lm-dispatch',    signature: 'async (prompt, opts?) → string',        source: 'llm', color: 'async' },
  { name: 'llm_batch',   section: 'sub-lm-dispatch',    signature: 'async (prompts, opts?) → string[]',     source: 'llm', color: 'async' },

  // ── Export / Import / Profiles — async ───────────────────
  { name: 'exportStore',     section: 'store-api',      signature: 'async (opts) → ExportManifest',              source: 'store', color: 'async' },
  { name: 'importStore',     section: 'store-api',      signature: 'async (opts) → ImportResult',                source: 'store', color: 'async' },
  { name: 'profiles',        section: 'store-api',      signature: 'async () → ProfileSummary[]',                source: 'store', color: 'async' },
  { name: 'removeProfile',   section: 'store-api',      signature: 'async (name) → { removed, collections }',   source: 'store', color: 'async' },

  // ── Stored Procedures (DPA) ─────────────────────────────
  { name: 'define',            section: 'stored-procedures', signature: 'async (name, fn, opts) → ProcedureRecord', source: 'procedure', color: 'async' },
  { name: 'defineCode',        section: 'stored-procedures', signature: 'async (name, code, opts) → ProcedureRecord', source: 'procedure', color: 'async' },
  { name: 'call',              section: 'stored-procedures', signature: 'async (name, args?) → any',                source: 'procedure', color: 'async' },
  { name: 'procedures',        section: 'stored-procedures', signature: 'async () → ProcedureSummary[]',            source: 'procedure', color: 'async' },
  { name: 'describeProcedure', section: 'stored-procedures', signature: 'async (name) → ProcedureRecord | null',    source: 'procedure', color: 'async' },
  { name: 'removeProcedure',   section: 'stored-procedures', signature: 'async (name) → boolean',                   source: 'procedure', color: 'async' },
  { name: 'source',            section: 'stored-procedures', signature: 'async (name) → string | null',             source: 'procedure', color: 'async' },
  { name: 'fn',                section: 'stored-procedures', signature: '→ Proxy (calls are awaitable)',              source: 'procedure', color: 'sync' },

  // ── Overlay management ──────────────────────────────────
  { name: 'loadOverlay',   section: 'overlay-management', signature: 'async (overlay) → void',                     source: 'overlay', color: 'async' },
  { name: 'unloadOverlay', section: 'overlay-management', signature: 'async (id) → void',                          source: 'overlay', color: 'async' },
  { name: 'switchOverlay', section: 'overlay-management', signature: 'async (overlay) → void',                     source: 'overlay', color: 'async' },
  { name: 'overlays',      section: 'overlay-management', signature: '() → [{id, name, version?}]',               source: 'overlay', color: 'sync' },
  { name: 'hasOverlay',    section: 'overlay-management', signature: '(id) → boolean',                             source: 'overlay', color: 'sync' },

  // ── Overlay factories (pi-specific, host-injected) ──────
  { name: 'metaskill',    section: 'overlay-management', signature: '() → CodemodeOverlay',                        source: 'overlay', color: 'sync' },
]

/** All method names as a Set for fast lookup */
export const API_METHOD_NAMES = new Set(API_SURFACE.map(m => m.name))

/** Methods grouped by source */
export function methodsBySource(): Record<string, ApiMethod[]> {
  const groups: Record<string, ApiMethod[]> = {}
  for (const m of API_SURFACE) {
    ;(groups[m.source] ??= []).push(m)
  }
  return groups
}

/** Methods grouped by section */
export function methodsBySection(): Record<string, ApiMethod[]> {
  const groups: Record<string, ApiMethod[]> = {}
  for (const m of API_SURFACE) {
    ;(groups[m.section] ??= []).push(m)
  }
  return groups
}

/** Methods grouped by function color */
export function methodsByColor(): { sync: ApiMethod[]; async: ApiMethod[] } {
  return {
    sync: API_SURFACE.filter(m => m.color === 'sync'),
    async: API_SURFACE.filter(m => m.color === 'async'),
  }
}
