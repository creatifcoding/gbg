/**
 * @fileoverview @effect/ai → Genifer JSONL patch-stream adapter
 *
 * Bridges @effect/ai's LanguageModel.streamText into a JSONL patch compiler.
 * Model output is expected as newline-delimited patch objects that are applied
 * incrementally to UITree for progressive updates.
 *
 * Two modes:
 *   1. `generate()` — prompt → patch stream → UITree
 *   2. `refine()`   — current tree + instruction → patch stream → UITree
 *
 * Includes a normalization fallback when the model emits full JSON instead of
 * patch lines, so migration remains resilient while prompts harden.
 *
 * @module genifer/compiler/ai-adapter
 */
import { LanguageModel } from "@effect/ai"
import { Effect, Stream, Option, JSONSchema } from "effect"

import { CatalogComponents, getSystemPrompt } from "../core/CatalogService"
import { PromptTemplate, PromptSlot } from "../core/prompts"
import { applyPatch, parsePatchLine } from "../core/streaming"
import { normalize } from "../core/normalize"
import { JsonPatch, UITree } from "../core/schemas"
import { type ClassifiedFailure } from "../core/feedback-loop"
import {
  createThreadService,
  type ThreadServiceShape,
} from "../react/thread-service"
import {
  type PromptBlockTrace,
  type PromptSteeringTrace,
  type PromptTokenomicsTrace,
  type PromptUtilityScore,
  type PromptExtractionSource,
  createPromptBlockTrace,
  createTokenomicsTrace,
  computePromptUtility,
  extractUsageFromResponse,
  hashText,
} from "./prompt-eval"

// =============================================================================
// Prompt Templates
// =============================================================================

/** Initial generation — JSONL patch-stream (one patch per line) */
const geniferTemplate = new PromptTemplate({
  name: "genifer-generate",
  template: `You are a UI generation engine. You MUST respond with ONLY NDJSON patch lines (one JSON object per line). No markdown, no prose, no code fences.

Patch format:
{"op":"set|add|replace|remove","path":"<json-pointer>","value":<any>}

Build a FLAT UITree using these paths:
- /root -> string root key
- /elements/<key> -> full element object
- /elements/<key>/props/<prop> -> prop updates
- /elements/<key>/children -> array of child keys

Element object shape at /elements/<key>:
{
  "key": "<same key>",
  "type": "<ComponentType>",
  "props": { ... },
  "children": ["child-key", ...],
  "parentKey": null | "<parent-key>"
}

Available components:
{{catalog}}

User request: {{query}}

Rules:
- Use ONLY listed components
- First patch MUST set /root
- Every referenced child key must exist in /elements
- Emit only patch lines, newline-delimited`,
  slots: [
    new PromptSlot({ name: "catalog", type: "catalog", required: false }),
    new PromptSlot({ name: "query", type: "string", required: true }),
  ],
})

