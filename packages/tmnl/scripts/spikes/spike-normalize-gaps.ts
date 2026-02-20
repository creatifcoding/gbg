#!/usr/bin/env bun
/**
 * spike-normalize-gaps.ts — E2E spike for known normalization gaps (#1886)
 *
 * Exercises the full normalize → repair pipeline against:
 *   Gap 1: URL-in-comment false positive (// inside string values)
 *   Gap 2: Truncated JSON (SSE stream cutoff mid-response)
 *   Gap 3: Multi-root responses (two JSON objects in one response)
 *   Gap 4: Null/number children in arrays
 *   Gap 5: Unknown format fallthrough
 *   Gap 6: Deeply nested hybrid (3+ levels of sibling definitions)
 *   Gap 7: Real LLM response with URLs in props (live OpenAI call)
 *
 * Run: bun run scripts/spikes/spike-normalize-gaps.ts
 */

import { Effect, Option, Exit, Cause } from "effect"
import {
  normalize,
  normalizeWithMeta,
  extractJson,
  parseJson,
  detectFormat,
  NormalizeError,
} from "../../src/lib/genifer/core/normalize"
import { repair } from "../../src/lib/genifer/core/repair"
import { UITree } from "../../src/lib/genifer/core/schemas"
import {
  createCatalogLayer,
  getSystemPrompt,
  type DomainCatalog,
} from "../../src/lib/genifer/core/CatalogService"

// =============================================================================
// Harness
// =============================================================================

