/**
 * Manifest section providers — each module contributes its guide section.
 *
 * Sections are registered into the ToolManifest by slot (discipline, shapes,
 * api, patterns, avoid). Static sections are strings; dynamic sections are
 * provider functions called on compile().
 *
 * Function coloring is enforced throughout:
 * - `await` prefix = async (returns Promise)
 * - no prefix = sync (returns value directly)
 *
 * @module
 */

import type { SectionConfig } from './manifest.js'

// ─── DISCIPLINE slot ─────────────────────────────────────

export const functionColoring: SectionConfig = {
  id: 'function-coloring',
  slot: 'discipline',
  priority: 1,
  content: [
    '## FUNCTION COLORING — RESPECT IT',
    '',
    'Every cm.* method is either SYNC or ASYNC. The coloring is annotated below.',
    'Misuse causes silent bugs: dropped results, unresolved Promises, DataCloneError.',
    '',
    'RULES:',
    '  1. Methods marked `await` MUST be awaited — they return Promises.',
    '  2. Methods WITHOUT `await` are sync — do NOT await them.',
    '  3. Fluent chains (cm.from/cm.into) are sync, but their TERMINALS are async:',
    '     await cm.from("ns").tagged("t").entries()   ← entries() is the async terminal',
    '  4. cm.fn.name() calls are ALWAYS async — the Proxy dispatches to cm.call().',
    '',
    'SYNC (no await):',
    '  cm.from(ns)            cm.into(ns)             cm.context',
    '  cm.history(n?)         cm.fn                   cm.overlays()',
    '  cm.hasOverlay(id)      cm.metaskill()',
    '',
    'ASYNC (must await):',
    '  Everything else — including cm.read/cm.write/cm.sh (Effect FileSystem-backed),',
    '  all store ops, all domain methods, all overlay methods,',
    '  all procedures (call/define/etc), all LLM calls, all overlay management.',
    '',
    '⚠ NEVER return a raw Promise — always await before returning.',
    '  WRONG: return cm.get("ns", "key")      ← returns Promise, crashes serializer',
    '  RIGHT: return await cm.get("ns", "key") ← returns resolved value',
  ].join('\n'),
}

export const evalDiscipline: SectionConfig = {
  id: 'eval-discipline',
  slot: 'discipline',
  priority: 10,
  after: ['function-coloring'],
  content: [
    '## SKILL GOVERNANCE (overlay: metaskill — all async, use await)',
    '',
    'DISCOVERY (async):',
    '  await cm.discover()          → SkillInfo[]    await cm.info(name) → SkillInfo',
    '  await cm.inspect(name)       → HealthReport   await cm.audit()    → WorkspaceRow[]',
    '  await cm.adopt(name)         → string         await cm.scaffold(name) → string[]',
    '',
    'FRONTMATTER & PROTOCOLS (async):',
    '  await cm.frontmatter(name)   → FmMap          await cm.setFrontmatter(path, field, val)',
    '  await cm.protocol(key)       → string         await cm.protocols()    → string[]',
    '  await cm.utils()             → UtilInfo[]     await cm.runUtil(u, s)  → RunResult',
    '',
    'PRIMITIVES (async — Effect FileSystem-backed, must await):',
    '  await cm.read(path)    → string         await cm.write(path, content)  → void',
    '  await cm.sh(cmd)       → string',
    '',
    'FRESHNESS & CONFORMANCE (async):',
    '  await cm.freshness(name)      → FreshnessReport',
    '  await cm.setUpdateStatus(path, status)',
    '  await cm.conformance(name)    → ConformanceResult',
    '  await cm.conformanceAudit()   → ConformanceRow[]',
    '  await cm.staleAll()           → UpdatePolicy[]',
    '',
    'COMPOSED HELPERS (async — prefer over inline loops):',
    '  await cm.profile("x")    → health+conformance+freshness in ONE call',
    '  await cm.each(fn)         → map over all skills (not discover().map())',
    '  await cm.where(pred, fn)  → filter+map (not discover().filter().map())',
    '  await cm.freshnessAll()   → { total, current, stale, pending, untracked }',
    '',
    'RETURN shaped objects — use TUI primitives (see SHAPES below).',
  ].join('\n'),
}

// ─── SHAPES slot ─────────────────────────────────────────