/** Refinement — current tree + instruction → JSONL patch stream */
const refineTemplate = new PromptTemplate({
  name: "genifer-refine",
  template: `You are a UI generation engine. You MUST respond with ONLY NDJSON patch lines (one JSON object per line). No markdown, no prose, no code fences.

Patch format:
{"op":"set|add|replace|remove","path":"<json-pointer>","value":<any>}

Available components:
{{catalog}}

Current flat UITree snapshot:
{{currentTree}}

Requested modification:
{{query}}

Rules:
- Emit only the patches needed to transform the current tree
- Preserve existing keys where unchanged
- Keep /root valid
- Every referenced child key must exist in /elements
- Emit only patch lines, newline-delimited`,
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

const SYSTEM_PROMPT = "You are Claude Code, a JSONL patch-stream UI generation engine. Respond with newline-delimited JSON patch objects only."

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
  /** Maximum retry attempts on quality failure (default: 2) */
  readonly maxRetries?: number
  /** Enable interactive behavior generation (behavior blocks, sigils, RPCs) */
  readonly interactive?: boolean
  /** Called on each text delta (for progress UI) */
  readonly onDelta?: (delta: string) => void
  /** Called when the incremental tree updates (new element complete) */
  readonly onTreeUpdate?: (partialTree: UITree, elementCount: number) => void
  /** Called when a component is identified during streaming */
  readonly onComponent?: (key: string, type: string) => void
  /** Called for every decoded patch line after applyPatch (json-render style incremental feed) */
  readonly onPatch?: (patch: JsonPatch, tree: UITree, elementCount: number) => void
  /** Called on retry attempt (attempt number, failure classification) */
  readonly onRetry?: (attempt: number, failure: ClassifiedFailure) => void
  /** Thread service for conversation state (auto-created if omitted) */
  readonly threadService?: ThreadServiceShape
}

export interface RefineOptions extends GenerateOptions {
  /** The current UITree to modify */
  readonly currentTree: UITree
}

export interface PromptEvalTrace {
  readonly promptHash: string
  readonly promptBlocks: ReadonlyArray<PromptBlockTrace>
  readonly tokenomics: PromptTokenomicsTrace
  readonly steering: PromptSteeringTrace
  readonly utility: PromptUtilityScore
}

export interface QuarantineEntry {
  readonly stage: 'parse' | 'decode'
  readonly message: string
  readonly line: string
  readonly lineIndex: number
  readonly timestamp: number
  readonly streamId?: string
  readonly context?: unknown
}

export interface GenerateResult {
  readonly tree: UITree
  readonly qualityScore: number
  readonly chunkCount: number
  readonly elementCount: number
  readonly quarantineCount: number
  readonly quarantineEntries: ReadonlyArray<QuarantineEntry>
  readonly repairCount: number
  readonly durationMs: number
  readonly rawJson: string
  /** Number of retry attempts needed (0 = first try succeeded) */
  readonly attempts: number
  /** Failure classifications from any retries */
  readonly retryFailures: readonly ClassifiedFailure[]
  /** Thread ID for conversation continuity */
  readonly threadId: string
  /** Prompt eval trace for tokenomics + steering effectiveness */
  readonly promptEval: PromptEvalTrace
}

// =============================================================================
// Internal: Single streaming attempt
// =============================================================================

function streamAttempt(
  compiled: string,
  systemPrompt: string,
  onDelta?: (delta: string) => void,
  onTreeUpdate?: (partialTree: UITree, elementCount: number) => void,
  onComponent?: (key: string, type: string) => void,
  onPatch?: (patch: JsonPatch, tree: UITree, elementCount: number) => void,
  initialTree?: UITree,
): Effect.Effect<
  {
    tree: UITree
    /** Flat snapshot JSON for persistence + tool rendering */
    rawJson: string
    /** Raw model output (JSONL/text) for eval telemetry */
    rawOutput: string
    chunks: number
    elementCount: number
    quarantineCount: number
    quarantineEntries: ReadonlyArray<QuarantineEntry>
    repairCount: number
    qualityScore: number
    passed: boolean
    failure: ClassifiedFailure | null
    extractionSource: PromptExtractionSource
    usage: {
      inputTokens?: number
      outputTokens?: number
      totalTokens?: number
      reasoningTokens?: number
      cachedInputTokens?: number
    }
  },
  never,
  LanguageModel.LanguageModel
> {
  return Effect.gen(function* () {
    let tree = initialTree ?? UITree.empty()
    let rawOutput = ""
    let chunks = 0
    let usage: {
      inputTokens?: number
      outputTokens?: number
      totalTokens?: number
      reasoningTokens?: number
      cachedInputTokens?: number
    } = {}

    let buffer = ""
    let lineIndex = 0
    let appliedPatches = 0
    let parseIssues = 0
    const quarantineEntries: QuarantineEntry[] = []
    let lastElementCount = 0
    let inPatchFence = false

    const processLine = (line: string, chunk: string) =>
      Effect.gen(function* () {
        const trimmed = line.trim()
        if (!trimmed) return

        if (trimmed.startsWith("```")) {
          if (!inPatchFence) {
            inPatchFence = true
            return
          }
          inPatchFence = false
          return
        }

        const shouldParse = inPatchFence || trimmed.startsWith("{")
        if (!shouldParse) return

        lineIndex += 1
        const maybePatch = yield* parsePatchLine(trimmed, {
          chunk,
          lineIndex,
          streamId: "genifer-ai-adapter",
          context: { mode: "patch-stream" },
          onDecodeError: (error) =>
            Effect.sync(() => {
              if (quarantineEntries.length >= 32) return
              quarantineEntries.push({
                stage: error.stage,
                message: error.message,
                line: error.line,
                lineIndex: error.lineIndex ?? lineIndex,
                timestamp: error.timestamp,
                streamId: error.streamId,
                context: error.context,
              })
            }),
        })

        if (Option.isNone(maybePatch)) {
          parseIssues += 1
          return
        }

        const patch = maybePatch.value
        tree = yield* applyPatch(tree, patch)
        appliedPatches += 1
        onPatch?.(patch, tree, tree.size)

        // Per-element progress callback
        if (onComponent && patch.path.startsWith("/elements/")) {
          const elementKey = patch.path.slice("/elements/".length).split("/")[0]
          const patchValue = patch.value as Record<string, unknown> | undefined
          const elementType = typeof patchValue?.type === "string"
            ? patchValue.type
            : tree.getElementUnsafe(elementKey)?.type
          if (elementKey && elementType) {
            onComponent(elementKey, elementType)
          }
        }

        // Tree update callback only when element count grows
        const currentCount = tree.size
        if (currentCount > lastElementCount) {
          lastElementCount = currentCount
          onTreeUpdate?.(tree, currentCount)
        }
      })

    const stream = LanguageModel.streamText({
      system: systemPrompt,
      prompt: compiled,
    })

    yield* Stream.runForEach(stream, (part) =>
      Effect.gen(function* () {
        const p = part as any

        if (p.type === "text-delta" && p.delta) {
          const delta: string = p.delta
          rawOutput += delta
          chunks += 1
          onDelta?.(delta)

          buffer += delta
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            yield* processLine(line, delta)
          }
        }

        if (p.type === "finish") {
          usage = extractUsageFromResponse(p)
        }
      }),
    )

    // Flush trailing line
    if (buffer.trim()) {
      yield* processLine(buffer, buffer)
    }

    // Fallback: if model ignored patch protocol, attempt classic normalization.
    if (appliedPatches === 0 && rawOutput.trim().length > 0) {
      const normalized = yield* normalize(rawOutput).pipe(Effect.either)
      if (normalized._tag === "Right") {
        tree = normalized.right
        if (tree.size > lastElementCount) {
          lastElementCount = tree.size
          onTreeUpdate?.(tree, tree.size)
        }
      }
    }

    const hasRoot = tree.root.trim().length > 0
    const hasRootElement = hasRoot && Option.isSome(tree.getElement(tree.root))
    const denominator = Math.max(1, appliedPatches + parseIssues)
    const parseRate = parseIssues / denominator
    const qualityScore = clamp01(
      (hasRoot ? 0.35 : 0) +
      (tree.size > 0 ? 0.35 : 0) +
      (hasRootElement ? 0.2 : 0) +
      (appliedPatches > 0 ? 0.1 : 0) -
      Math.min(0.6, parseRate * 0.6),
    )

    const passed = hasRootElement && tree.size > 0 && qualityScore >= 0.55
    const failure = passed
      ? null
      : classifyPatchFailure({
          appliedPatches,
          parseIssues,
          hasRoot,
          hasRootElement,
          elementCount: tree.size,
        })

    return {
      tree,
      rawJson: serializeFlatSnapshot(tree),
      rawOutput,
      chunks,
      elementCount: tree.size,
      quarantineCount: parseIssues,
      quarantineEntries,
      repairCount: 0,
      qualityScore,
      passed,
      failure,
      extractionSource: inferExtractionSource(rawOutput),
      usage,
    }
  })
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))

