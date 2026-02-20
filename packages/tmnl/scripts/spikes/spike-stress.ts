#!/usr/bin/env bun
/**
 * Spike: Genifer STRESS TEST — Deep Nesting, BFTA, Edge Cases, Multi-Turn
 *
 * Pushes the full pipeline hard:
 *   1. Complex catalog with parent→child constraints (BFTA grammar)
 *   2. Prompt that demands deep nesting (3-4 levels)
 *   3. BFTA validation during streaming (grammar enforcement)
 *   4. Multi-turn: first response → follow-up → second response
 *   5. Malformed JSON recovery (markdown fences, trailing comma)
 *   6. Unknown component types (model invents something)
 *   7. Large tree validation (10+ components)
 *   8. Thread accumulation across turns
 *   9. Cache hit on repeated prompt
 *
 * Run: OPENAI_API_KEY=sk-... bun run scripts/spikes/spike-stress.ts
 */

import { Effect, Option, List } from "effect"
import { UIElement, UITree } from "../../src/lib/genifer/core/schemas"
import {
  createCatalogLayer,
  getSystemPrompt,
  type DomainCatalog,
} from "../../src/lib/genifer/core/CatalogService"
import { PromptTemplate, PromptSlot } from "../../src/lib/genifer/core/prompts"
import {
  createStreamingGraph,
  type ComponentIdentification,
  type StreamingGraphOptions,
} from "../../src/lib/genifer/streaming/graph"
import type { ComponentRegistration, ValidationResult } from "../../src/lib/genifer/streaming/bfta"
import { TreeCache, generateCacheKey } from "../../src/lib/genifer/react/tree-cache"
import { Thread, ThreadMessage } from "../../src/lib/genifer/core/threads"

// ─────────────────────────────────────────────────────────────
const OK = "\x1b[32m✅\x1b[0m"
const FAIL = "\x1b[31m❌\x1b[0m"
const WARN = "\x1b[33m⚠️\x1b[0m"
const DIM = "\x1b[2m"
const RESET = "\x1b[0m"
const CYAN = "\x1b[36m"
const YELLOW = "\x1b[33m"
const GREEN = "\x1b[32m"
const RED = "\x1b[31m"
const SECTION = (s: string) => console.log(`\n${CYAN}━━━ ${s} ━━━${RESET}`)
let pass = 0, fail = 0, warn = 0
function check(label: string, condition: boolean) {
  if (condition) { console.log(`  ${OK} ${label}`); pass++ }
  else { console.log(`  ${FAIL} ${label}`); fail++ }
}
function softCheck(label: string, condition: boolean) {
  if (condition) { console.log(`  ${OK} ${label}`); pass++ }
  else { console.log(`  ${WARN} ${label} (soft fail)`); warn++ }
}

const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) { console.error("❌ OPENAI_API_KEY not set."); process.exit(1) }

const MODEL = process.env.GENIFER_MODEL ?? "gpt-4o-mini"
console.log(`${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`)
console.log(`${CYAN}  Genifer Stress Test — ${MODEL}${RESET}`)
console.log(`${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`)

// ─────────────────────────────────────────────────────────────
// Catalog with BFTA constraints
// ─────────────────────────────────────────────────────────────

SECTION("Stage 1: Constrained Catalog + BFTA Grammar")