export const tuiPrimitives: SectionConfig = {
  id: 'tui-primitives',
  slot: 'shapes',
  priority: 10,
  content: [
    '## TUI PRIMITIVES — USE THEM',
    '',
    'Return tagged objects for rich TUI rendering. The LLM gets clean data',
    '(all _v/note/flex stripped automatically), the TUI gets tables/stacks/etc.',
    '',
    'TAGS:',
    '  { _v: "tbl", d: [...rows], note: ["📦", "msg"] }   table',
    '  { _v: "kv",  d: { key: val, ... } }                 key-value pairs',
    '  { _v: "ls",  d: [...items] }                         list',
    '  { _v: "md",  text: "# markdown" }                    rendered markdown',
    '  { _v: "code", d: "...", lang: "ts" }                 syntax-highlighted',
    '  { _v: "bar", v: 7, max: 10, label: "health" }       progress bar',
    '  { _v: "tag", text: "done", color: "success" }        semantic badge',
    '  { _v: "txt", d: "plain text", color: "muted" }       colored text',
    '  { _v: "tree", d: { nested: { object: 1 } } }         tree view',
    '  { _v: "diff", a: "before", b: "after" }              diff view',
    '',
    'COMPOSITES (stack vertically or side-by-side):',
    '  { _v: "stk", items: [prim1, prim2, ...], gap: 1 }   vertical stack',
    '  { _v: "row", items: [prim1, prim2], weights: [1,2] } horizontal row',
    '',
    'OPTIONAL on any leaf: note: ["icon", "message"], flex: number',
    'COLORS: "success" | "error" | "warning" | "accent" | "muted"',
  ].join('\n'),
}

export const tuiExamples: SectionConfig = {
  id: 'tui-examples',
  slot: 'shapes',
  priority: 20,
  after: ['tui-primitives'],
  content: [
    'EXAMPLES:',
    '  // Table with footer note',
    '  return { _v: "tbl", d: results.map(r => ({ name: r.name, score: r.score })), note: ["🔍", `${results.length} hits`] }',
    '',
    '  // Stacked: table + bar + markdown',
    '  return { _v: "stk", items: [',
    '    { _v: "tbl", d: rows },',
    '    { _v: "bar", v: passed, max: total, label: "health" },',
    '    { _v: "md", text: "## Summary\\n..." },',
    '  ]}',
    '',
    'WHEN TO USE WHAT:',
    '  Array of objects → { _v: "tbl", d: array }',
    '  Single object    → { _v: "kv", d: object }',
    '  Flat list/names  → { _v: "ls", d: array }',
    '  Long explanation  → { _v: "md", text: string }',
    '  Multiple sections → { _v: "stk", items: [...] }',
    '  Raw JSON is WRONG — always wrap in a primitive.',
  ].join('\n'),
}

// ─── API slot ────────────────────────────────────────────

export const storeApi: SectionConfig = {
  id: 'store-api',
  slot: 'api',
  priority: 10,
  content: [
    '## RLM STORE v2 (all async — MUST await every call)',
    '',
    'WRITE (async):',
    '  await cm.put(collection, key, data, tags?)   canonical put',
    '  await cm.putNow(collection, prefix, data)    auto-timestamped → { ns, key }',
    '  await cm.store(collection, key, data, tags?) backward compat alias',
    '',
    'READ (async):',
    '  await cm.get(collection, key)      data only, no _meta (null if missing)',
    '  await cm.getRaw(collection, key)   full envelope with _meta',
    '  await cm.describe(collection, key) _meta only { summary, source, tags, ... }',
    '',
    'QUERY (async):',
    '  await cm.search(text, nsGlob?)     hybrid FlexSearch+FTS5 deep search',
    '  await cm.query(collection, filter?) by tags or JSON path',
    '  await cm.catalog(nsGlob?)          summaries, filterable by glob',
    '',
    'METADATA (async):',
    '  await cm.collections() → [{ name, count }]',
    '  await cm.vars()        → [{ collection, key, summary, tags, created_at, updated_at }]',
    '  await cm.keys(coll)    → string[]',
    '',
    'MUTATE (async):',
    '  await cm.delete(collection, key) → boolean',
    '  await cm.clear(collection)       → number (deleted count)',
    '',
    'DOMAINS (async):',
    '  await cm.domain(name, config)    register domain schema',
    '  await cm.domains()               list registered domains',
    '',
    'EXPORT / IMPORT / PROFILES (async):',
    '  await cm.exportStore({ path, format?, glob?, keys?, keyGlob?, pretty?, profile?, fromProfile?, since? })',
    '    format: "json" (default) | "sqlite" | "procedures"',
    '    glob: filter collections — keys: ["col/key"] cherry-pick — keyGlob: "schema*" pattern',
    '    profile: "my-profile" — name this export (embedded in manifest)',
    '    fromProfile: "X" — export only objects profile X imported',
    '    since: "X" — export objects added/changed after profile X was applied',
    '  await cm.importStore({ path, mode?, glob?, keys?, keyGlob?, profile? }) → ImportResult',
    '    mode: "merge" (default, upsert) | "replace" (clear + load)',
    '    profile: "my-profile" — name this import (falls back to manifest.profile)',
    '    Named imports: tag objects with _meta.profile, record in _system.profiles ledger.',
    '    manifest: MANDATORY for named profiles — describes what this profile contributes.',
    '  await cm.profiles() → ProfileSummary[] — list applied profiles',
    '  await cm.removeProfile(name) → { removed, collections } — unapply a profile layer',
  ].join('\n'),
}