const classifyPatchFailure = (params: {
  appliedPatches: number
  parseIssues: number
  hasRoot: boolean
  hasRootElement: boolean
  elementCount: number
}): ClassifiedFailure => {
  if (params.appliedPatches === 0) {
    return {
      failureClass: "empty_response",
      retryHint: "No valid JSONL patch lines were produced. Return newline-delimited patch objects only.",
    }
  }

  if (params.parseIssues > params.appliedPatches) {
    return {
      failureClass: "parse_error",
      retryHint: "Too many invalid patch lines. Emit one valid JSON object per line with op/path/value.",
    }
  }

  if (!params.hasRoot || !params.hasRootElement) {
    return {
      failureClass: "wrong_format",
      retryHint: "Set /root first and ensure /elements/<rootKey> exists.",
    }
  }

  if (params.elementCount === 0) {
    return {
      failureClass: "partial_tree",
      retryHint: "Tree is empty. Add /elements entries for requested components.",
    }
  }

  return {
    failureClass: "unknown",
    retryHint: "Return complete newline-delimited JSON patch operations with valid paths.",
  }
}

const inferExtractionSource = (raw: string): PromptExtractionSource => {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return "none"
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return "raw"
  if (trimmed.includes("```") && trimmed.includes("{")) return "fence"
  if (trimmed.includes("{") && trimmed.includes("}")) return "brace-slice"
  return "none"
}