const catalog: DomainCatalog = {
  components: {
    Page: {
      description: "Top-level page container. Children: Section, Card, Alert",
      props: "title: string",
      hasChildren: true,
      renderer: () => null,
      defaultEntrance: { type: "fade", duration: 300 },
    },
    Section: {
      description: "A titled section within a page. Children: Card, Grid, Text, Heading",
      props: 'title: string, collapsible?: boolean',
      hasChildren: true,
      renderer: () => null,
      defaultEntrance: { type: "fade", duration: 250 },
    },
    Grid: {
      description: "A responsive grid layout. Children: Card, MetricCard, Badge",
      props: "columns: number",
      hasChildren: true,
      renderer: () => null,
      defaultEntrance: { type: "fade", duration: 200 },
    },
    Card: {
      description: "Content card with optional header. Children: Text, Heading, Badge, MetricCard, ProgressBar, List",
      props: 'title?: string, subtitle?: string, variant?: "default" | "outline" | "elevated"',
      hasChildren: true,
      renderer: () => null,
      defaultEntrance: { type: "scale", duration: 200 },
    },
    MetricCard: {
      description: "KPI metric display. Leaf node — no children.",
      props: 'label: string, value: string, unit?: string, trend?: "up" | "down" | "flat", color?: string, sparkline?: number[]',
      hasChildren: false,
      renderer: () => null,
      defaultEntrance: { type: "scale", duration: 150 },
    },
    Text: {
      description: "A text block. Leaf node.",
      props: "text: string, className?: string",
      hasChildren: false,
      renderer: () => null,
      defaultEntrance: { type: "fade", duration: 100 },
    },
    Heading: {
      description: "Section heading. Leaf node.",
      props: "text: string, level?: 1 | 2 | 3",
      hasChildren: false,
      renderer: () => null,
      defaultEntrance: { type: "fade", duration: 100 },
    },
    Badge: {
      description: "Small colored tag. Leaf node.",
      props: 'text: string, variant?: "default" | "success" | "warning" | "error" | "info"',
      hasChildren: false,
      renderer: () => null,
      defaultEntrance: { type: "fade", duration: 80 },
    },
    ProgressBar: {
      description: "A horizontal progress indicator. Leaf node.",
      props: "value: number, max?: number, label?: string, color?: string",
      hasChildren: false,
      renderer: () => null,
      defaultEntrance: { type: "fade", duration: 150 },
    },
    Alert: {
      description: "An alert banner with icon. Children: Text only.",
      props: 'severity: "info" | "warning" | "error" | "success", title?: string',
      hasChildren: true,
      renderer: () => null,
      defaultEntrance: { type: "slide", duration: 200 },
    },
    List: {
      description: "An ordered or unordered list. Children: ListItem only.",
      props: 'ordered?: boolean, title?: string',
      hasChildren: true,
      renderer: () => null,
      defaultEntrance: { type: "fade", duration: 150 },
    },
    ListItem: {
      description: "A single list item. Leaf node.",
      props: "text: string",
      hasChildren: false,
      renderer: () => null,
      defaultEntrance: { type: "fade", duration: 80 },
    },
  },
}

// BFTA constraint registrations
const registrations: ComponentRegistration[] = [
  { type: "Page", hasChildren: true, allowedChildren: ["Section", "Card", "Alert"], requiresChildren: true },
  { type: "Section", hasChildren: true, allowedChildren: ["Card", "Grid", "Text", "Heading"] },
  { type: "Grid", hasChildren: true, allowedChildren: ["Card", "MetricCard", "Badge"], requiresChildren: true },
  { type: "Card", hasChildren: true, allowedChildren: ["Text", "Heading", "Badge", "MetricCard", "ProgressBar", "List"] },
  { type: "MetricCard", hasChildren: false },
  { type: "Text", hasChildren: false },
  { type: "Heading", hasChildren: false },
  { type: "Badge", hasChildren: false },
  { type: "ProgressBar", hasChildren: false },
  { type: "Alert", hasChildren: true, allowedChildren: ["Text"] },
  { type: "List", hasChildren: true, allowedChildren: ["ListItem"], requiresChildren: true },
  { type: "ListItem", hasChildren: false },
]

const layer = createCatalogLayer(catalog)
const systemPrompt = Effect.runSync(getSystemPrompt.pipe(Effect.provide(layer)))
check("System prompt generated", systemPrompt.length > 200)
check("12 component types in catalog", Object.keys(catalog.components).length === 12)
console.log(`  📋 ${systemPrompt.length} chars, ${registrations.length} BFTA rules`)

// ─────────────────────────────────────────────────────────────
// Prompt: demand deep nesting + many components
// ─────────────────────────────────────────────────────────────

SECTION("Stage 2: Complex Prompt — Deep Nesting")

