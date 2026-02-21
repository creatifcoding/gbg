/**
 * @fileoverview @effect/ai → genifer streaming pipeline adapter
 *
 * Bridges @effect/ai's LanguageModel.streamText into the existing genifer
 * streaming pipeline (tokenizer → d2ts graph → normalize → UITree).
 *
 * Uses the existing PromptTemplate + CatalogService to build the prompt —
 * the same prompt engineering that spike-real-llm.ts proved works.
 *
 * @module genifer/compiler/ai-adapter
 */
import { LanguageModel } from "@effect/ai"
import { Effect, Stream, Option } from "effect"

import { CatalogComponents, getSystemPrompt } from "../core/CatalogService"
import { PromptTemplate, PromptSlot } from "../core/prompts"
import {
  createStreamingPipeline,
  type PipelineConfig,
  pipelineTreeAtom,
  normalizedElementsAtom,
  quarantinedAtom,
} from "../streaming/pipeline"
import { UITree } from "../core/schemas"

// =============================================================================
// The proven prompt template (from spike-real-llm.ts)
// =============================================================================

const geniferTemplate = new PromptTemplate({
  name: "genifer-ai-adapter",
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
- Return a single root component
- Respond with ONLY the JSON object — no prose, no code fences`,
  slots: [
    new PromptSlot({ name: "catalog", type: "catalog", required: false }),
    new PromptSlot({ name: "query", type: "string", required: true }),
  ],
})

// =============================================================================
// Types
// =============================================================================

export interface GenerateOptions {
  /** Natural language UI description */
  readonly prompt: string
  /** Pipeline config (registrations, quality thresholds, etc.) */
  readonly pipelineConfig?: PipelineConfig
  /** Called on each text delta (for progress UI) */
  readonly onDelta?: (delta: string) => void
  /** Model temperature (default: 0.3) */
  readonly temperature?: number
}

export interface GenerateResult {
  readonly tree: UITree
  readonly qualityScore: number
  readonly chunkCount: number
  readonly elementCount: number
  readonly quarantineCount: number
  readonly repairCount: number
  readonly durationMs: number
  readonly rawJson: string
}

// =============================================================================
// Core: Stream @effect/ai deltas → genifer pipeline
// =============================================================================

/**
 * Generate a UITree from a natural language prompt using @effect/ai.
 *
 * Requires LanguageModel.LanguageModel and CatalogComponents in context.
 *
 * Wires:
 *   CatalogService.generatePrompt() → PromptTemplate.compile()
 *     → LanguageModel.streamText → delta chunks
 *     → pipeline.feedChunk → tokenizer → d2ts → normalize → UITree
 */
export const generate = (
  options: GenerateOptions
): Effect.Effect<GenerateResult, never, LanguageModel.LanguageModel | CatalogComponents> =>
  Effect.gen(function* () {
    const start = Date.now()

    // Build the prompt using the EXISTING catalog + template
    const catalogPrompt = yield* getSystemPrompt
    const compiled = geniferTemplate.compile(
      { query: options.prompt },
      catalogPrompt
    )

    // Create the streaming pipeline
    const pipeline = createStreamingPipeline(options.pipelineConfig)
    const registry = pipeline.registry

    // Stream from @effect/ai — system is minimal, the compiled prompt does all the work
    let rawJson = ""
    let chunks = 0

    const stream = LanguageModel.streamText({
      system: "You are Claude Code, a JSON-only UI generation engine. Respond with valid JSON only.",
      prompt: compiled,
    })

    yield* Stream.runForEach(stream, (part) =>
      Effect.sync(() => {
        const p = part as any
        if (p.type === "text-delta" && p.delta) {
          const delta: string = p.delta
          rawJson += delta
          chunks++
          pipeline.feedChunk(delta)
          options.onDelta?.(delta)
        }
      })
    )

    // Finalize — triggers repair + quality scoring
    const { tree, score, repairResult } = pipeline.finalize()
    const durationMs = Date.now() - start

    return {
      tree,
      qualityScore: score.overall,
      chunkCount: chunks,
      elementCount: registry.get(normalizedElementsAtom).length,
      quarantineCount: registry.get(quarantinedAtom).length,
      repairCount: repairResult.repairs.length,
      durationMs,
      rawJson,
    } satisfies GenerateResult
  })
