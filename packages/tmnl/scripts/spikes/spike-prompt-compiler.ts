#!/usr/bin/env bun
/**
 * spike-prompt-compiler.ts — Full genifer E2E: generate → refine → retry
 *
 * Tests the complete flow:
 *   1. generate() — NL prompt → UITree (with automatic retry on failure)
 *   2. refine()  — "make the sidebar wider" → updated UITree
 *
 * Usage:
 *   bun run scripts/spikes/spike-prompt-compiler.ts
 *   bun run scripts/spikes/spike-prompt-compiler.ts "Build a login form"
 */
import { Effect, Layer, HashMap } from "effect"
import * as Schema from "effect/Schema"
import { LanguageModel } from "@effect/ai"

import { PiAuthBridgeLive } from "../../src/lib/agents/auth/PiAuthBridge"
import { makeAnthropicLayer } from "../../src/lib/agents/providers/anthropic"
import {
  makeOpenAiCodexLayer,
  makeOpenAiLayerFromEnv,
} from "../../src/lib/agents/providers/openai"
import {
  createCatalogLayer,
  type DomainCatalog,
  type ComponentDef,
} from "../../src/lib/genifer/core/CatalogService"
import { generate, refine, type GenerateResult } from "../../src/lib/genifer/compiler/ai-adapter"
import { createThreadService } from "../../src/lib/genifer/react/thread-service"

// =============================================================================
// Mock Catalog (headless — no React renderers)
// =============================================================================

const noop = () => null
const defaultEntrance = {
  property: "opacity" as const,
  easing: "out-cubic" as const,
  duration: "normal" as const,
}

function def(
  schema: Schema.Schema<any, any, never>,
  opts: { description: string; hasChildren?: boolean }
): ComponentDef {
  return {
    schema,
    renderer: noop,
    description: opts.description,
    hasChildren: opts.hasChildren ?? false,
    defaultEntrance,
  }
}

const layoutCatalog: DomainCatalog = {
  name: "layout",
  components: {
    Grid: def(
      Schema.Struct({
        template: Schema.optional(Schema.String),
        gap: Schema.optional(Schema.Number),
        minHeight: Schema.optional(Schema.String),
        padding: Schema.optional(Schema.Number),
      }),
      { description: "CSS Grid layout with template columns/rows", hasChildren: true }
    ),
    VStack: def(
      Schema.Struct({
        gap: Schema.optional(Schema.Number),
        padding: Schema.optional(Schema.Number),
        maxWidth: Schema.optional(Schema.Number),
        align: Schema.optional(Schema.Literal("start", "center", "end", "stretch")),
      }),
      { description: "Vertical stack (flexbox column)", hasChildren: true }
    ),
    HStack: def(
      Schema.Struct({
        gap: Schema.optional(Schema.Number),
        padding: Schema.optional(Schema.Number),
        justify: Schema.optional(Schema.Literal("start", "center", "end", "between", "around")),
        align: Schema.optional(Schema.Literal("start", "center", "end", "stretch")),
      }),
      { description: "Horizontal stack (flexbox row)", hasChildren: true }
    ),
  },
}

const uiCatalog: DomainCatalog = {
  name: "ui",
  components: {
    Heading: def(
      Schema.Struct({ level: Schema.Literal(1, 2, 3, 4, 5, 6), text: Schema.String }),
      { description: "Heading h1-h6" }
    ),
    Text: def(
      Schema.Struct({ content: Schema.String, variant: Schema.optional(Schema.Literal("body", "caption", "mono")) }),
      { description: "Text paragraph or label" }
    ),
    Button: def(
      Schema.Struct({ label: Schema.String, variant: Schema.optional(Schema.Literal("primary", "secondary", "ghost", "danger")) }),
      { description: "Clickable button" }
    ),
    TextInput: def(
      Schema.Struct({ placeholder: Schema.optional(Schema.String), label: Schema.optional(Schema.String) }),
      { description: "Text input field" }
    ),
    Card: def(
      Schema.Struct({ padding: Schema.optional(Schema.Number), shadow: Schema.optional(Schema.Boolean) }),
      { description: "Card container", hasChildren: true }
    ),
    Divider: def(
      Schema.Struct({ orientation: Schema.optional(Schema.Literal("horizontal", "vertical")) }),
      { description: "Visual divider" }
    ),
    Badge: def(
      Schema.Struct({ text: Schema.String, color: Schema.optional(Schema.Literal("green", "red", "yellow", "blue", "gray")) }),
      { description: "Small badge/tag" }
    ),
  },
}

const MockCatalogLayer = createCatalogLayer(layoutCatalog, uiCatalog)

// =============================================================================
// Config
// =============================================================================

const PROMPT =
  process.argv[2] ||
  "a project status dashboard showing build health, test coverage, deploy status, and open issues"

// =============================================================================
// Helpers
// =============================================================================

