#!/usr/bin/env bun
/**
 * spike-prompt-compiler.ts — @effect/ai → genifer streaming pipeline E2E
 *
 * Wires @effect/ai LanguageModel.streamText into the EXISTING genifer pipeline:
 *   streamText deltas → pipeline.feedChunk → tokenizer → d2ts → normalize → UITree
 *
 * Tests across all available providers.
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
import { generate, type GenerateResult } from "../../src/lib/genifer/compiler/ai-adapter"

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
// Test runner
// =============================================================================

async function testModel(
  name: string,
  modelLayer: Layer.Layer<LanguageModel.LanguageModel>,
  prompt: string
) {
  console.log(`\n  ┌─────────────────────────────────────────────────┐`)
  console.log(`  │  ${name.padEnd(47)} │`)
  console.log(`  └─────────────────────────────────────────────────┘\n`)

  const layer = MockCatalogLayer.pipe(Layer.provideMerge(modelLayer))

  try {
    let dotCount = 0
    process.stdout.write("  Streaming: ")

    const result = await Effect.runPromise(
      generate({
        prompt,
        onDelta: () => {
          dotCount++
          if (dotCount % 10 === 0) process.stdout.write("█")
        },
        onComponent: (key, type) => {
          process.stdout.write(`\n  ⚡ ${type} (${key})`)
        },
      }).pipe(
        Effect.provide(layer),
        Effect.timeout("90 seconds"),
      )
    )

    console.log(`\n\n  ⏱  ${result.durationMs}ms`)
    console.log(`  📦 Elements: ${result.elementCount}`)
    console.log(`  🧱 Chunks: ${result.chunkCount}`)
    console.log(`  🏆 Quality: ${(result.qualityScore * 100).toFixed(0)}%`)
    console.log(`  🔧 Repairs: ${result.repairCount}`)
    console.log(`  ⚠️  Quarantined: ${result.quarantineCount}`)

    // Show tree root + element keys
    const treeSize = HashMap.size(result.tree.elements)
    console.log(`  🌳 Tree: root="${result.tree.root}", ${treeSize} elements`)

    if (treeSize > 0) {
      const keys: string[] = []
      for (const [key] of result.tree.elements) keys.push(key)
      console.log(`  📋 Keys: ${keys.slice(0, 15).join(", ")}${keys.length > 15 ? "..." : ""}`)
    }

    // Raw JSON excerpt
    console.log(`\n  ── Raw (first 400 chars) ──`)
    for (const line of result.rawJson.slice(0, 400).split("\n")) console.log(`  ${line}`)
    if (result.rawJson.length > 400) console.log(`  ... (${result.rawJson.length} chars total)`)

    return { name, success: true, ...result }
  } catch (err: any) {
    console.log()
    const msg = err?.message || String(err)
    console.log(`  ❌ FAILED: ${msg.slice(0, 300)}`)
    return { name, success: false, error: msg.slice(0, 300) }
  }
}

// =============================================================================
// Run
// =============================================================================

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════╗")
  console.log("║  @effect/ai → genifer pipeline E2E                  ║")
  console.log("╚══════════════════════════════════════════════════════╝")
  console.log(`\n  Prompt: "${PROMPT.slice(0, 90)}${PROMPT.length > 90 ? "..." : ""}"`)

  const results: Array<{ name: string; success: boolean; durationMs?: number; elementCount?: number; qualityScore?: number }> = []

  // ── Anthropic Sonnet 4 (OAuth) ────────────────────────────
  const sonnetLayer = makeAnthropicLayer("claude-sonnet-4-20250514").pipe(
    Layer.provide(PiAuthBridgeLive),
  )
  results.push(await testModel("Anthropic Sonnet 4 (OAuth)", sonnetLayer, PROMPT))

  // ── Codex gpt-5.2 (OAuth) ────────────────────────────────
  const codexLayer = makeOpenAiCodexLayer("gpt-5.2").pipe(
    Layer.provide(PiAuthBridgeLive),
  )
  results.push(await testModel("Codex gpt-5.2 (OAuth)", codexLayer, PROMPT))

  // ── OpenAI gpt-4o-mini (API key) ─────────────────────────
  if (process.env.OPENAI_API_KEY) {
    const miniLayer = makeOpenAiLayerFromEnv("gpt-4o-mini")
    results.push(await testModel("OpenAI gpt-4o-mini (API)", miniLayer, PROMPT))
  } else {
    console.log("\n  ⏭  Skipping gpt-4o-mini (no OPENAI_API_KEY)")
  }

  // ── Summary ──────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════╗")
  console.log("║  RESULTS                                            ║")
  console.log("╚══════════════════════════════════════════════════════╝\n")

  for (const r of results) {
    const status = r.success ? "✅" : "❌"
    const time = r.durationMs ? `${r.durationMs}ms` : "—"
    const elems = r.elementCount ? `${r.elementCount} elems` : "—"
    const quality = r.qualityScore != null ? `${(r.qualityScore * 100).toFixed(0)}%` : "—"
    console.log(`  ${status} ${r.name.padEnd(35)} ${time.padStart(8)}  ${elems.padStart(10)}  ${quality.padStart(5)}`)
  }
  console.log()
}

main().catch((err) => {
  console.error("\n💥 Fatal error:", err)
  process.exit(1)
})
