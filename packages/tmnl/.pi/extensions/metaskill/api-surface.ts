/**
 * API Surface Registry — single source of truth for all `ms.*` methods.
 *
 * Every method exposed on the `ms` sandbox object MUST be declared here.
 * The manifest coverage test verifies:
 *   1. Every declared method appears in the compiled guide
 *   2. Every `ms.xxx` mention in the guide maps to a declared method
 *
 * When you add a method to the ms object in index.ts, add it here.
 * The test will tell you if you forgot to document it in a manifest section.
 *
 * @module
 */

export interface ApiMethod {
  /** Method name as it appears on `ms.` (e.g., 'put', 'inspect') */
  name: string
  /** Which manifest section should document this method */
  section: string
  /** Brief one-liner for reference */
  signature: string
  /** Source module: 'codemod' | 'store' | 'builder' | 'domain' | 'context' | 'llm' */
  source: 'codemod' | 'store' | 'builder' | 'domain' | 'context' | 'llm'
}

/**
 * Complete API surface. Grouped by source for readability,
 * but the array is the canonical flat list.
 */
export const API_SURFACE: ApiMethod[] = [
  // ── Codemod (from createApi) ────────────────────────
  { name: 'discover',       section: 'eval-discipline', signature: '() → SkillInfo[]',           source: 'codemod' },
  { name: 'info',           section: 'eval-discipline', signature: '(name) → SkillInfo',         source: 'codemod' },
  { name: 'inspect',        section: 'eval-discipline', signature: '(name) → HealthReport',      source: 'codemod' },
  { name: 'audit',          section: 'eval-discipline', signature: '() → WorkspaceRow[]',        source: 'codemod' },
  { name: 'frontmatter',    section: 'eval-discipline', signature: '(name) → FrontmatterMap',    source: 'codemod' },
  { name: 'setFrontmatter', section: 'eval-discipline', signature: '(path, field, value) → void', source: 'codemod' },
  { name: 'protocol',       section: 'eval-discipline', signature: '(key) → string',             source: 'codemod' },
  { name: 'protocols',      section: 'eval-discipline', signature: '() → string[]',              source: 'codemod' },
  { name: 'utils',          section: 'eval-discipline', signature: '() → UtilInfo[]',            source: 'codemod' },
  { name: 'runUtil',        section: 'eval-discipline', signature: '(util, skill) → RunResult',  source: 'codemod' },
  { name: 'adopt',          section: 'eval-discipline', signature: '(name) → string',            source: 'codemod' },
  { name: 'scaffold',       section: 'eval-discipline', signature: '(name, opts) → string[]',    source: 'codemod' },
  { name: 'read',           section: 'eval-discipline', signature: '(path) → string',            source: 'codemod' },
  { name: 'write',          section: 'eval-discipline', signature: '(path, content) → void',     source: 'codemod' },
  { name: 'sh',             section: 'eval-discipline', signature: '(cmd) → string',             source: 'codemod' },

  // ── Composed helpers (from createApi) ───────────────
  { name: 'profile',        section: 'eval-discipline', signature: '(name) → ProfileReport',     source: 'codemod' },
  { name: 'each',           section: 'eval-discipline', signature: '(fn) → T[]',                 source: 'codemod' },
  { name: 'where',          section: 'eval-discipline', signature: '(pred, fn) → T[]',           source: 'codemod' },
  { name: 'freshnessAll',   section: 'eval-discipline', signature: '() → FreshnessSummary',      source: 'codemod' },
  { name: 'staleAll',       section: 'eval-discipline', signature: '() → UpdatePolicy[]',        source: 'codemod' },
  { name: 'freshness',      section: 'eval-discipline', signature: '(name) → FreshnessReport',   source: 'codemod' },
  { name: 'conformance',    section: 'eval-discipline', signature: '(name) → ConformanceResult', source: 'codemod' },
  { name: 'conformanceAudit', section: 'eval-discipline', signature: '() → ConformanceRow[]',    source: 'codemod' },
  { name: 'setUpdateStatus', section: 'eval-discipline', signature: '(path, status) → void',     source: 'codemod' },

  // ── Store (RLM v2) ─────────────────────────────────
  { name: 'store',       section: 'store-api',          signature: '(ns, key, data, tags?) → void',  source: 'store' },
  { name: 'put',         section: 'store-api',          signature: '(ns, key, data, tags?) → void',  source: 'store' },
  { name: 'putNow',      section: 'store-api',          signature: '(ns, prefix, data) → {ns,key}',  source: 'store' },
  { name: 'get',         section: 'store-api',          signature: '(ns, key) → data | null',        source: 'store' },
  { name: 'getRaw',      section: 'store-api',          signature: '(ns, key) → envelope | null',    source: 'store' },
  { name: 'describe',    section: 'store-api',          signature: '(ns, key) → _meta | null',       source: 'store' },
  { name: 'query',       section: 'store-api',          signature: '(ns, filter?) → results[]',      source: 'store' },
  { name: 'keys',        section: 'store-api',          signature: '(ns) → string[]',                source: 'store' },
  { name: 'delete',      section: 'store-api',          signature: '(ns, key) → boolean',            source: 'store' },
  { name: 'collections', section: 'store-api',          signature: '() → [{name, count}]',           source: 'store' },
  { name: 'clear',       section: 'store-api',          signature: '(ns) → number',                  source: 'store' },
  { name: 'vars',        section: 'store-api',          signature: '() → VarInfo[]',                 source: 'store' },
  { name: 'catalog',     section: 'store-api',          signature: '(nsGlob?) → CatalogEntry[]',     source: 'store' },
  { name: 'search',      section: 'store-api',          signature: '(text, nsGlob?) → SearchHit[]',  source: 'store' },

  // ── Fluent Builders ─────────────────────────────────
  { name: 'from',        section: 'fluent-builders',    signature: '(ns) → QueryBuilder',            source: 'builder' },
  { name: 'into',        section: 'fluent-builders',    signature: '(ns) → PutBuilder',              source: 'builder' },

  // ── Domains ─────────────────────────────────────────
  { name: 'domain',      section: 'store-api',          signature: '(name, config) → void',          source: 'domain' },
  { name: 'domains',     section: 'store-api',          signature: '() → DomainConfig[]',            source: 'domain' },

  // ── Context & History ───────────────────────────────
  { name: 'context',     section: 'context-history',    signature: '→ {skills, collections, cwd, project}', source: 'context' },
  { name: 'history',     section: 'context-history',    signature: '(n?) → HistoryEntry[]',          source: 'context' },

  // ── Sub-LM Dispatch ─────────────────────────────────
  { name: 'llm',         section: 'sub-lm-dispatch',    signature: '(prompt, opts?) → string',       source: 'llm' },
  { name: 'llm_batch',   section: 'sub-lm-dispatch',    signature: '(prompts, opts?) → string[]',    source: 'llm' },
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
