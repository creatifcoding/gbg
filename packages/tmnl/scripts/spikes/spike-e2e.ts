#!/usr/bin/env bun
/**
 * Spike: Genifer E2E Pipeline
 *
 * Full pipeline test — no React, no browser:
 *   1. Register catalog → generate system prompt
 *   2. Build prompt template → compile with user query
 *   3. Simulate LLM JSON response (chunked, like SSE)
 *   4. Stream through tokenizer → d2ts graph → component identification
 *   5. Build UITree from identified components
 *   6. Cache the tree → verify cache hit
 *   7. Exercise thread management (multi-turn conversation)
 *   8. Exercise tool calling (register → invoke → result)
 *
 * Run: bun run scripts/spikes/spike-e2e.ts
 */

import { Effect, Option, HashMap, List } from "effect"
import { UIElement, UITree } from "../../src/lib/genifer/core/schemas"
import {
  createCatalogLayer,
  getSystemPrompt,
  type DomainCatalog,
} from "../../src/lib/genifer/core/CatalogService"
import { PromptTemplate, PromptSlot } from "../../src/lib/genifer/core/prompts"
import { createStreamingGraph, type ComponentIdentification } from "../../src/lib/genifer/streaming/graph"
import { TreeCache, generateCacheKey } from "../../src/lib/genifer/react/tree-cache"
import { Thread, ThreadMessage } from "../../src/lib/genifer/core/threads"
import { GeniferToolDefinition, GeniferToolCall, GeniferToolResult } from "../../src/lib/genifer/core/tools"

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const OK = "\x1b[32m✅\x1b[0m"
const FAIL = "\x1b[31m❌\x1b[0m"
const SECTION = (s: string) => console.log(`\n\x1b[36m━━━ ${s} ━━━\x1b[0m`)
let pass = 0
let fail = 0

function check(label: string, condition: boolean) {
  if (condition) {
    console.log(`  ${OK} ${label}`)
    pass++
  } else {
    console.log(`  ${FAIL} ${label}`)
    fail++
  }
}

// ─────────────────────────────────────────────────────────────
// Stage 1: Catalog → System Prompt
// ─────────────────────────────────────────────────────────────

SECTION("Stage 1: Catalog Registration → System Prompt")

const catalog: DomainCatalog = {
  components: {
    Dashboard: {
      description: "A dashboard container with title and grid layout",
      props: "title: string, columns?: number",
      hasChildren: true,
      renderer: () => null,
      defaultEntrance: { type: "fade", duration: 300 },
    },
    MetricCard: {
      description: "Displays a single metric with label, value, and trend",
      props: "label: string, value: string, trend?: 'up' | 'down' | 'flat', color?: string",
      hasChildren: false,
      renderer: () => null,
      defaultEntrance: { type: "scale", duration: 200 },
    },
    StatusBadge: {
      description: "A colored badge showing operational status",
      props: "status: 'ok' | 'warning' | 'error', text: string",
      hasChildren: false,
      renderer: () => null,
      defaultEntrance: { type: "fade", duration: 150 },
    },
  },
}

const layer = createCatalogLayer(catalog)

const systemPrompt = Effect.runSync(
  getSystemPrompt.pipe(Effect.provide(layer))
)

check("System prompt generated", systemPrompt.length > 50)
check("Prompt mentions Dashboard", systemPrompt.includes("Dashboard"))
check("Prompt mentions MetricCard", systemPrompt.includes("MetricCard"))
check("Prompt mentions StatusBadge", systemPrompt.includes("StatusBadge"))
console.log(`  📋 Prompt length: ${systemPrompt.length} chars`)

// ─────────────────────────────────────────────────────────────
// Stage 2: Prompt Template → Compile
// ─────────────────────────────────────────────────────────────

SECTION("Stage 2: Prompt Template Compilation")

const tmpl = new PromptTemplate({
  name: "dashboard-builder",
  template: `You are a UI generation assistant.

{{catalog}}

The user wants: {{query}}

Respond with a JSON object containing a "type" field and nested children.
Use only the components listed above. Return {{count}} metric cards.`,
  slots: [
    new PromptSlot({ name: "catalog", type: "catalog", required: false }),
    new PromptSlot({ name: "query", type: "string", required: true }),
    new PromptSlot({ name: "count", type: "number", required: true, defaultValue: 3 }),
  ],
})

const compiled = tmpl.compile(
  { query: "a server monitoring dashboard with CPU, memory, and disk metrics" },
  systemPrompt,
)

check("Template compiled", compiled.length > 100)
check("Contains user query", compiled.includes("server monitoring dashboard"))
check("Contains catalog context", compiled.includes("Dashboard"))
check("Default count (3) applied", compiled.includes("3 metric cards"))
console.log(`  📝 Compiled prompt: ${compiled.length} chars`)

// ─────────────────────────────────────────────────────────────
// Stage 3: Simulate LLM JSON Response → Stream Parse
// ─────────────────────────────────────────────────────────────