const tmpl = new PromptTemplate({
  name: "complex-dashboard",
  template: `You are a UI generation engine. You MUST respond with ONLY a valid JSON object. No markdown fences. No explanation.

JSON structure:
{
  "type": "<ComponentType>",
  "key": "<unique-kebab-id>",
  "props": { ... },
  "children": [ ... ]
}

Available components and their constraints:
{{catalog}}

CRITICAL RULES:
- The root component MUST be "Page"
- Use nested Sections and Grids for layout (at least 2 Sections)
- Include at least {{count}} leaf components (MetricCard, Text, Badge, ProgressBar, etc.)
- Nest at least 3 levels deep: Page → Section → Grid/Card → leaf components
- Every node MUST have "type", "key" (unique kebab-case), and "props"
- Return ONLY the JSON object

User request: {{query}}`,
  slots: [
    new PromptSlot({ name: "catalog", type: "catalog", required: false }),
    new PromptSlot({ name: "query", type: "string", required: true }),
    new PromptSlot({ name: "count", type: "number", required: true, defaultValue: 10 }),
  ],
})

const query1 = "A comprehensive DevOps command center with: (1) a build pipeline section showing CI status for 3 services with pass rates and last build times, (2) an infrastructure section with CPU, memory, disk, network metrics for production and staging, (3) an incidents section with active alerts and a recent incidents list"
const compiled1 = tmpl.compile({ query: query1, count: 12 }, systemPrompt)
check("Prompt compiled", compiled1.length > 500)
console.log(`  📝 ${compiled1.length} chars`)

// ─────────────────────────────────────────────────────────────
// Turn 1: Call LLM with BFTA validation
// ─────────────────────────────────────────────────────────────

SECTION("Stage 3: Turn 1 — LLM Streaming + BFTA Validation")

async function callLLM(prompt: string, sysMsg: string): Promise<{
  fullJson: string
  chunks: number
  identified: ComponentIdentification[]
  validations: ValidationResult[]
  unknowns: string[]
  elapsed: number
}> {
  const identified: ComponentIdentification[] = []
  const validations: ValidationResult[] = []
  const unknowns: string[] = []

  const graphOptions: StreamingGraphOptions = {
    callbacks: {
      onComponentIdentified: (id) => {
        identified.push(id)
        process.stdout.write(`  ${YELLOW}⚡ ${id.componentType}${RESET} `)
      },
      onValidation: (result) => {
        validations.push(result)
        const icon = result.accepted ? GREEN + "✓" : RED + "✗"
        process.stdout.write(`${icon}${RESET} `)
      },
      onUnknownType: (type, depth) => {
        unknowns.push(type)
        process.stdout.write(`${RED}?${type}${RESET} `)
      },
    },
    registrations,
  }

  const graph = createStreamingGraph(graphOptions)
  let fullJson = ""
  let chunkCount = 0
  const t0 = performance.now()

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: sysMsg },
        { role: "user", content: prompt },
      ],
      stream: true,
      temperature: 0.4,
      max_tokens: 4000,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI ${response.status}: ${err}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split("\n")
    buf = lines.pop() ?? ""
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue
      const data = line.slice(6).trim()
      if (data === "[DONE]") continue
      try {
        const p = JSON.parse(data)
        const delta = p.choices?.[0]?.delta?.content
        if (delta) {
          chunkCount++
          fullJson += delta
          graph.sendChunk(delta)
        }
      } catch {}
    }
  }
  graph.flush()
  console.log() // newline after inline output

  return {
    fullJson,
    chunks: chunkCount,
    identified,
    validations,
    unknowns,
    elapsed: performance.now() - t0,
  }
}

const turn1 = await callLLM(
  compiled1,
  "You are a JSON-only UI generation engine. Respond with ONLY valid JSON. No markdown. No explanation.",
)

check(`Turn 1: ${turn1.chunks} SSE chunks`, turn1.chunks > 20)
check(`Turn 1: ${turn1.identified.length} components identified`, turn1.identified.length >= 5)
check(`Turn 1: BFTA ran ${turn1.validations.length} validations`, turn1.validations.length >= 1)

const bftaAccepted = turn1.validations.filter(v => v.accepted).length
const bftaRejected = turn1.validations.filter(v => !v.accepted).length
console.log(`  🔬 BFTA: ${bftaAccepted} accepted, ${bftaRejected} rejected, ${turn1.unknowns.length} unknown types`)
console.log(`  ⏱️  ${turn1.elapsed.toFixed(0)}ms, ${turn1.fullJson.length} chars`)

// ─────────────────────────────────────────────────────────────
// Parse + Build UITree from turn 1
// ─────────────────────────────────────────────────────────────