type CatalogRuntime = {
  readonly schemas: ReadonlyMap<string, { readonly schema: unknown }>
}

const evaluateSteering = (
  tree: UITree,
  catalog: CatalogRuntime,
  extractionSource: PromptExtractionSource,
): PromptSteeringTrace => {
  const componentTypes = new Set<string>()
  const unknownTypes = new Set<string>()
  let requiredPropMissCount = 0

  for (const [, element] of tree.elements) {
    const type = element.type
    componentTypes.add(type)

    const entry = catalog.schemas.get(type)
    if (!entry) {
      unknownTypes.add(type)
      continue
    }

    const props = (element.props && typeof element.props === "object")
      ? (element.props as Record<string, unknown>)
      : {}

    try {
      const jsonSchema = JSONSchema.make(entry.schema) as Record<string, unknown>
      const required = Array.isArray(jsonSchema.required)
        ? (jsonSchema.required as ReadonlyArray<string>)
        : []
      for (const key of required) {
        if (!(key in props)) {
          requiredPropMissCount++
        }
      }
    } catch {
      // Complex schema fallback — skip required-prop analysis for this component.
    }
  }

  return {
    extractionSource,
    validated: true,
    elementCount: tree.size,
    componentTypes: Array.from(componentTypes),
    unknownTypeCount: unknownTypes.size,
    unknownTypes: Array.from(unknownTypes),
    requiredPropMissCount,
    slotViolationCount: 0,
  }
}

const steeringScoreFromTrace = (trace: PromptSteeringTrace): number => {
  const denom = Math.max(1, trace.elementCount)
  const unknownRate = trace.unknownTypeCount / denom
  const requiredMissRate = trace.requiredPropMissCount / denom
  const slotRate = trace.slotViolationCount / denom
  return clamp01(1 - (0.7 * unknownRate + 0.2 * requiredMissRate + 0.1 * slotRate))
}

