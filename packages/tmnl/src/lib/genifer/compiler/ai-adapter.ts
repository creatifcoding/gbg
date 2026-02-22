/**
 * @fileoverview @effect/ai → genifer streaming pipeline adapter
 *
 * Bridges @effect/ai's LanguageModel.streamText into the existing genifer
 * streaming pipeline (tokenizer → d2ts graph → normalize → UITree).
 *
 * Two modes:
 *   1. `generate()` — single prompt → UITree with automatic retry on failure
 *   2. `refine()`   — conversational follow-up on an existing tree
 *
 * Uses the existing PromptTemplate + CatalogService to build prompts,
 * the feedback loop for retry with error-aware hints, and the thread
 * service for multi-turn conversation state.
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
  normalizedElementsAtom,
  quarantinedAtom,
} from "../streaming/pipeline"
import { UITree } from "../core/schemas"
import { classifyFailure, type ClassifiedFailure } from "../core/feedback-loop"
import {
  createThreadService,
  type ThreadServiceShape,
} from "../react/thread-service"
import type { TextContent, UITreeContent } from "../core/threads"

// =============================================================================
// Prompt Templates
// =============================================================================

/** Initial generation — proven format from spike-real-llm.ts */
const geniferTemplate = new PromptTemplate({
  name: "genifer-generate",
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

/** Refinement — takes previous tree + modification request */
const refineTemplate = new PromptTemplate({
  name: "genifer-refine",
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

Here is the current UI tree (JSON):
{{currentTree}}

The user wants this modification: {{query}}

Rules:
- Use ONLY the components listed above
- Every node MUST have "type", "key", and "props"
- Preserve existing keys where the component is unchanged
- Return the COMPLETE updated tree, not a diff
- Respond with ONLY the JSON object — no prose, no code fences`,
  slots: [
    new PromptSlot({ name: "catalog", type: "catalog", required: false }),
    new PromptSlot({ name: "currentTree", type: "string", required: true }),
    new PromptSlot({ name: "query", type: "string", required: true }),
  ],
})

/** Retry supplement — appended to prompt on retry attempts */
const retryTemplate = new PromptTemplate({
  name: "genifer-retry",
  template: `{{basePrompt}}

{{retryHints}}`,
  slots: [
    new PromptSlot({ name: "basePrompt", type: "string", required: true }),
    new PromptSlot({ name: "retryHints", type: "string", required: true }),
  ],
})

const SYSTEM_PROMPT = "You are Claude Code, a JSON-only UI generation engine. Respond with valid JSON only."

import { BEHAVIOR_DSL_PROMPT } from "../decorators/generation-schema"
import { getComponentRegistry } from "../decorators/component"
import { getActionGroupRegistry } from "../decorators/action-group"
import { getRpcRegistry } from "../decorators/rpc"

function buildSystemPromptForAdapter(interactive?: boolean): string {
  if (!interactive) return SYSTEM_PROMPT

  const lines = [SYSTEM_PROMPT, ""]
  lines.push(BEHAVIOR_DSL_PROMPT)

  // Available decorated components
  const componentReg = getComponentRegistry()
  if (componentReg.size > 0) {
    lines.push("")
    lines.push("PRE-BUILT INTERACTIVE COMPONENTS (use via ref):")
    for (const [name, meta] of Array.from(componentReg.entries())) {
      lines.push(`  ${name} — ${(meta as any).description ?? ""}`)
    }
  }

  // Available ActionGroups
  const agReg = getActionGroupRegistry()
  if (agReg.size > 0) {
    lines.push("")
    lines.push("AVAILABLE ACTION GROUPS:")
    for (const [name, reg] of Array.from(agReg.entries())) {
      const stateFields = Array.from((reg as any).stateFields?.keys?.() ?? [])
      const actions = Array.from((reg as any).actions?.keys?.() ?? [])
      lines.push(`  ${name}: state=[${stateFields.join(", ")}] actions=[${actions.join(", ")}]`)
    }
  }

  // Available RPCs
  const rpcReg = getRpcRegistry()
  if (rpcReg.size > 0) {
    lines.push("")
    lines.push("AVAILABLE RPCs:")
    for (const [tag, meta] of Array.from(rpcReg.entries())) {
      lines.push(`  ${tag} — ${(meta as any).description ?? ""}`)
    }
  }

  return lines.join("\n")
}

// =============================================================================
// Types
// =============================================================================

export interface GenerateOptions {
  /** Natural language UI description */
  readonly prompt: string
  /** Pipeline config (quality thresholds, expected elements, etc.) */
  readonly pipelineConfig?: PipelineConfig
  /** Maximum retry attempts on quality failure (default: 2) */
  readonly maxRetries?: number
  /** Enable interactive behavior generation (behavior blocks, sigils, RPCs) */
  readonly interactive?: boolean
  /** Called on each text delta (for progress UI) */
  readonly onDelta?: (delta: string) => void
  /** Called when a component is identified during streaming */
  readonly onComponent?: (key: string, type: string) => void
  /** Called on retry attempt (attempt number, failure classification) */
  readonly onRetry?: (attempt: number, failure: ClassifiedFailure) => void
  /** Thread service for conversation state (auto-created if omitted) */
  readonly threadService?: ThreadServiceShape
}

export interface RefineOptions extends GenerateOptions {
  /** The current UITree to modify */
  readonly currentTree: UITree
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
  /** Number of retry attempts needed (0 = first try succeeded) */
  readonly attempts: number
  /** Failure classifications from any retries */
  readonly retryFailures: readonly ClassifiedFailure[]
  /** Thread ID for conversation continuity */
  readonly threadId: string
}

// =============================================================================
// Internal: Single streaming attempt
// =============================================================================

function streamAttempt(
  compiled: string,
  pipelineConfig?: PipelineConfig,
  onDelta?: (delta: string) => void,
  interactive?: boolean,
): Effect.Effect<
  { tree: UITree; rawJson: string; chunks: number; elementCount: number; quarantineCount: number; repairCount: number; qualityScore: number; passed: boolean; failure: ClassifiedFailure | null },
  never,
  LanguageModel.LanguageModel
> {
  return Effect.gen(function* () {
    const pipeline = createStreamingPipeline(pipelineConfig)
    const registry = pipeline.registry

    let rawJson = ""
    let chunks = 0

    const stream = LanguageModel.streamText({
      system: buildSystemPromptForAdapter(interactive),
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
          onDelta?.(delta)
        }
      })
    )

    const { tree, score, repairResult } = pipeline.finalize()
    const failure = score.passed
      ? null
      : classifyFailure(undefined, score, repairResult)

    return {
      tree,
      rawJson,
      chunks,
      elementCount: registry.get(normalizedElementsAtom).length,
      quarantineCount: registry.get(quarantinedAtom).length,
      repairCount: repairResult.repairs.length,
      qualityScore: score.overall,
      passed: score.passed,
      failure,
    }
  })
}

// =============================================================================
// generate() — Initial prompt → UITree with retry loop
// =============================================================================

/**
 * Generate a UITree from a natural language prompt.
 *
 * On quality failure, automatically retries with error-aware hints
 * (up to maxRetries, default 2). Each retry appends targeted
 * instructions based on what went wrong.
 *
 * Records conversation in thread for later refinement.
 *
 * Requires: LanguageModel.LanguageModel, CatalogComponents
 */
export const generate = (
  options: GenerateOptions
): Effect.Effect<GenerateResult, never, LanguageModel.LanguageModel | CatalogComponents> =>
  Effect.gen(function* () {
    const start = Date.now()
    const maxRetries = options.maxRetries ?? 2

    // Thread for conversation state
    const threads = options.threadService ?? createThreadService()
    const thread = threads.createThread(options.prompt.slice(0, 60))

    // Build prompt from catalog
    const catalogPrompt = yield* getSystemPrompt
    const basePrompt = geniferTemplate.compile(
      { query: options.prompt },
      catalogPrompt
    )

    // Record user message
    threads.addMessage("user", [{ _tag: "text" as const, text: options.prompt }])

    // Retry loop
    const failures: ClassifiedFailure[] = []
    let compiled = basePrompt

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = yield* streamAttempt(compiled, options.pipelineConfig, options.onDelta, options.interactive)

      if (result.passed || attempt === maxRetries) {
        // Record assistant response
        threads.addMessage("assistant", [
          { _tag: "ui-tree" as const, treeJson: result.rawJson, componentCount: result.elementCount },
        ])

        return {
          tree: result.tree,
          qualityScore: result.qualityScore,
          chunkCount: result.chunks,
          elementCount: result.elementCount,
          quarantineCount: result.quarantineCount,
          repairCount: result.repairCount,
          durationMs: Date.now() - start,
          rawJson: result.rawJson,
          attempts: attempt,
          retryFailures: failures,
          threadId: thread.id,
        } satisfies GenerateResult
      }

      // Failed — classify and build retry prompt
      const failure = result.failure!
      failures.push(failure)
      options.onRetry?.(attempt + 1, failure)

      // Build retry hints from accumulated failures
      const hints = failures.map((f, i) =>
        `Attempt ${i + 1} failed: ${f.retryHint}`
      )
      const retryHintsText = [
        "# Previous Attempt Feedback",
        "",
        ...hints,
        "",
        "Please fix these issues in your next response.",
      ].join("\n")

      compiled = retryTemplate.compile(
        { basePrompt, retryHints: retryHintsText },
        ""
      )
    }

    // Unreachable, but TypeScript
    throw new Error("Unreachable: retry loop exited without return")
  })

// =============================================================================
// refine() — Conversational follow-up on existing tree
// =============================================================================

/**
 * Refine an existing UITree with a follow-up instruction.
 *
 * Sends the current tree JSON + the modification request to the model.
 * The model returns a complete updated tree (not a diff).
 *
 * Uses the same retry loop as generate().
 *
 * Requires: LanguageModel.LanguageModel, CatalogComponents
 */
export const refine = (
  options: RefineOptions
): Effect.Effect<GenerateResult, never, LanguageModel.LanguageModel | CatalogComponents> =>
  Effect.gen(function* () {
    const start = Date.now()
    const maxRetries = options.maxRetries ?? 2

    // Thread — reuse or create
    const threads = options.threadService ?? createThreadService()
    if (!threads.getActiveThread()) {
      threads.createThread("Refinement")
    }

    // Serialize the current tree
    const currentTreeJson = JSON.stringify(
      serializeUITree(options.currentTree),
      null,
      2
    )

    // Build refinement prompt
    const catalogPrompt = yield* getSystemPrompt
    const basePrompt = refineTemplate.compile(
      { query: options.prompt, currentTree: currentTreeJson },
      catalogPrompt
    )

    // Record user refinement message
    threads.addMessage("user", [{ _tag: "text" as const, text: options.prompt }])

    // Same retry loop
    const failures: ClassifiedFailure[] = []
    let compiled = basePrompt

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = yield* streamAttempt(compiled, options.pipelineConfig, options.onDelta, options.interactive)

      if (result.passed || attempt === maxRetries) {
        threads.addMessage("assistant", [
          { _tag: "ui-tree" as const, treeJson: result.rawJson, componentCount: result.elementCount },
        ])

        return {
          tree: result.tree,
          qualityScore: result.qualityScore,
          chunkCount: result.chunks,
          elementCount: result.elementCount,
          quarantineCount: result.quarantineCount,
          repairCount: result.repairCount,
          durationMs: Date.now() - start,
          rawJson: result.rawJson,
          attempts: attempt,
          retryFailures: failures,
          threadId: threads.getActiveThread()!.id,
        } satisfies GenerateResult
      }

      const failure = result.failure!
      failures.push(failure)
      options.onRetry?.(attempt + 1, failure)

      const hints = failures.map((f, i) =>
        `Attempt ${i + 1} failed: ${f.retryHint}`
      )
      const retryHintsText = [
        "# Previous Attempt Feedback",
        "",
        ...hints,
        "",
        "Please fix these issues in your next response.",
      ].join("\n")

      compiled = retryTemplate.compile(
        { basePrompt, retryHints: retryHintsText },
        ""
      )
    }

    throw new Error("Unreachable: retry loop exited without return")
  })

// =============================================================================
// Helpers
// =============================================================================

/** Serialize UITree to plain JSON-safe object (for embedding in prompt) */
function serializeUITree(tree: UITree): unknown {
  function serializeElement(key: string): unknown {
    const opt = tree.getElement(key)
    if (opt._tag === "None") return null

    const el = opt.value
    return {
      type: el.type,
      key: el.key,
      props: el.props,
      ...(el.children.length > 0
        ? { children: el.children.map(serializeElement).filter(Boolean) }
        : {}),
    }
  }

  return serializeElement(tree.root)
}