SECTION("Stage 3: Streaming JSON Parse (simulated LLM chunks)")

// This is what an LLM would return — chunked as SSE fragments
const llmResponse = JSON.stringify({
  type: "Dashboard",
  key: "dash-1",
  props: { title: "Server Monitor", columns: 3 },
  children: [
    {
      type: "MetricCard",
      key: "cpu",
      props: { label: "CPU Usage", value: "42%", trend: "up", color: "#22c55e" },
    },
    {
      type: "MetricCard",
      key: "mem",
      props: { label: "Memory", value: "78%", trend: "down", color: "#f59e0b" },
    },
    {
      type: "StatusBadge",
      key: "disk",
      props: { status: "warning", text: "Disk 89%" },
    },
  ],
})

// Simulate chunking (like SSE token-by-token delivery)
const chunks: string[] = []
const chunkSize = 15 // small chunks to exercise partial parsing
for (let i = 0; i < llmResponse.length; i += chunkSize) {
  chunks.push(llmResponse.slice(i, i + chunkSize))
}

const identified: ComponentIdentification[] = []
const graph = createStreamingGraph({
  onComponentIdentified: (id) => identified.push(id),
  onToken: () => {}, // absorb
})

for (const chunk of chunks) {
  graph.sendChunk(chunk)
}
graph.flush()

check(`Parsed in ${chunks.length} chunks`, chunks.length > 5)
check("Identified Dashboard", identified.some((c) => c.componentType === "Dashboard"))
check("Identified MetricCard", identified.some((c) => c.componentType === "MetricCard"))
check("Identified StatusBadge", identified.some((c) => c.componentType === "StatusBadge"))
check(`${identified.length} components total`, identified.length === 4) // 1 Dashboard + 2 MetricCard + 1 StatusBadge

console.log("  🔍 Identified components:")
for (const c of identified) {
  console.log(`     ${c.componentType} (key=${c.elementKey ?? "?"}, offset=${c.discoveredAtOffset})`)
}

// ─────────────────────────────────────────────────────────────
// Stage 4: Build UITree from identification
// ─────────────────────────────────────────────────────────────

SECTION("Stage 4: UITree Assembly")

// In real genifer, the renderer builds this from streamed tokens.
// Here we simulate what the renderer does: build from the parsed structure.
const parsed = JSON.parse(llmResponse)

function buildTree(json: any, parentKey?: string): UITree {
  let tree = UITree.empty().setRoot(json.key)

  function addNode(node: any, parent?: string) {
    const { type, key, props, children } = node
    const childKeys = children?.map((c: any) => c.key) ?? []
    tree = tree.setElement(
      key,
      new UIElement({
        key,
        type,
        props: props ?? {},
        children: childKeys,
        parentKey: parent,
      }),
    )
    if (children) {
      for (const child of children) {
        addNode(child, key)
      }
    }
  }

  addNode(json)
  return tree
}

const uiTree = buildTree(parsed)

check("Tree root is dash-1", uiTree.root === "dash-1")
check("Tree has 4 elements", uiTree.size === 4)
check("Dashboard element exists", Option.isSome(uiTree.getElement("dash-1")))
check("CPU MetricCard exists", Option.isSome(uiTree.getElement("cpu")))
check("Memory MetricCard exists", Option.isSome(uiTree.getElement("mem")))
check("Disk StatusBadge exists", Option.isSome(uiTree.getElement("disk")))

const dashEl = Option.getOrThrow(uiTree.getElement("dash-1"))
check("Dashboard has 3 children", dashEl.children?.length === 3)
check("Dashboard title prop", dashEl.props.title === "Server Monitor")

// ─────────────────────────────────────────────────────────────
// Stage 5: TreeCache
// ─────────────────────────────────────────────────────────────

SECTION("Stage 5: TreeCache (Effect.Cache)")

const cache = new TreeCache({ maxEntries: 10, ttlMs: 60_000 })
const cacheKey = generateCacheKey(compiled, "gpt-4o")

check("Cache key deterministic", cacheKey === generateCacheKey(compiled, "gpt-4o"))
check("Cache miss before set", cache.get(cacheKey) === undefined)

cache.set(cacheKey, uiTree)

const hit = cache.get(cacheKey)
check("Cache hit after set", hit !== undefined)
check("Cached tree root matches", hit?.root === "dash-1")
check("Cached tree size matches", hit?.size === 4)

const stats = cache.stats
check("Stats show hits", stats.hits >= 1)
console.log(`  📊 Cache stats: ${stats.hits} hits, ${stats.misses} misses, size=${stats.size}`)

// ─────────────────────────────────────────────────────────────
// Stage 6: Thread (Multi-Turn Conversation)
// ─────────────────────────────────────────────────────────────

SECTION("Stage 6: Conversation Thread")