const buildPromptEvalTrace = (params: {
  systemPrompt: string
  compiledPrompt: string
  userPrompt: string
  rawOutput: string
  durationMs: number
  qualityScore: number
  tree: UITree
  extractionSource: PromptExtractionSource
  usage: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
    reasoningTokens?: number
    cachedInputTokens?: number
  }
  catalog: CatalogRuntime
}): PromptEvalTrace => {
  const promptBlocks: PromptBlockTrace[] = [
    createPromptBlockTrace("system", params.systemPrompt),
    createPromptBlockTrace("compiled", params.compiledPrompt),
  ]

  const tokenomics = createTokenomicsTrace({
    systemPromptChars: params.systemPrompt.length,
    userPromptChars: params.userPrompt.length,
    outputChars: params.rawOutput.length,
    latencyMs: params.durationMs,
    inputTokens: params.usage.inputTokens,
    outputTokens: params.usage.outputTokens,
    totalTokens: params.usage.totalTokens,
    reasoningTokens: params.usage.reasoningTokens,
    cachedInputTokens: params.usage.cachedInputTokens,
  })

  const steering = evaluateSteering(params.tree, params.catalog, params.extractionSource)
  const steeringScore = steeringScoreFromTrace(steering)
  const utility = computePromptUtility({
    qualityScore: params.qualityScore,
    steeringScore,
    tokenomics,
  })

  return {
    promptHash: hashText(`${params.systemPrompt}\n\n${params.compiledPrompt}`),
    promptBlocks,
    tokenomics,
    steering,
    utility,
  }
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

    const catalog = yield* CatalogComponents

    // Build prompt from catalog
    const catalogPrompt = yield* getSystemPrompt
    const systemPrompt = buildSystemPromptForAdapter(options.interactive)
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
      const result = yield* streamAttempt(compiled, systemPrompt, options.onDelta, options.onTreeUpdate, options.onComponent, options.onPatch)

      if (result.passed || attempt === maxRetries) {
        // Record assistant response
        threads.addMessage("assistant", [
          { _tag: "ui-tree" as const, treeJson: result.rawJson, componentCount: result.elementCount },
        ])

        const durationMs = Date.now() - start
        const promptEval = buildPromptEvalTrace({
          systemPrompt,
          compiledPrompt: compiled,
          userPrompt: options.prompt,
          rawOutput: result.rawOutput,
          durationMs,
          qualityScore: result.qualityScore,
          tree: result.tree,
          extractionSource: result.extractionSource,
          usage: result.usage,
          catalog,
        })

        return {
          tree: result.tree,
          qualityScore: result.qualityScore,
          chunkCount: result.chunks,
          elementCount: result.elementCount,
          quarantineCount: result.quarantineCount,
          quarantineEntries: result.quarantineEntries,
          repairCount: result.repairCount,
          durationMs,
          rawJson: result.rawJson,
          attempts: attempt,
          retryFailures: failures,
          threadId: thread.id,
          promptEval,
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
 * The model returns newline-delimited patch operations against the current tree.
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

    // Serialize current tree as flat snapshot for patch-diff refinement
    const currentTreeJson = serializeFlatSnapshot(options.currentTree)

    const catalog = yield* CatalogComponents

    // Build refinement prompt
    const catalogPrompt = yield* getSystemPrompt
    const systemPrompt = buildSystemPromptForAdapter(options.interactive)
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
      const result = yield* streamAttempt(compiled, systemPrompt, options.onDelta, options.onTreeUpdate, options.onComponent, options.onPatch, options.currentTree)

      if (result.passed || attempt === maxRetries) {
        threads.addMessage("assistant", [
          { _tag: "ui-tree" as const, treeJson: result.rawJson, componentCount: result.elementCount },
        ])

        const durationMs = Date.now() - start
        const promptEval = buildPromptEvalTrace({
          systemPrompt,
          compiledPrompt: compiled,
          userPrompt: options.prompt,
          rawOutput: result.rawOutput,
          durationMs,
          qualityScore: result.qualityScore,
          tree: result.tree,
          extractionSource: result.extractionSource,
          usage: result.usage,
          catalog,
        })

        return {
          tree: result.tree,
          qualityScore: result.qualityScore,
          chunkCount: result.chunks,
          elementCount: result.elementCount,
          quarantineCount: result.quarantineCount,
          quarantineEntries: result.quarantineEntries,
          repairCount: result.repairCount,
          durationMs,
          rawJson: result.rawJson,
          attempts: attempt,
          retryFailures: failures,
          threadId: threads.getActiveThread()!.id,
          promptEval,
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

/** Serialize UITree as canonical flat snapshot { root, elements } */
function serializeFlatSnapshot(tree: UITree): string {
  const elements = Object.fromEntries(
    [...tree.elements].map(([key, element]) => [key, { ...element }]),
  )
  return JSON.stringify({ root: tree.root, elements }, null, 2)
}
