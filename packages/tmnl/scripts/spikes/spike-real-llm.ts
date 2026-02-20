#!/usr/bin/env bun
/**
 * Spike: Genifer REAL E2E — Live LLM → Streaming Parse → UITree
 *
 * Sends the genifer-compiled prompt to a real OpenAI model (gpt-4o-mini),
 * streams the response token-by-token through the genifer pipeline:
 *   1. CatalogService → system prompt
 *   2. PromptTemplate → compile user query
 *   3. OpenAI streaming API (SSE)
 *   4. Each SSE delta → graph.sendChunk() → tokenizer → d2ts → callbacks
 *   5. Accumulate full JSON → parse → build UITree
 *   6. Cache the result
 *
 * Run: OPENAI_API_KEY=sk-... bun run scripts/spikes/spike-real-llm.ts
 */

import { Effect, Option } from "effect"
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
} from "../../src/lib/genifer/streaming/graph"
import { TreeCache, generateCacheKey } from "../../src/lib/genifer/react/tree-cache"

// ─────────────────────────────────────────────────────────────
const OK = "\x1b[32m✅\x1b[0m"
const FAIL = "\x1b[31m❌\x1b[0m"
const DIM = "\x1b[2m"
const RESET = "\x1b[0m"
const CYAN = "\x1b[36m"
const YELLOW = "\x1b[33m"
const SECTION = (s: string) => console.log(`\n${CYAN}━━━ ${s} ━━━${RESET}`)
let pass = 0, fail = 0
function check(label: string, condition: boolean) {
  if (condition) { console.log(`  ${OK} ${label}`); pass++ }
  else { console.log(`  ${FAIL} ${label}`); fail++ }
}

// ─────────────────────────────────────────────────────────────
// Pre-flight
// ─────────────────────────────────────────────────────────────

const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) {
  console.error("❌ OPENAI_API_KEY not set. Export it and re-run.")
  process.exit(1)
}

const MODEL = process.env.GENIFER_MODEL ?? "gpt-4o-mini"
console.log(`${CYAN}Genifer Real E2E Spike${RESET}`)
console.log(`${DIM}Model: ${MODEL}${RESET}`)

// ─────────────────────────────────────────────────────────────
// Stage 1: Catalog → System Prompt
// ─────────────────────────────────────────────────────────────

SECTION("Stage 1: Catalog → System Prompt")

const catalog: DomainCatalog = {
  components: {
    Card: {
      description: "A container card with title, optional subtitle. Can hold children.",
      props: 'title: string, subtitle?: string, variant?: "default" | "outline"',
      hasChildren: true,
      renderer: () => null,
      defaultEntrance: { type: "fade", duration: 300 },
    },
    MetricCard: {
      description: "Displays a single KPI metric with label, value, optional trend indicator",
      props: 'label: string, value: string, trend?: "up" | "down" | "flat", color?: string',
      hasChildren: false,
      renderer: () => null,
      defaultEntrance: { type: "scale", duration: 200 },
    },
    Text: {
      description: "A text paragraph",
      props: "text: string, className?: string",
      hasChildren: false,
      renderer: () => null,
      defaultEntrance: { type: "fade", duration: 150 },
    },
    Badge: {
      description: "A small colored label/tag",
      props: 'text: string, variant?: "default" | "success" | "warning" | "error"',
      hasChildren: false,
      renderer: () => null,
      defaultEntrance: { type: "fade", duration: 100 },
    },
    Heading: {
      description: "Section heading",
      props: 'text: string, level?: 1 | 2 | 3',
      hasChildren: false,
      renderer: () => null,
      defaultEntrance: { type: "fade", duration: 200 },
    },
  },
}

const layer = createCatalogLayer(catalog)
const systemPrompt = Effect.runSync(getSystemPrompt.pipe(Effect.provide(layer)))
check("System prompt generated", systemPrompt.length > 100)
console.log(`  📋 ${systemPrompt.length} chars`)

// ─────────────────────────────────────────────────────────────
// Stage 2: Compile Prompt
// ─────────────────────────────────────────────────────────────

SECTION("Stage 2: Prompt Template → Compile")

