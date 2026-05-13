/**
 * Manifest section providers — each module contributes its guide section.
 *
 * Sections are registered into the ToolManifest by slot (discipline, shapes,
 * api, patterns, avoid). Static sections are strings; dynamic sections are
 * provider functions called on compile().
 *
 * @module
 */

import type { SectionConfig } from './manifest.ts'

// ─── DISCIPLINE slot ─────────────────────────────────────

export const evalDiscipline: SectionConfig = {
  id: 'eval-discipline',
  slot: 'discipline',
  priority: 10,
  content: [
    '## EVAL DISCIPLINE',
    '',
    'PREFER composed helpers:',
    '  ms.profile("x")    → health+conformance+freshness in ONE call',
    '  ms.each(fn)         → map over all skills (not discover().map())',
    '  ms.where(pred, fn)  → filter+map (not discover().filter().map())',
    '  ms.freshnessAll()   → { total, current, stale, pending, untracked }',
    '',
    'DEFINE local helpers for multi-step logic:',
    '  const gap = s => ({ name: s.name, ...ms.profile(s.name) })',
    '  return ms.where(s => !s.governed, gap)',
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
    '## RLM STORE v2 (all async — use await)',
    '',
    'WRITE:',
    '  await ms.put(collection, key, data, tags?)   canonical put',
    '  await ms.putNow(collection, prefix, data)    auto-timestamped → { ns, key }',
    '  await ms.store(collection, key, data, tags?) backward compat alias',
    '',
    'READ:',
    '  await ms.get(collection, key)      data only, no _meta (null if missing)',
    '  await ms.getRaw(collection, key)   full envelope with _meta',
    '  await ms.describe(collection, key) _meta only { summary, source, tags, ... }',
    '',
    'QUERY:',
    '  await ms.search(text, nsGlob?)     hybrid FlexSearch+FTS5 deep search',
    '  await ms.query(collection, filter?) by tags or JSON path',
    '  await ms.catalog(nsGlob?)          summaries, filterable by glob',
    '',
    'METADATA:',
    '  await ms.collections() → [{ name, count }]',
    '  await ms.vars()        → [{ collection, key, summary, tags, created_at, updated_at }]',
    '  await ms.keys(coll)    → string[]',
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
    'FLUENT BUILDERS:',
    '  await ms.from("ns").tagged("t1").entries()           filtered query',
    '  await ms.from("ns").search("text").keys()            FTS-filtered keys',
    '  await ms.from("ns").limit(5).summaries()             capped catalog',
    '  await ms.from("ns").tagged("t").count()              count matching',
    '  await ms.into("ns").key("k").data({}).meta({ summary: "..." }).put()',
  ].join('\n'),
}

export const contextAndHistory: SectionConfig = {
  id: 'context-history',
  slot: 'api',
  priority: 30,
  content: [
    'CONTEXT & HISTORY:',
    '  ms.context    → { skills: {count,names}, collections, cwd, project }',
    '  ms.history(n) → [{code, result, timestamp}] last N calls this session',
    '',
    '  START sessions: const h = ms.history(5); const v = await ms.vars()',
    '  AVOID re-running code ms.history() shows was already done.',
    '  ALWAYS check await ms.vars() first — the answer may already be stored.',
  ].join('\n'),
}

export const subLmDispatch: SectionConfig = {
  id: 'sub-lm-dispatch',
  slot: 'api',
  priority: 40,
  content: [
    'SUB-LM:',
    '  await ms.llm(prompt, opts?)       single sub-LM call',
    '  await ms.llm_batch(prompts, opts?) parallel calls',
    '  opts: { model?, inject?: ["collection:key"], timeout?, concurrency? }',
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
    '  SEARCH:  await ms.search("breaking") — deep into nested JSON data',
    '  FLUENT:  await ms.from("research").tagged("v4").entries()',
    '  TEMPORAL: await ms.putNow("scans", "adsb", data)',
    '  ACCUMULATE: every session should leave the store richer than it started',
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
    '  - Raw JSON returns — ALWAYS use TUI primitives ({ _v: "tbl" }, etc.)',
    '  - discover().filter().map() — use ms.where(pred, fn)',
    '  - v.ns — the field is v.collection',
    '  - console.log — return values, the renderer handles display',
    '  - Separate inspect+conformance+freshness — use ms.profile("x")',
  ].join('\n'),
}

// ─── All sections (convenience) ──────────────────────────

/** All built-in sections in registration order */
export const ALL_SECTIONS: SectionConfig[] = [
  evalDiscipline,
  tuiPrimitives,
  tuiExamples,
  storeApi,
  storeReturnShapes,
  fluentBuilders,
  contextAndHistory,
  subLmDispatch,
  usagePatterns,
  antiPatterns,
]