SECTION("Stage 4: Parse Turn 1 → UITree")

function cleanAndParse(raw: string): any {
  let clean = raw.trim()
  // Strip markdown fences
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?\s*```\s*$/, "")
  }
  // Strip trailing commas before } or ]
  clean = clean.replace(/,(\s*[}\]])/g, "$1")
  return JSON.parse(clean)
}

/**
 * Build UITree from LLM output.
 * Handles THREE formats models produce:
 *   A) Nested:   { type, key, props, children: [{type,key,...}, ...] }
 *   B) Flat:     { root: "key", elements: { key: { type, props, children: ["key"] } } }
 *   C) Hybrid:   { type, key, props, children: ["key1","key2"], key1: {...}, key2: {...} }
 *                (root has type+children as string refs, sibling keys hold definitions)
 */
function buildTree(json: any): UITree {
  // ── Format B: flat { root, elements } ──
  if (json.root && json.elements && typeof json.elements === "object" && !json.type) {
    return buildFromFlat(json.root, json.elements)
  }

  // Check children format
  const firstChild = json.children?.[0]
  const childrenAreStrings = typeof firstChild === "string"
  const childrenAreObjects = typeof firstChild === "object" && firstChild !== null

  // ── Format C: Hybrid (type at root, children are string keys, defs as siblings) ──
  if (json.type && childrenAreStrings) {
    // Collect all element definitions from the root object
    const elements: Record<string, any> = {}
    const metaKeys = new Set(["type", "key", "props", "children"])
    // Root element
    const rootKey = json.key ?? "root"
    elements[rootKey] = { type: json.type, props: json.props ?? {}, children: json.children }
    // Sibling definitions (any non-meta key that holds an object with type)
    for (const [k, v] of Object.entries<any>(json)) {
      if (metaKeys.has(k)) continue
      if (typeof v === "object" && v !== null && v.type) {
        elements[k] = v
        // Recursively collect nested sibling defs
        collectSiblingDefs(v, elements)
      }
    }
    return buildFromFlat(rootKey, elements)
  }

  // ── Format A: Nested { type, key, children: [{...}] } ──
  const rootKey = json.key ?? "root"
  let tree = UITree.empty().setRoot(rootKey)
  let autoId = 0
  const keyMap = new Map<number, string>()
  let oidCounter = 0
  const idMap = new WeakMap<object, number>()
  function getObjId(n: any): number {
    if (typeof n !== "object" || n === null) return -1
    const e = idMap.get(n); if (e !== undefined) return e
    const id = oidCounter++; idMap.set(n, id); return id
  }
  function ensureKey(node: any): string {
    if (typeof node === "string") return node
    if (node.key) return node.key
    const oid = getObjId(node)
    const existing = keyMap.get(oid)
    if (existing) return existing
    const k = `gen-${autoId++}`
    keyMap.set(oid, k)
    return k
  }
  function addNode(node: any, parent?: string) {
    if (typeof node !== "object" || node === null) return
    const key = ensureKey(node)
    const rawChildren = node.children ?? []
    const childKeys: string[] = rawChildren.map((c: any) => ensureKey(c))
    tree = tree.setElement(key, new UIElement({
      key, type: node.type ?? "Unknown", props: node.props ?? {},
      children: childKeys.length ? childKeys : undefined, parentKey: parent,
    }))
    for (const child of rawChildren) {
      if (typeof child === "object" && child !== null) addNode(child, key)
    }
  }
  addNode(json)
  return tree
}

/** Recursively collect sibling definitions from a hybrid-format object */
function collectSiblingDefs(obj: any, acc: Record<string, any>) {
  const metaKeys = new Set(["type", "key", "props", "children"])
  for (const [k, v] of Object.entries<any>(obj)) {
    if (metaKeys.has(k)) continue
    if (typeof v === "object" && v !== null && v.type && !acc[k]) {
      acc[k] = v
      collectSiblingDefs(v, acc)
    }
  }
  // Also walk string children to see if they reference sibling keys
  if (obj.children) {
    for (const ck of obj.children) {
      if (typeof ck === "string" && obj[ck] && typeof obj[ck] === "object") {
        if (!acc[ck]) {
          acc[ck] = obj[ck]
          collectSiblingDefs(obj[ck], acc)
        }
      }
    }
  }
}

/** Build UITree from flat { key: { type, props, children: ["key"] } } format */
function buildFromFlat(rootKey: string, elements: Record<string, any>): UITree {
  const record: Record<string, UIElement> = {}
  for (const [key, val] of Object.entries<any>(elements)) {
    const childArr = Array.isArray(val.children) ? val.children.filter((c: any) => typeof c === "string") : undefined
    record[key] = new UIElement({
      key, type: val.type ?? "Unknown", props: val.props ?? {},
      children: childArr?.length ? childArr : undefined,
    })
  }
  // Fill parentKey
  for (const [key, val] of Object.entries<any>(elements)) {
    if (Array.isArray(val.children)) {
      for (const ck of val.children) {
        if (typeof ck === "string" && record[ck]) {
          record[ck] = new UIElement({ ...record[ck], parentKey: key })
        }
      }
    }
  }
  return UITree.fromRecord(rootKey, record)
}

let parsed1: any
try {
  parsed1 = cleanAndParse(turn1.fullJson)
  check("JSON parses cleanly", true)
  // Detect format
  const isFlat = parsed1.root && parsed1.elements && !parsed1.type
  const isNested = !!parsed1.type
  console.log(`  📐 Format: ${isFlat ? "FLAT {root,elements}" : isNested ? "NESTED {type,children}" : "UNKNOWN"}`)
  if (isFlat) console.log(`     root="${parsed1.root}", ${Object.keys(parsed1.elements).length} elements`)
  if (isNested) {
    console.log(`     type="${parsed1.type}", key="${parsed1.key}"`)
    console.log(`     children type: ${typeof parsed1.children?.[0]}, count: ${parsed1.children?.length ?? 0}`)
    if (parsed1.children?.[0]) console.log(`     child[0]: ${JSON.stringify(parsed1.children[0]).slice(0, 120)}`)
  }
} catch (e) {
  check(`JSON parses (${(e as Error).message})`, false)
  console.log(`\n${DIM}Raw:${RESET}\n${turn1.fullJson.slice(0, 300)}...`)
  // Try to recover — maybe there's prose around the JSON
  const jsonMatch = turn1.fullJson.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      parsed1 = cleanAndParse(jsonMatch[0])
      console.log(`  ${WARN} Recovered JSON from prose wrapper`)
    } catch {
      console.error("  ❌ Unrecoverable JSON. Aborting.")
      process.exit(1)
    }
  } else {
    process.exit(1)
  }
}

const tree1 = buildTree(parsed1)
check(`Root type is Page`, parsed1.type === "Page")
check(`Tree has ${tree1.size} elements (≥10)`, tree1.size >= 10)

// Measure depth
function maxDepth(tree: UITree, key: string, d = 0): number {
  const el = Option.getOrUndefined(tree.getElement(key))
  if (!el || !el.children?.length) return d
  return Math.max(...el.children.map(ck => maxDepth(tree, ck, d + 1)))
}
const depth = maxDepth(tree1, tree1.root)
check(`Nesting depth ${depth} (≥3)`, depth >= 3)

// Type census
const typeCensus: Record<string, number> = {}
for (const [_, el] of tree1.elements) {
  typeCensus[el.type] = (typeCensus[el.type] ?? 0) + 1
}
console.log(`  🌳 ${tree1.size} elements, depth ${depth}`)
console.log(`  📊 Type census: ${Object.entries(typeCensus).map(([t, n]) => `${t}×${n}`).join(", ")}`)

// Verify stream IDs match tree types
const streamTypes = new Set(turn1.identified.map(c => c.componentType))
const treeTypes = new Set(Object.keys(typeCensus))
for (const st of streamTypes) {
  softCheck(`Stream type "${st}" in tree`, treeTypes.has(st))
}

// ─────────────────────────────────────────────────────────────
// Visualize
// ─────────────────────────────────────────────────────────────

SECTION("UITree Visualization (Turn 1)")

function printTree(tree: UITree, key: string, indent = 0) {
  const el = Option.getOrUndefined(tree.getElement(key))
  if (!el) return
  const pad = "  ".repeat(indent)
  const propsStr = Object.entries(el.props)
    .filter(([_, v]) => typeof v === "string" || typeof v === "number")
    .slice(0, 3)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(" ")
  console.log(`${pad}${CYAN}<${el.type}${RESET} ${DIM}${propsStr}${RESET}${CYAN}>${RESET}`)
  if (el.children) {
    for (const ck of el.children) printTree(tree, ck, indent + 1)
  }
}
printTree(tree1, tree1.root)

// ─────────────────────────────────────────────────────────────
// Turn 2: Follow-up (multi-turn)
// ─────────────────────────────────────────────────────────────

SECTION("Stage 5: Turn 2 — Follow-Up Prompt")

const followUp = `The user wants to modify the dashboard. Add a new "Deployments" section after the infrastructure section.
It should contain a Card with a List of the 3 most recent deployments (each ListItem showing service name, version, and timestamp).
Also add a ProgressBar showing overall deployment pipeline progress at 73%.

Return the COMPLETE updated Page JSON with all original sections preserved plus the new one. ONLY JSON, no explanation.`

const compiled2 = `Previous UI structure (for reference):
${turn1.fullJson.slice(0, 1500)}${turn1.fullJson.length > 1500 ? "..." : ""}

${followUp}`

const turn2 = await callLLM(
  compiled2,
  "You are a JSON-only UI generation engine. You previously generated a dashboard. Now modify it per the user's request. Return ONLY valid JSON.",
)

check(`Turn 2: ${turn2.chunks} SSE chunks`, turn2.chunks > 20)
check(`Turn 2: ${turn2.identified.length} components`, turn2.identified.length >= 5)
console.log(`  ⏱️  ${turn2.elapsed.toFixed(0)}ms, ${turn2.fullJson.length} chars`)

let parsed2: any
let tree2: UITree
try {
  parsed2 = cleanAndParse(turn2.fullJson)
  tree2 = buildTree(parsed2)
  check("Turn 2 JSON parses", true)
  check(`Turn 2 tree: ${tree2.size} elements (≥ turn 1's ${tree1.size})`, tree2.size >= tree1.size)
  
  // Check for new content
  const hasDeployment = turn2.fullJson.toLowerCase().includes("deploy")
  const hasListItem = turn2.identified.some(c => c.componentType === "ListItem")
  const hasProgressBar = turn2.identified.some(c => c.componentType === "ProgressBar")
  softCheck("Turn 2 mentions deployment", hasDeployment)
  softCheck("Turn 2 has ListItem components", hasListItem)
  softCheck("Turn 2 has ProgressBar", hasProgressBar)
  
  const depth2 = maxDepth(tree2, tree2.root)
  console.log(`  🌳 Turn 2: ${tree2.size} elements, depth ${depth2}`)
} catch (e) {
  check(`Turn 2 parse (${(e as Error).message})`, false)
  tree2 = tree1 // fallback
}

// ─────────────────────────────────────────────────────────────
// Thread accumulation
// ─────────────────────────────────────────────────────────────

SECTION("Stage 6: Thread Accumulation")

const now = new Date().toISOString()
const mkMsg = (id: string, role: "user" | "assistant", text: string, model?: string) =>
  new ThreadMessage({ id, role, content: [{ _tag: "text" as const, text }], timestamp: now, model })

const thread = new Thread({
  id: "stress-thread",
  messages: List.empty(),
  title: "DevOps Command Center",
  createdAt: now,
  updatedAt: now,
})
  .appendMessage(mkMsg("u1", "user", query1))
  .appendMessage(mkMsg("a1", "assistant", `[UITree: ${tree1.size} elements]`, MODEL))
  .appendMessage(mkMsg("u2", "user", followUp))
  .appendMessage(mkMsg("a2", "assistant", `[UITree: ${tree2.size} elements]`, MODEL))

check(`Thread: ${thread.messageCount} messages`, thread.messageCount === 4)
check(`Thread: ${thread.turns.length} complete turns`, thread.turns.length === 2)
check("Turn 1 has assistant", thread.turns[0]?.assistantMessage !== undefined)
check("Turn 2 has assistant", thread.turns[1]?.assistantMessage !== undefined)

// ─────────────────────────────────────────────────────────────
// Cache: same prompt → instant hit
// ─────────────────────────────────────────────────────────────

SECTION("Stage 7: Cache — Repeated Prompt Hit")

const cache = new TreeCache({ maxEntries: 50, ttlMs: 300_000 })
const key1 = generateCacheKey(query1, MODEL)
const key2 = generateCacheKey(followUp, MODEL)

cache.set(key1, tree1)
cache.set(key2, tree2)

check("Cache turn 1 hit", cache.get(key1)?.size === tree1.size)
check("Cache turn 2 hit", cache.get(key2)?.size === tree2.size)
check("Different keys", key1 !== key2)
console.log(`  📊 ${JSON.stringify(cache.stats)}`)

// ─────────────────────────────────────────────────────────────
// Malformed JSON recovery test
// ─────────────────────────────────────────────────────────────

SECTION("Stage 8: Malformed JSON Recovery")

// Simulate models that wrap in fences
const fenced = '```json\n{"type":"Card","key":"x","props":{"title":"test"},"children":[]}\n```'
try {
  const p = cleanAndParse(fenced)
  check("Recovers from markdown fences", p.type === "Card")
} catch { check("Recovers from markdown fences", false) }

// Trailing comma
const trailingComma = '{"type":"Badge","key":"b","props":{"text":"hi",}}'
try {
  const p = cleanAndParse(trailingComma)
  check("Recovers from trailing comma", p.type === "Badge")
} catch { check("Recovers from trailing comma", false) }

// Prose wrapper
const proseWrapped = 'Here is the JSON:\n\n{"type":"Text","key":"t","props":{"text":"hello"}}\n\nHope that helps!'
const jsonMatch = proseWrapped.match(/\{[\s\S]*\}/)
if (jsonMatch) {
  try {
    const p = JSON.parse(jsonMatch[0])
    check("Extracts JSON from prose", p.type === "Text")
  } catch { check("Extracts JSON from prose", false) }
} else { check("Extracts JSON from prose", false) }

// ─────────────────────────────────────────────────────────────
// BFTA deep analysis
// ─────────────────────────────────────────────────────────────

SECTION("Stage 9: BFTA Analysis")

const allValidations = [...turn1.validations, ...turn2.validations]
const allUnknowns = [...turn1.unknowns, ...turn2.unknowns]
const accepted = allValidations.filter(v => v.accepted)
const rejected = allValidations.filter(v => !v.accepted)

console.log(`  Total validations: ${allValidations.length}`)
console.log(`  ${GREEN}Accepted: ${accepted.length}${RESET}`)
if (rejected.length > 0) {
  console.log(`  ${RED}Rejected: ${rejected.length}${RESET}`)
  for (const r of rejected) {
    console.log(`    ${RED}✗ ${r.componentType} (depth=${r.depth}): ${r.reason}${RESET}`)
  }
}
if (allUnknowns.length > 0) {
  console.log(`  ${YELLOW}Unknown types: ${[...new Set(allUnknowns)].join(", ")}${RESET}`)
}

softCheck("BFTA acceptance rate ≥ 80%", accepted.length / Math.max(allValidations.length, 1) >= 0.8)
softCheck("No unknown types", allUnknowns.length === 0)

// ─────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────

SECTION("FINAL SUMMARY")
const totalChecks = pass + fail
console.log(`  ${GREEN}${pass} passed${RESET}, ${fail > 0 ? RED : DIM}${fail} failed${RESET}, ${warn > 0 ? YELLOW : DIM}${warn} soft warnings${RESET}`)
console.log(`  Model: ${MODEL}`)
console.log(`  Turn 1: ${turn1.elapsed.toFixed(0)}ms, ${turn1.identified.length} components, ${tree1.size} tree nodes`)
console.log(`  Turn 2: ${turn2.elapsed.toFixed(0)}ms, ${turn2.identified.length} components, ${tree2.size} tree nodes`)
console.log(`  BFTA: ${accepted.length}/${allValidations.length} accepted`)
console.log(`  Thread: ${thread.messageCount} messages, ${thread.turns.length} turns`)
console.log(`  Cache: ${cache.stats.size} entries, ${cache.stats.hits} hits`)

if (fail > 0) {
  console.log(`\n  ${RED}Some hard checks failed — investigate above.${RESET}`)
  process.exit(1)
} else {
  console.log(`\n  ${OK} ${CYAN}Genifer stress test passed!${RESET}\n`)
}