const tmpl = new PromptTemplate({
  name: "ui-builder",
  template: `You are a UI generation engine. You MUST respond with ONLY a valid JSON object, no markdown, no explanation.

The JSON must follow this exact structure:
{
  "type": "<ComponentType>",
  "key": "<unique-id>",
  "props": { ... },
  "children": [ ... nested components ... ]
}

Available components:
{{catalog}}

User request: {{query}}

Rules:
- Use ONLY the components listed above
- Every node MUST have "type", "key", and "props"
- Nest children inside "children" arrays
- Return a single root component (usually Card)
- Generate {{count}} leaf components minimum
- Respond with ONLY the JSON object — no prose, no code fences`,
  slots: [
    new PromptSlot({ name: "catalog", type: "catalog", required: false }),
    new PromptSlot({ name: "query", type: "string", required: true }),
    new PromptSlot({ name: "count", type: "number", required: true, defaultValue: 4 }),
  ],
})

const userQuery = "a project status dashboard showing build health, test coverage, deploy status, and open issues"
const compiled = tmpl.compile({ query: userQuery, count: 4 }, systemPrompt)
check("Prompt compiled", compiled.length > 200)
console.log(`  📝 ${compiled.length} chars`)

// ─────────────────────────────────────────────────────────────
// Stage 3: Call OpenAI (streaming SSE)
// ─────────────────────────────────────────────────────────────

SECTION("Stage 3: OpenAI Streaming Call")

const identified: ComponentIdentification[] = []
const errors: string[] = []
let fullJson = ""
let chunkCount = 0

const graph = createStreamingGraph({
  onComponentIdentified: (id) => {
    identified.push(id)
    console.log(`  ${YELLOW}⚡ Identified: ${id.componentType}${id.elementKey ? ` (key=${id.elementKey})` : ""}${RESET}`)
  },
  onToken: () => {},
})

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
      { role: "system", content: "You are a JSON-only UI generation engine. Respond with valid JSON only." },
      { role: "user", content: compiled },
    ],
    stream: true,
    temperature: 0.3,
    max_tokens: 2000,
  }),
})

if (!response.ok) {
  const errorBody = await response.text()
  console.error(`❌ OpenAI API error ${response.status}: ${errorBody}`)
  process.exit(1)
}

check("API response OK", response.status === 200)

// Read SSE stream
const reader = response.body!.getReader()
const decoder = new TextDecoder()
let sseBuffer = ""

while (true) {
  const { done, value } = await reader.read()
  if (done) break

  sseBuffer += decoder.decode(value, { stream: true })

  // Parse SSE events
  const lines = sseBuffer.split("\n")
  sseBuffer = lines.pop() ?? "" // keep incomplete line

  for (const line of lines) {
    if (!line.startsWith("data: ")) continue
    const data = line.slice(6).trim()
    if (data === "[DONE]") continue

    try {
      const parsed = JSON.parse(data)
      const delta = parsed.choices?.[0]?.delta?.content
      if (delta) {
        chunkCount++
        fullJson += delta
        // Feed EACH delta through genifer's streaming pipeline
        graph.sendChunk(delta)
      }
    } catch {
      // Malformed SSE line — skip
    }
  }
}

graph.flush()
const elapsed = (performance.now() - t0).toFixed(0)

check(`Received ${chunkCount} SSE chunks`, chunkCount > 5)
check(`Identified ${identified.length} components`, identified.length >= 1)
console.log(`  ⏱️  ${elapsed}ms total, ${chunkCount} chunks`)
console.log(`  📦 Raw JSON length: ${fullJson.length} chars`)

// Print what the model returned
console.log(`\n${DIM}─── Raw LLM Output (first 500 chars) ───${RESET}`)
console.log(`${DIM}${fullJson.slice(0, 500)}${RESET}`)
if (fullJson.length > 500) console.log(`${DIM}... (${fullJson.length - 500} more chars)${RESET}`)

// ─────────────────────────────────────────────────────────────
// Stage 4: Parse → UITree
// ─────────────────────────────────────────────────────────────

SECTION("Stage 4: Parse LLM JSON → UITree")

// Strip any markdown fences the model might have added
let cleanJson = fullJson.trim()
if (cleanJson.startsWith("```")) {
  cleanJson = cleanJson.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
}

let parsed: any
try {
  parsed = JSON.parse(cleanJson)
  check("JSON parses cleanly", true)
} catch (e) {
  check(`JSON parses cleanly (${(e as Error).message})`, false)
  console.log(`\n${DIM}Full output:${RESET}\n${fullJson}`)
  process.exit(1)
}