let passed = 0
let failed = 0
let warned = 0

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  \x1b[32m✅\x1b[0m ${label}`)
    passed++
  } else {
    console.log(`  \x1b[31m❌\x1b[0m ${label}${detail ? ` — ${detail}` : ""}`)
    failed++
  }
}

function warn(label: string, detail?: string) {
  console.log(`  \x1b[33m⚠️\x1b[0m ${label}${detail ? ` — ${detail}` : ""}`)
  warned++
}

function stage(name: string) {
  console.log(`\n\x1b[36m━━━ ${name} ━━━\x1b[0m`)
}

function run<A>(eff: Effect.Effect<A, any>): A {
  return Effect.runSync(eff)
}

/** Run returning Exit so we can inspect NormalizeError without FiberFailure wrapping */
function runExit<A, E>(eff: Effect.Effect<A, E>): Exit.Exit<A, E> {
  return Effect.runSyncExit(eff)
}

/** Extract the failure value from an Exit */
function getFailure<E>(exit: Exit.Exit<any, E>): E | null {
  if (Exit.isFailure(exit)) {
    return Cause.failureOption(exit.cause).pipe(Option.getOrNull)
  }
  return null
}

// =============================================================================
// Gap 1: URL-in-comment false positive
// =============================================================================

stage("Gap 1: URLs inside string values survive comment stripping")

const gap1_input = `{
  "type": "Card",
  "key": "link-card",
  "props": {
    "title": "Documentation",
    "url": "https://example.com/docs",
    "icon": "https://cdn.example.com/icon.png",
    "apiEndpoint": "http://localhost:3000/api/v1",
    "protocol": "wss://realtime.example.com/ws"
  }
}`

try {
  const extracted = run(extractJson(gap1_input))
  const parsed = JSON.parse(extracted)
  check("extractJson preserves https:// in props", parsed.props.url === "https://example.com/docs")
  check("extractJson preserves http:// in props", parsed.props.apiEndpoint === "http://localhost:3000/api/v1")
  check("extractJson preserves wss:// in props", parsed.props.protocol === "wss://realtime.example.com/ws")

  const tree = run(normalize(gap1_input))
  const el = Option.getOrThrow(tree.getElement("link-card"))
  check("normalize preserves URL props end-to-end", el.props.url === "https://example.com/docs")
} catch (e: any) {
  check("Gap 1 doesn't crash", false, e.message ?? String(e))
}

// Also test actual // comments mixed with URL strings
const gap1b_input = `{
  "type": "Page", // this is the root page
  "key": "p1",
  "props": {
    "url": "https://example.com" // link to docs
  }
}`

try {
  const extracted = run(extractJson(gap1b_input))
  const parsed = JSON.parse(extracted)
  check("Strips comments but preserves URL in same object", parsed.props.url === "https://example.com")
  check("Comment after type field stripped cleanly", parsed.type === "Page")
} catch (e: any) {
  check("Gap 1b mixed comments + URLs", false, e.message ?? String(e))
}

// =============================================================================
// Gap 2: Truncated JSON (incomplete response)
// =============================================================================

stage("Gap 2: Truncated JSON recovery")

const gap2_input = `{
  "type": "Page",
  "key": "dashboard",
  "props": { "title": "DevOps" },
  "children": [
    { "type": "Card", "key": "c1", "props": { "title": "Stats" } },
    { "type": "Card", "key": "c2", "props": { "title": "Char`
// Truncated mid-string — SSE stream died

{
  const exit = runExit(normalize(gap2_input))
  if (Exit.isSuccess(exit)) {
    const tree = exit.value
    check("Truncated JSON produces partial tree", tree.size >= 2, `got ${tree.size} elements`)
    check("Root preserved from truncated response", tree.root === "dashboard")
    const c1 = tree.getElement("c1")
    check("Complete child c1 recovered", Option.isSome(c1))
  } else {
    const err = getFailure(exit)
    if (err && err._tag === "NormalizeError") {
      check("Truncated JSON → NormalizeError (not crash)", true)
      warn("No partial recovery — only error", err.message)
    } else {
      check("Truncated JSON doesn't throw unexpected error", false, String(err))
    }
  }
}

// Truncated after a complete child but before closing the array
const gap2b_input = `{
  "type": "Page",
  "key": "p",
  "children": [
    { "type": "Card", "key": "c1", "props": { "title": "Done" } },
    { "type": "Card", "key": "c2", "props": { "title": "Also Done" } }`
// Missing: closing ] and }

{
  const exit = runExit(normalize(gap2b_input))
  if (Exit.isSuccess(exit)) {
    const tree = exit.value
    check("Truncated-after-children produces tree", tree.size >= 2, `got ${tree.size} elements`)
    check("Truncated-after-children: c1 recovered", Option.isSome(tree.getElement("c1")))
    check("Truncated-after-children: c2 recovered", Option.isSome(tree.getElement("c2")))
  } else {
    const err = getFailure(exit)
    check("Truncated-after-children → NormalizeError", err?._tag === "NormalizeError")
    warn("Both children complete but can't recover", err?.message)
  }
}

// =============================================================================
// Gap 3: Multi-root responses
// =============================================================================

stage("Gap 3: Multi-root JSON (two objects in one response)")

const gap3_input = `Here are two sections:

{
  "type": "Section",
  "key": "s1",
  "props": { "title": "Pipeline" },
  "children": [
    { "type": "MetricCard", "key": "m1", "props": { "label": "Status", "value": "OK" } }
  ]
}

{
  "type": "Section",
  "key": "s2",
  "props": { "title": "Infrastructure" },
  "children": [
    { "type": "MetricCard", "key": "m2", "props": { "label": "CPU", "value": "42%" } }
  ]
}

That's the dashboard.`

try {
  const tree = run(normalize(gap3_input))
  check("Multi-root: first object extracted", tree.size >= 2)

  // Check if BOTH roots were captured
  const hasS1 = Option.isSome(tree.getElement("s1"))
  const hasS2 = Option.isSome(tree.getElement("s2"))
  check("Multi-root: s1 present", hasS1)
  if (hasS2) {
    check("Multi-root: s2 ALSO present (both roots merged)", true)
  } else {
    warn("Multi-root: only first object extracted, s2 lost")
  }
} catch (e: any) {
  check("Multi-root doesn't crash", false, String(e))
}

// =============================================================================
// Gap 4: Null/number/boolean children
// =============================================================================

stage("Gap 4: Non-object children in arrays")

const gap4_input = `{
  "type": "Page",
  "key": "p",
  "children": [
    { "type": "Card", "key": "c1", "props": { "title": "Valid" } },
    null,
    42,
    true,
    "orphan-string-ref",
    { "type": "Card", "key": "c2", "props": { "title": "Also Valid" } }
  ]
}`

try {
  const result = run(normalizeWithMeta(gap4_input))
  const tree = result.tree

  check("Junk children: tree builds successfully", tree.size >= 3)
  check("Junk children: c1 present", Option.isSome(tree.getElement("c1")))
  check("Junk children: c2 present", Option.isSome(tree.getElement("c2")))

  const root = Option.getOrThrow(tree.getElement("p"))
  // Should the root's children array include the junk entries?
  check("Junk children: root has 2+ valid children", root.children.length >= 2,
    `got ${root.children.length}: [${root.children.join(",")}]`)

  // After repair, orphan string ref should get a placeholder
  const repaired = run(repair(tree))
  if (root.children.includes("orphan-string-ref")) {
    const placeholder = repaired.tree.getElement("orphan-string-ref")
    check("Junk children: string ref → placeholder after repair",
      Option.isSome(placeholder))
  }
} catch (e: any) {
  check("Junk children doesn't crash", false, e.message ?? String(e))
}

// =============================================================================
// Gap 5: Unknown format
// =============================================================================

stage("Gap 5: Unrecognizable format → graceful error")

const gap5_inputs = [
  { label: "YAML-ish", input: `type: Page\nkey: p1\nchildren:\n  - type: Card` },
  { label: "XML", input: `<Page key="p1"><Card key="c1"/></Page>` },
  { label: "Plain text", input: `Build a dashboard with three cards and a header` },
  { label: "Empty object", input: `{}` },
  { label: "Number", input: `42` },
  { label: "Array of strings", input: `["Card", "Text", "Grid"]` },
]

for (const { label, input } of gap5_inputs) {
  const exit = runExit(normalize(input))
  if (Exit.isSuccess(exit)) {
    warn(`Unknown format "${label}" produced tree with ${exit.value.size} elements (unexpected success)`)
  } else {
    // Check both typed failure channel and defect channel
    const typedErr = getFailure(exit)
    const dieErr = Cause.dieOption(exit.cause).pipe(Option.getOrNull)
    const err = typedErr ?? dieErr
    const isNormErr = (err as any)?._tag === "NormalizeError"
    check(`Unknown format "${label}" → NormalizeError`, isNormErr,
      isNormErr ? undefined : `got: ${err?.constructor?.name ?? typeof err}`)
  }
}

// =============================================================================
// Gap 6: Deeply nested hybrid (3+ levels)
// =============================================================================

stage("Gap 6: Deeply nested hybrid format (3+ levels of sibling defs)")

const gap6_input = JSON.stringify({
  type: "Page",
  key: "deep-page",
  children: ["s1"],
  s1: {
    type: "Section",
    children: ["g1"],
    g1: {
      type: "Grid",
      props: { columns: 2 },
      children: ["c1", "c2"],
      c1: {
        type: "Card",
        children: ["m1"],
        m1: {
          type: "MetricCard",
          props: { label: "CPU", value: "42%" },
        },
      },
      c2: {
        type: "Card",
        children: ["t1"],
        t1: {
          type: "Text",
          props: { text: "hello from depth 4" },
        },
      },
    },
  },
})

try {
  const result = run(normalizeWithMeta(gap6_input))
  check("Deep hybrid: format detected", result.format === "hybrid")
  check("Deep hybrid: all 7 elements present", result.elementCount >= 7,
    `got ${result.elementCount}`)

  // Check depth 4 elements are reachable
  const m1 = result.tree.getElement("m1")
  const t1 = result.tree.getElement("t1")
  check("Deep hybrid: m1 at depth 4 present", Option.isSome(m1))
  check("Deep hybrid: t1 at depth 4 present", Option.isSome(t1))

  if (Option.isSome(m1)) {
    check("Deep hybrid: m1 parentKey is c1", m1.value.parentKey === "c1")
  }
  if (Option.isSome(t1)) {
    check("Deep hybrid: t1 props preserved", (t1.value.props as any).text === "hello from depth 4")
  }

  // Verify full chain: deep-page → s1 → g1 → c1 → m1
  const s1 = Option.getOrThrow(result.tree.getElement("s1"))
  check("Deep hybrid: s1 parent is deep-page", s1.parentKey === "deep-page")
  const g1 = Option.getOrThrow(result.tree.getElement("g1"))
  check("Deep hybrid: g1 parent is s1", g1.parentKey === "s1")
  const c1 = Option.getOrThrow(result.tree.getElement("c1"))
  check("Deep hybrid: c1 parent is g1", c1.parentKey === "g1")
} catch (e: any) {
  check("Deep hybrid doesn't crash", false, e.message ?? String(e))
}

// =============================================================================
// Gap 7: Real LLM call with URL-heavy prompt
// =============================================================================

stage("Gap 7: Real LLM → normalize → repair (URL-heavy)")

const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) {
  warn("OPENAI_API_KEY not set — skipping live LLM test")
} else {
  const catalog: DomainCatalog = {
    components: {
      Page: { description: "Root page", props: "title: string", hasChildren: true, renderer: () => null, defaultEntrance: { type: "fade", duration: 300 } },
      LinkCard: { description: "Card with a URL link", props: "title: string, url: string, description?: string", hasChildren: false, renderer: () => null, defaultEntrance: { type: "scale", duration: 200 } },
      Section: { description: "Section container", props: "title: string", hasChildren: true, renderer: () => null, defaultEntrance: { type: "fade", duration: 200 } },
    },
  }

  const layer = createCatalogLayer(catalog)
  const sysPrompt = Effect.runSync(getSystemPrompt.pipe(Effect.provide(layer)))

  const userPrompt = `Generate a Page with 2 Sections. Section 1 has 2 LinkCards with real HTTPS URLs to documentation sites. Section 2 has 2 LinkCards with API endpoint URLs (https://api.example.com/v1/...).
Every LinkCard must have a "url" prop with a full HTTPS URL.
JSON structure: {"type":"...", "key":"...", "props":{...}, "children":[{...}]}
Every child must be a full nested object, NOT a string reference. Return ONLY JSON.`

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: `JSON only. No explanation.\n${sysPrompt}` },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 2000,
      }),
    })

    const data = (await resp.json()) as any
    const raw = data.choices[0].message.content as string
    console.log(`  📦 Raw response: ${raw.length} chars`)

    // Full pipeline: normalize → repair
    const result = run(normalizeWithMeta(raw))
    console.log(`  📐 Format: ${result.format}, ${result.elementCount} elements`)

    check("LLM response normalizes", result.elementCount >= 5, `got ${result.elementCount}`)

    const repairResult = run(repair(result.tree))
    check("LLM response repairs cleanly", repairResult.repairs.length === 0,
      repairResult.repairs.length > 0
        ? `${repairResult.repairs.length} repairs: ${repairResult.repairs.map(r => r.action).join(", ")}`
        : undefined)

    // Check URLs survived
    let urlCount = 0
    for (const [key, el] of repairResult.tree.elements) {
      const url = (el.props as any).url
      if (typeof url === "string" && url.startsWith("https://")) {
        urlCount++
        check(`URL preserved in ${key}: ${url.slice(0, 50)}...`, true)
      }
    }
    check("At least 4 URL props found", urlCount >= 4, `found ${urlCount}`)
  } catch (e: any) {
    check("LLM → normalize → repair doesn't crash", false, e.message ?? String(e))
  }
}

// =============================================================================
// Summary
// =============================================================================

console.log(`\n\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`)
console.log(`  \x1b[32m${passed} passed\x1b[0m  \x1b[31m${failed} failed\x1b[0m  \x1b[33m${warned} warned\x1b[0m`)
console.log(`\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`)

if (failed > 0) process.exit(1)
