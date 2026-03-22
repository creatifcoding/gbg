/**
 * @fileoverview Raindrop Eval Harness for Genifer Prompt Compiler
 *
 * Wraps the two-stage pipeline with Raindrop observability:
 * - Tracks each model invocation (compiler + generator)
 * - Signals structural quality (valid_tree, schema_violations, etc.)
 * - Enables A/B experiments across models
 *
 * @module genifer/compiler/eval
 */
import { Effect } from "effect"
import { Raindrop } from "raindrop-ai"

import { normalize, normalizeWithMeta } from "../core/normalize"

// =============================================================================
// Types
// =============================================================================

export interface EvalConfig {
  /** Raindrop API key (from dashboard) */
  readonly raindropKey: string
  /** User ID for tracking */
  readonly userId?: string
  /** Experiment tag (e.g., "haiku-vs-4o-mini", "sonnet-vs-5.2") */
  readonly experiment?: string
  /** Enable debug logging */
  readonly debug?: boolean
}

export interface EvalResult {
  /** Whether the output produced a valid UI tree */
  readonly validTree: boolean
  /** Format detected (nested/flat/hybrid/unknown) */
  readonly format: string
  /** Number of elements in the tree */
  readonly elementCount: number
  /** Component types found */
  readonly componentTypes: ReadonlyArray<string>
  /** Number of repairs applied by normalizer */
  readonly repairsApplied: number
  /** Duration in ms */
  readonly durationMs: number
  /** Raw JSON output from the generator */
  readonly rawOutput: string
  /** Raindrop event ID (for signal correlation) */
  readonly eventId: string
}

// =============================================================================
// Eval Harness
// =============================================================================

/**
 * Create a Raindrop-instrumented eval harness.
 *
 * Usage:
 * ```ts
 * const eval = createEvalHarness({ raindropKey: "..." })
 * const result = await eval.evaluateOutput({
 *   model: "gpt-5.2",
 *   input: "Make a dashboard",
 *   output: '{"root":"layout","elements":{...}}',
 * })
 * ```
 */
export function createEvalHarness(config: EvalConfig) {
  const raindrop = new Raindrop({
    writeKey: config.raindropKey,
    debugLogs: config.debug ?? false,
  })

  /**
   * Evaluate a single model output against the genifer normalization pipeline.
   */
  async function evaluateOutput(params: {
    model: string
    input: string
    output: string
    stage?: "compiler" | "generator"
    compilerModel?: string
    generatorModel?: string
  }): Promise<EvalResult> {
    const eventId = crypto.randomUUID()
    const start = Date.now()

    // Track the AI interaction
    const interaction = raindrop.begin({
      eventId,
      event: `genifer_${params.stage ?? "generator"}_output`,
      userId: config.userId ?? "eval-harness",
      input: params.input,
      model: params.model,
      properties: {
        ...(config.experiment ? { experiment: config.experiment } : {}),
        stage: params.stage ?? "generator",
        ...(params.compilerModel
          ? { compiler_model: params.compilerModel }
          : {}),
        ...(params.generatorModel
          ? { generator_model: params.generatorModel }
          : {}),
      },
    })

    // Run normalization
    const result = Effect.runSyncExit(
      Effect.either(normalizeWithMeta(params.output))
    )

    const durationMs = Date.now() - start
    let evalResult: EvalResult

    // Handle the normalization result
    const either =
      result._tag === "Success" ? result.value : { _tag: "Left" as const, left: new Error("Exit failure") }

    if (either._tag === "Right") {
      const { tree, meta } = either.right
      const types = new Set<string>()
      for (const el of tree.elements.values()) {
        types.add(el.type)
      }

      evalResult = {
        validTree: true,
        format: meta.format ?? "unknown",
        elementCount: tree.elements.size,
        componentTypes: Array.from(types),
        repairsApplied: meta.repairs ?? 0,
        durationMs,
        rawOutput: params.output,
        eventId,
      }

      // Signal: valid tree
      await raindrop.trackSignal({
        eventId,
        name: "valid_tree",
        sentiment: "POSITIVE",
        properties: {
          element_count: String(evalResult.elementCount),
          format: evalResult.format,
          repairs: String(evalResult.repairsApplied),
        },
      })

      // Signal: repairs needed (negative if > 0)
      if (evalResult.repairsApplied > 0) {
        await raindrop.trackSignal({
          eventId,
          name: "repairs_needed",
          sentiment: "NEGATIVE",
          properties: {
            count: String(evalResult.repairsApplied),
          },
        })
      }
    } else {
      evalResult = {
        validTree: false,
        format: "unknown",
        elementCount: 0,
        componentTypes: [],
        repairsApplied: 0,
        durationMs,
        rawOutput: params.output,
        eventId,
      }

      // Signal: invalid tree
      await raindrop.trackSignal({
        eventId,
        name: "invalid_tree",
        sentiment: "NEGATIVE",
        properties: {
          error: String(either.left).slice(0, 200),
        },
      })
    }

    // Finish the interaction
    interaction.finish({
      output: evalResult.validTree
        ? `Valid tree: ${evalResult.elementCount} elements, ${evalResult.componentTypes.join(", ")}`
        : `Invalid tree: normalization failed`,
    })

    return evalResult
  }

  /**
   * Run a batch evaluation across multiple models with the same prompts.
   *
   * Each model generates output for each prompt, and all outputs are
   * evaluated through the normalization pipeline with Raindrop signals.
   */
  async function evaluateBatch(params: {
    prompts: ReadonlyArray<string>
    outputs: ReadonlyArray<{
      model: string
      prompt: string
      output: string
    }>
  }): Promise<ReadonlyArray<EvalResult>> {
    const results: EvalResult[] = []
    for (const entry of params.outputs) {
      const result = await evaluateOutput({
        model: entry.model,
        input: entry.prompt,
        output: entry.output,
      })
      results.push(result)
    }
    return results
  }

  /**
   * Close the Raindrop client (flush buffered events).
   */
  async function close() {
    await raindrop.close()
  }

  return {
    evaluateOutput,
    evaluateBatch,
    close,
    raindrop, // Expose for advanced usage (withSpan, withTool, etc.)
  }
}