// Build UITree — handles both nested and flat formats
function buildTree(json: any): UITree {
  // Format B: flat { root, elements }
  if (json.root && json.elements && typeof json.elements === "object" && !json.type) {
    const record: Record<string, UIElement> = {}
    for (const [key, val] of Object.entries<any>(json.elements)) {
      record[key] = new UIElement({
        key, type: val.type ?? "Unknown", props: val.props ?? {},
        children: val.children?.length ? val.children : undefined,
      })
    }
    for (const [key, val] of Object.entries<any>(json.elements)) {
      if (val.children) {
        for (const ck of val.children) {
          if (record[ck]) record[ck] = new UIElement({ ...record[ck], parentKey: key })
        }
      }
    }
    return UITree.fromRecord(json.root, record)
  }

  // Format A: nested { type, key, props, children: [...] }
  let tree = UITree.empty().setRoot(json.key ?? "root")
  let autoId = 0
  const keyMap = new Map<number, string>()
  let objId = 0
  const idMap = new WeakMap<object, number>()
  function getObjId(n: any): number {
    if (typeof n !== "object" || n === null) return -1
    const e = idMap.get(n); if (e !== undefined) return e
    const id = objId++; idMap.set(n, id); return id
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
    const childKeys: string[] = (node.children ?? []).map((c: any) => ensureKey(c))
    tree = tree.setElement(key, new UIElement({
      key, type: node.type ?? "Unknown", props: node.props ?? {},
      children: childKeys.length ? childKeys : undefined, parentKey: parent,
    }))
    if (node.children) for (const child of node.children) addNode(child, key)
  }
  addNode(json)
  return tree
}

const uiTree = buildTree(parsed)
check(`Tree built: root="${uiTree.root}"`, uiTree.root !== undefined)
check(`Tree has ${uiTree.size} elements`, uiTree.size >= 2)

// Verify streaming-identified components match parsed tree
const treeTypes = new Set<string>()
for (const [_, el] of uiTree.elements) {
  treeTypes.add(el.type)
}
const streamTypes = new Set(identified.map((c) => c.componentType))

console.log(`  🌳 Tree types: ${[...treeTypes].join(", ")}`)
console.log(`  ⚡ Stream-identified types: ${[...streamTypes].join(", ")}`)

// Every stream-identified type should appear in the tree
for (const st of streamTypes) {
  check(`Stream type "${st}" in tree`, treeTypes.has(st))
}

// ─────────────────────────────────────────────────────────────
// Stage 5: Cache
// ─────────────────────────────────────────────────────────────

SECTION("Stage 5: Cache the result")

const cache = new TreeCache({ maxEntries: 50, ttlMs: 300_000 })
const cacheKey = generateCacheKey(userQuery, MODEL)

cache.set(cacheKey, uiTree)
const cached = cache.get(cacheKey)
check("Cache hit", cached !== undefined)
check("Cached tree matches", cached?.root === uiTree.root && cached?.size === uiTree.size)
console.log(`  📊 Cache stats: ${JSON.stringify(cache.stats)}`)

// ─────────────────────────────────────────────────────────────
// Stage 6: Print the tree
// ─────────────────────────────────────────────────────────────

SECTION("UITree Visualization")

function printTree(tree: UITree, key: string, indent = 0) {
  const el = Option.getOrUndefined(tree.getElement(key))
  if (!el) return
  const pad = "  ".repeat(indent)
  const propsStr = Object.entries(el.props)
    .filter(([_, v]) => typeof v === "string" || typeof v === "number")
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(" ")
  console.log(`${pad}${CYAN}<${el.type}${RESET} key="${el.key}" ${DIM}${propsStr}${RESET}${CYAN}>${RESET}`)
  if (el.children) {
    for (const childKey of el.children) {
      printTree(tree, childKey, indent + 1)
    }
  }
}

printTree(uiTree, uiTree.root)

// ─────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────

SECTION("SUMMARY")
console.log(`  ${pass} passed, ${fail} failed`)
console.log(`  Model: ${MODEL}`)
console.log(`  Latency: ${elapsed}ms`)
console.log(`  SSE chunks: ${chunkCount}`)
console.log(`  Components identified (streaming): ${identified.length}`)
console.log(`  UITree size: ${uiTree.size} elements`)

if (fail > 0) {
  process.exit(1)
} else {
  console.log(`\n  ${OK} ${CYAN}Genifer E2E with live LLM — all checks passed!${RESET}\n`)
}