export const storeReturnShapes: SectionConfig = {
  id: 'store-return-shapes',
  slot: 'api',
  priority: 15,
  after: ['store-api'],
  content: [
    'RETURN SHAPES (use the right field names!):',
    '  vars()        → { collection, key, summary, tags[], created_at, updated_at }',
    '  collections() → { name, count }',
    '  search()      → { collection, key, score, matchedFields[] }',
    '  catalog()     → { collection, key, summary, tags[] }',
    '  ⚠ Field is `collection` NOT `ns`. There is no `ns` field.',
  ].join('\n'),
}

export const fluentBuilders: SectionConfig = {
  id: 'fluent-builders',
  slot: 'api',
  priority: 20,
  after: ['store-api'],
  content: [
    'FLUENT BUILDERS (sync chain → async terminal):',
    '  cm.from("ns") and cm.into("ns") are SYNC — they return builder objects.',
    '  Terminal methods (.entries(), .keys(), .put(), etc.) are ASYNC — await them.',
    '',
    '  await cm.from("ns").tagged("t1").entries()           filtered query',
    '  await cm.from("ns").search("text").keys()            FTS-filtered keys',
    '  await cm.from("ns").limit(5).summaries()             capped catalog',
    '  await cm.from("ns").tagged("t").count()              count matching',
    '  await cm.into("ns").key("k").data({}).meta({ summary: "..." }).put()',
  ].join('\n'),
}

export const contextAndHistory: SectionConfig = {
  id: 'context-history',
  slot: 'api',
  priority: 30,
  content: [
    'CONTEXT & HISTORY (sync — no await):',
    '  cm.context    → { skills: {count,names}, collections, cwd, project }',
    '  cm.history(n) → [{code, result, timestamp}] last N calls this session',
    '',
    '  START sessions: const h = cm.history(5); const v = await cm.vars()',
    '  AVOID re-running code cm.history() shows was already done.',
    '  ALWAYS check await cm.vars() first — the answer may already be stored.',
  ].join('\n'),
}

export const subLmDispatch: SectionConfig = {
  id: 'sub-lm-dispatch',
  slot: 'api',
  priority: 40,
  content: [
    'SUB-LM (async):',
    '  await cm.llm(prompt, opts?)       single sub-LM call',
    '  await cm.llm_batch(prompts, opts?) parallel calls',
    '  opts: { model?, inject?: ["collection:key"], timeout?, concurrency? }',
  ].join('\n'),
}

// ─── API slot: Overlay Management ────────────────────────

export const overlayManagement: SectionConfig = {
  id: 'overlay-management',
  slot: 'api',
  priority: 45,
  content: [
    '### Overlay Management',
    '',
    'Overlays are NOT auto-loaded. Load them explicitly.',
    '',
    'ASYNC (must await):',
    '  await cm.loadOverlay(overlay)    load an overlay onto the stack',
    '  await cm.unloadOverlay(id)       remove overlay by id',
    '  await cm.switchOverlay(overlay)  clear stack + load one overlay',
    '',
    'SYNC (no await):',
    '  cm.overlays()         → [{id, name, version?}] currently loaded',
    '  cm.hasOverlay(id)     → boolean',
    '',
    'FACTORIES (sync — produce overlay objects for loadOverlay):',
    '  cm.metaskill()        → CodemodeOverlay (skill governance)',
    '',
    'EXAMPLE:',
    '  await cm.loadOverlay(cm.metaskill())   // load skill governance',
    '  cm.overlays()                           // → [{id:"metaskill", name:"Skill Governance"}]',
    '  const skills = await cm.discover()     // now available',
    '  await cm.unloadOverlay("metaskill")    // unload',
  ].join('\n'),
}

// ─── API slot: Stored Procedures (DPA) ──────────────────