function printResult(label: string, r: GenerateResult) {
  console.log(`\n  ── ${label} ──`)
  console.log(`  ⏱  ${r.durationMs}ms`)
  console.log(`  📦 Elements: ${r.elementCount}`)
  console.log(`  🧱 Chunks: ${r.chunkCount}`)
  console.log(`  🏆 Quality: ${(r.qualityScore * 100).toFixed(0)}%`)
  console.log(`  🔧 Repairs: ${r.repairCount}`)
  console.log(`  ⚠️  Quarantined: ${r.quarantineCount}`)
  console.log(`  🔄 Attempts: ${r.attempts + 1} (${r.attempts} retries)`)
  if (r.retryFailures.length > 0) {
    for (const f of r.retryFailures) {
      console.log(`     ↳ Retry: ${f.failureClass} — ${f.retryHint.slice(0, 80)}`)
    }
  }

  const treeSize = HashMap.size(r.tree.elements)
  console.log(`  🌳 Tree: root="${r.tree.root}", ${treeSize} elements`)

  if (treeSize > 0) {
    const keys: string[] = []
    for (const [key] of r.tree.elements) keys.push(key)
    console.log(`  📋 Keys: ${keys.slice(0, 12).join(", ")}${keys.length > 12 ? "..." : ""}`)
  }

  console.log(`\n  ── JSON (first 300 chars) ──`)
  for (const line of r.rawJson.slice(0, 300).split("\n")) console.log(`  ${line}`)
  if (r.rawJson.length > 300) console.log(`  ... (${r.rawJson.length} chars total)`)
}

// =============================================================================
// Run
// =============================================================================

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════╗")
  console.log("║  genifer E2E: generate → refine → retry                 ║")
  console.log("╚══════════════════════════════════════════════════════════╝")
  console.log(`\n  Prompt: "${PROMPT.slice(0, 90)}${PROMPT.length > 90 ? "..." : ""}"`)

  // Pick a model — Sonnet 4 had best quality in previous run
  const modelLayer = makeAnthropicLayer("claude-sonnet-4-20250514").pipe(
    Layer.provide(PiAuthBridgeLive),
  )
  const layer = MockCatalogLayer.pipe(Layer.provideMerge(modelLayer))

  // Shared thread service for generate + refine
  const threadService = createThreadService()

  // ── Stage 1: generate() ─────────────────────────────────
  console.log("\n┌─────────────────────────────────────────────────┐")
  console.log("│  Stage 1: generate()                             │")
  console.log("└─────────────────────────────────────────────────┘")

  let dots = 0
  process.stdout.write("  Streaming: ")

  const genResult = await Effect.runPromise(
    generate({
      prompt: PROMPT,
      threadService,
      onDelta: () => { dots++; if (dots % 10 === 0) process.stdout.write("█") },
      onRetry: (attempt, failure) => {
        console.log(`\n  🔄 Retry ${attempt}: ${failure.failureClass}`)
        process.stdout.write("  Streaming: ")
        dots = 0
      },
    }).pipe(
      Effect.provide(layer),
      Effect.timeout("120 seconds"),
    )
  )
  console.log()
  printResult("generate()", genResult)

  // ── Stage 2: refine() — modify the tree ──────────────────
  console.log("\n┌─────────────────────────────────────────────────┐")
  console.log("│  Stage 2: refine() — \"add a search bar at top\"  │")
  console.log("└─────────────────────────────────────────────────┘")

  dots = 0
  process.stdout.write("  Streaming: ")

  const refineResult = await Effect.runPromise(
    refine({
      prompt: "Add a search bar at the top of the dashboard and change the heading to 'Mission Control'",
      currentTree: genResult.tree,
      threadService,
      onDelta: () => { dots++; if (dots % 10 === 0) process.stdout.write("█") },
      onRetry: (attempt, failure) => {
        console.log(`\n  🔄 Retry ${attempt}: ${failure.failureClass}`)
        process.stdout.write("  Streaming: ")
        dots = 0
      },
    }).pipe(
      Effect.provide(layer),
      Effect.timeout("120 seconds"),
    )
  )
  console.log()
  printResult("refine()", refineResult)

  // ── Stage 3: Check thread state ──────────────────────────
  console.log("\n┌─────────────────────────────────────────────────┐")
  console.log("│  Stage 3: Thread state                           │")
  console.log("└─────────────────────────────────────────────────┘")

  const thread = threadService.getActiveThread()
  if (thread) {
    const msgs = thread.toArray()
    console.log(`\n  Thread: ${thread.id}`)
    console.log(`  Title: "${thread.title}"`)
    console.log(`  Messages: ${msgs.length}`)
    for (const msg of msgs) {
      const preview = msg.content[0]
      let text = ""
      if (preview._tag === "text") text = preview.text.slice(0, 80)
      else if (preview._tag === "ui-tree") text = `[UITree: ${preview.elementCount} elements]`
      console.log(`    ${msg.role.padEnd(10)} ${text}${text.length >= 80 ? "..." : ""}`)
    }
  }

  // ── Summary ──────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════════╗")
  console.log("║  RESULTS                                                ║")
  console.log("╚══════════════════════════════════════════════════════════╝\n")

  const genStatus = genResult.qualityScore >= 0.5 ? "✅" : "❌"
  const refStatus = refineResult.qualityScore >= 0.5 ? "✅" : "❌"

  console.log(`  ${genStatus} generate()  ${genResult.durationMs}ms  ${genResult.elementCount} elems  ${(genResult.qualityScore * 100).toFixed(0)}%  ${genResult.attempts} retries`)
  console.log(`  ${refStatus} refine()    ${refineResult.durationMs}ms  ${refineResult.elementCount} elems  ${(refineResult.qualityScore * 100).toFixed(0)}%  ${refineResult.attempts} retries`)
  console.log()
}

main().catch((err) => {
  console.error("\n💥 Fatal error:", err)
  process.exit(1)
})