const now = new Date().toISOString()
const thread = new Thread({
  id: "spike-thread",
  messages: List.empty(),
  title: "Server Monitor Chat",
  createdAt: now,
  updatedAt: now,
})
  .appendMessage(
    new ThreadMessage({
      id: "msg-1",
      role: "user",
      content: [{ _tag: "text", text: "Build me a server monitoring dashboard" }],
      timestamp: now,
    }),
  )
  .appendMessage(
    new ThreadMessage({
      id: "msg-2",
      role: "assistant",
      content: [
        { _tag: "text", text: "Here's your dashboard:" },
        { _tag: "ui-tree", treeJson: JSON.stringify({ root: uiTree.root, elements: uiTree.toRecord() }), componentCount: uiTree.size },
      ],
      timestamp: now,
      model: "gpt-4o",
    }),
  )
  .appendMessage(
    new ThreadMessage({
      id: "msg-3",
      role: "user",
      content: [{ _tag: "text", text: "Add a network latency metric too" }],
      timestamp: now,
    }),
  )

check("Thread has 3 messages", thread.messageCount === 3)

const turns = thread.turns
check(`Got ${turns.length} turns`, turns.length >= 1)
if (turns.length > 0) {
  check("Turn 1 user role", turns[0].userMessage.role === "user")
  check("Turn 1 has assistant", turns[0].assistantMessage?.role === "assistant")
  check("Turn 1 assistant has ui-tree", turns[0].assistantMessage?.content.some((c) => c._tag === "ui-tree") ?? false)
}
check("Turn 2 exists (pending follow-up)", turns.length === 2) // msg-3 user with no assistant

console.log(`  💬 ${thread.messageCount} messages, ${turns.length} turns`)

// ─────────────────────────────────────────────────────────────
// Stage 7: Tool Calling
// ─────────────────────────────────────────────────────────────

SECTION("Stage 7: Tool Calling")

const paramSchema = {
  type: "object",
  properties: {
    host: { type: "string", description: "Server hostname" },
    metrics: {
      type: "array",
      items: { type: "string" },
      description: "Metric names to fetch",
    },
  },
  required: ["host", "metrics"],
}

const fetchMetricsTool = new GeniferToolDefinition({
  name: "fetch_server_metrics",
  description: "Fetch real-time server metrics from the monitoring API",
  parametersSchema: paramSchema,
})

check("Tool definition created", fetchMetricsTool.name === "fetch_server_metrics")
check("Tool has parametersSchema", (fetchMetricsTool.parametersSchema as any)?.properties?.host !== undefined)

// Simulate LLM issuing a tool call
const toolCall = new GeniferToolCall({
  id: "call-001",
  name: "fetch_server_metrics",
  args: { host: "prod-web-01", metrics: ["cpu", "memory", "disk"] },
  state: "pending",
  timestamp: Date.now(),
})

check("ToolCall created", toolCall.id === "call-001")
check("ToolCall args parsed", (toolCall.args as any).host === "prod-web-01")

// Simulate execution
const toolResult = new GeniferToolResult({
  callId: "call-001",
  toolName: "fetch_server_metrics",
  content: JSON.stringify({ cpu: 42, memory: 78, disk: 89 }),
  isError: false,
  timestamp: Date.now(),
})

check("ToolResult created", toolResult.callId === "call-001")
check("ToolResult has content", toolResult.content.includes("42"))
check("ToolResult not error", !toolResult.isError)
check("ToolResult has timestamp", typeof toolResult.timestamp === "number")

// Pi-ai adapter round-trip
import { toPiAiToolCall, fromPiAiToolCall, toPiAiToolResult, fromPiAiToolResult } from "../../src/lib/genifer/core/tools"

const piAiCall = toPiAiToolCall(toolCall)
check("toPiAiToolCall: name preserved", piAiCall.name === "fetch_server_metrics")
check("toPiAiToolCall: type is toolCall", piAiCall.type === "toolCall")
check("toPiAiToolCall: arguments is object", typeof piAiCall.arguments === "object")

const roundTripped = fromPiAiToolCall(piAiCall)
check("fromPiAiToolCall: round-trip name", roundTripped.name === toolCall.name)
check("fromPiAiToolCall: round-trip args.host", (roundTripped.args as any).host === "prod-web-01")

// ToolResult adapter
const piAiResult = toPiAiToolResult(toolResult)
check("toPiAiToolResult: role is toolResult", piAiResult.role === "toolResult")
check("toPiAiToolResult: content is array", Array.isArray(piAiResult.content))
check("toPiAiToolResult: content[0] has text", piAiResult.content[0]?.text.includes("42"))

const rtResult = fromPiAiToolResult(piAiResult)
check("fromPiAiToolResult: round-trip callId", rtResult.callId === toolResult.callId)
check("fromPiAiToolResult: round-trip content", rtResult.content.includes("42"))

// ─────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────

SECTION("SUMMARY")
console.log(`  ${pass} passed, ${fail} failed`)
if (fail > 0) {
  process.exit(1)
} else {
  console.log("\n  \x1b[32m🎉 All E2E spike checks passed!\x1b[0m\n")
}