export const storedProcedures: SectionConfig = {
  id: 'stored-procedures',
  slot: 'api',
  priority: 35,
  after: ['store-api'],
  content: [
    '### Stored Procedures (DPA) — all async except cm.fn',
    '',
    'ASYNC (must await):',
    '  await cm.define("name", fn, opts)          → ProcedureRecord (opts.manifest is REQUIRED)',
    '  await cm.defineCode("name", code, opts)    → ProcedureRecord (opts.manifest is REQUIRED)',
    '  await cm.call("name", args?)               → any (execute a stored procedure)',
    '  await cm.procedures()                      → ProcedureSummary[] (list all procedures)',
    '  await cm.describeProcedure("name")         → ProcedureRecord | null (full record)',
    '  await cm.removeProcedure("name")           → boolean (delete a procedure)',
    '  await cm.source("name")                    → string | null (get source code)',
    '',
    'SYNC (returns Proxy, but calls through it are async):',
    '  cm.fn                                      → Proxy object',
    '  await cm.fn.name(args?)                    → any (same as cm.call("name", args))',
    '',
    '  opts for cm.define():',
    '    manifest:    string               MANDATORY — tool guide entry (e.g. "cm.fn.X() → Y")',
    '    description: string               human-readable description',
    '    tags:        string[]             categorization tags',
    '    author:      string               who created it (default: "agent")',
    '    dependencies: string[]            names of other procedures this calls',
    '    inputSchema:  object              JSON Schema for input validation',
    '    outputSchema: object              JSON Schema for output validation',
    '',
    '  Storage: _system.procedures collection, auto-kebab keys (healthCheck → health-check).',
    '  _meta: auto-injected — { summary: "[proc vN] description", source: "dpa", type: "procedure" }.',
    '  Discoverable via cm.catalog("_system.procedures"), cm.describe("_system.procedures", key).',
    '  Procedures receive (ms, args) — full cm API available inside.',
    '  Auto-version on redefine. Stored in _system.procedures.',
    '  PREFER await cm.fn.name() for known procs, await cm.call() for dynamic dispatch.',
    '  PORTABLE: await cm.exportStore({ path, format: "procedures" }) bundles all procs as JSON.',
    '  SHARE:    await cm.importStore({ path, profile: "team-procs" }) applies as a named profile layer.',
  ].join('\n'),
}

// ─── PATTERNS slot ───────────────────────────────────────

export const usagePatterns: SectionConfig = {
  id: 'usage-patterns',
  slot: 'patterns',
  priority: 10,
  content: [
    '## PATTERNS',
    '',
    '  SEARCH:  await cm.search("breaking") — deep into nested JSON data',
    '  FLUENT:  await cm.from("research").tagged("v4").entries()',
    '  TEMPORAL: await cm.putNow("scans", "adsb", data)',
    '  ACCUMULATE: every session should leave the store richer than it started',
    '  DEFINE REUSABLE: await cm.define("name", fn, {manifest, description, tags})',
    '  COMPOSE: procedures call procedures via await cm.fn.other() or await cm.call("other", args)',
    '  DISCOVER: await cm.procedures() lists, await cm.describeProcedure("name") inspects',
    '  EXPORT:  await cm.exportStore({ path, profile: "snapshot" })',
    '  IMPORT:  await cm.importStore({ path, profile: "team-knowledge" })',
    '  CHERRY:  await cm.exportStore({ path, keys: ["effect.api/fs-v4"] })',
    '  PROFILE: await cm.profiles() lists, await cm.removeProfile("name") unapplies',
    '  OVERLAY: await cm.loadOverlay(cm.metaskill()) — load on demand',
  ].join('\n'),
}

// ─── AVOID slot ──────────────────────────────────────────

export const antiPatterns: SectionConfig = {
  id: 'anti-patterns',
  slot: 'avoid',
  priority: 10,
  content: [
    '## AVOID',
    '',
    '  - Missing await on async calls — causes silent Promise leaks / DataCloneError',
    '  - Raw JSON returns — ALWAYS use TUI primitives ({ _v: "tbl" }, etc.)',
    '  - discover().filter().map() — use await cm.where(pred, fn)',
    '  - v.ns — the field is v.collection',
    '  - console.log — return values, the renderer handles display',
    '  - Separate inspect+conformance+freshness — use await cm.profile("x")',
    '  - Rewriting logic each session — define a procedure, call it next time',
    '  - cm.put("_system.procedures", ...) directly — use cm.define(), it handles _meta and versioning',
    '  - Assuming overlays are loaded — check cm.hasOverlay("metaskill") first',
    '  - return cm.get(...) without await — returns Promise, not data',
  ].join('\n'),
}

// ─── All sections (convenience) ──────────────────────────

/** All built-in sections in registration order */
export const ALL_SECTIONS: SectionConfig[] = [
  functionColoring,
  evalDiscipline,
  tuiPrimitives,
  tuiExamples,
  storeApi,
  storeReturnShapes,
  fluentBuilders,
  storedProcedures,
  overlayManagement,
  contextAndHistory,
  subLmDispatch,
  usagePatterns,
  antiPatterns,
]
