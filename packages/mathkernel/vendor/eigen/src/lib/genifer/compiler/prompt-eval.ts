import { FileSystem } from '@effect/platform'
import { Effect, Schema } from 'effect'

export const PromptEvalSurface = Schema.Literal('morphchat', 'toolcallview', 'harness')
export type PromptEvalSurface = typeof PromptEvalSurface.Type

export const PromptEvalSlice = Schema.Literal('core', 'adversarial')
export type PromptEvalSlice = typeof PromptEvalSlice.Type

export const PromptEvalVariantRole = Schema.Literal('champion', 'challenger')
export type PromptEvalVariantRole = typeof PromptEvalVariantRole.Type

export const PromptExtractionSource = Schema.Literal('raw', 'fence', 'brace-slice', 'none')
export type PromptExtractionSource = typeof PromptExtractionSource.Type

export const PromptBlockTrace = Schema.Struct({
  name: Schema.String,
  chars: Schema.Number,
  estimatedTokens: Schema.Number,
  sha256: Schema.String,
})
export type PromptBlockTrace = typeof PromptBlockTrace.Type

export const PromptTokenomicsTrace = Schema.Struct({
  inputTokens: Schema.optional(Schema.Number),
  outputTokens: Schema.optional(Schema.Number),
  totalTokens: Schema.optional(Schema.Number),
  reasoningTokens: Schema.optional(Schema.Number),
  cachedInputTokens: Schema.optional(Schema.Number),
  systemPromptChars: Schema.Number,
  userPromptChars: Schema.Number,
  outputChars: Schema.Number,
  estimatedInputTokens: Schema.Number,
  estimatedOutputTokens: Schema.Number,
  estimatedTotalTokens: Schema.Number,
  latencyMs: Schema.Number,
})
export type PromptTokenomicsTrace = typeof PromptTokenomicsTrace.Type

export const PromptSteeringTrace = Schema.Struct({
  extractionSource: PromptExtractionSource,
  validated: Schema.Boolean,
  elementCount: Schema.Number,
  componentTypes: Schema.Array(Schema.String),
  unknownTypeCount: Schema.Number,
  unknownTypes: Schema.Array(Schema.String),
  requiredPropMissCount: Schema.Number,
  slotViolationCount: Schema.Number,
})
export type PromptSteeringTrace = typeof PromptSteeringTrace.Type

export const PromptEvalWeights = Schema.Struct({
  quality: Schema.Number,
  steering: Schema.Number,
  cost: Schema.Number,
})
export type PromptEvalWeights = typeof PromptEvalWeights.Type

export const PromptUtilityScore = Schema.Struct({
  qualityScore: Schema.Number,
  steeringScore: Schema.Number,
  costIndex: Schema.Number,
  utilityScore: Schema.Number,
})
export type PromptUtilityScore = typeof PromptUtilityScore.Type

export class PromptVariantRunTrace extends Schema.TaggedClass<PromptVariantRunTrace>()(
  'PromptVariantRunTrace',
  {
    runId: Schema.String,
    timestamp: Schema.String,
    variantId: Schema.String,
    variantRole: PromptEvalVariantRole,
    surface: PromptEvalSurface,
    slice: PromptEvalSlice,
    promptId: Schema.String,
    promptText: Schema.String,
    model: Schema.String,
    promptHash: Schema.String,
    promptBlocks: Schema.Array(PromptBlockTrace),
    tokenomics: PromptTokenomicsTrace,
    steering: PromptSteeringTrace,
    utility: PromptUtilityScore,
    notes: Schema.optional(Schema.String),
  },
) {}

export const DefaultPromptEvalWeights: PromptEvalWeights = {
  quality: 0.45,
  steering: 0.40,
  cost: 0.15,
}

export const hashText = (text: string): string => {
  // Runtime-portable deterministic hash (FNV-1a 64-bit), avoids Node-only crypto imports.
  let hash = 0xcbf29ce484222325n
  const prime = 0x100000001b3n
  for (let i = 0; i < text.length; i++) {
    hash ^= BigInt(text.charCodeAt(i))
    hash = (hash * prime) & 0xffffffffffffffffn
  }
  return hash.toString(16).padStart(16, '0')
}

export const estimateTokensFromChars = (chars: number): number =>
  Math.max(1, Math.ceil(chars / 4))

export const createPromptBlockTrace = (
  name: string,
  content: string,
): PromptBlockTrace => ({
  name,
  chars: content.length,
  estimatedTokens: estimateTokensFromChars(content.length),
  sha256: hashText(content),
})

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return undefined
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))

export const extractUsageFromResponse = (response: unknown): {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  reasoningTokens?: number
  cachedInputTokens?: number
} => {
  const usage = (response as any)?.usage
  if (!usage || typeof usage !== 'object') return {}

  const inputTokens =
    toNumber((usage as any).inputTokens) ??
    toNumber((usage as any).promptTokens) ??
    toNumber((usage as any).input)

  const outputTokens =
    toNumber((usage as any).outputTokens) ??
    toNumber((usage as any).completionTokens) ??
    toNumber((usage as any).output)

  const totalTokens =
    toNumber((usage as any).totalTokens) ??
    (inputTokens !== undefined && outputTokens !== undefined
      ? inputTokens + outputTokens
      : undefined)

  const reasoningTokens =
    toNumber((usage as any).reasoningTokens) ??
    toNumber((usage as any).reasoning)

  const cachedInputTokens =
    toNumber((usage as any).cachedInputTokens) ??
    toNumber((usage as any).cacheRead)

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    reasoningTokens,
    cachedInputTokens,
  }
}

export const createTokenomicsTrace = (params: {
  systemPromptChars: number
  userPromptChars: number
  outputChars: number
  latencyMs: number
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  reasoningTokens?: number
  cachedInputTokens?: number
}): PromptTokenomicsTrace => {
  const estimatedInputTokens = estimateTokensFromChars(
    params.systemPromptChars + params.userPromptChars,
  )
  const estimatedOutputTokens = estimateTokensFromChars(params.outputChars)
  const estimatedTotalTokens = estimatedInputTokens + estimatedOutputTokens

  return {
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    totalTokens: params.totalTokens,
    reasoningTokens: params.reasoningTokens,
    cachedInputTokens: params.cachedInputTokens,
    systemPromptChars: params.systemPromptChars,
    userPromptChars: params.userPromptChars,
    outputChars: params.outputChars,
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedTotalTokens,
    latencyMs: params.latencyMs,
  }
}

export const computePromptUtility = (params: {
  qualityScore: number
  steeringScore: number
  tokenomics: PromptTokenomicsTrace
  weights?: PromptEvalWeights
  tokenBudget?: number
  latencyBudgetMs?: number
}): PromptUtilityScore => {
  const weights = params.weights ?? DefaultPromptEvalWeights
  const tokenBudget = params.tokenBudget ?? 8_000
  const latencyBudgetMs = params.latencyBudgetMs ?? 12_000

  const totalTokens =
    params.tokenomics.totalTokens ?? params.tokenomics.estimatedTotalTokens

  const tokenPressure = clamp01(totalTokens / tokenBudget)
  const latencyPressure = clamp01(params.tokenomics.latencyMs / latencyBudgetMs)
  const costIndex = clamp01(0.8 * tokenPressure + 0.2 * latencyPressure)

  const utilityScore =
    weights.quality * clamp01(params.qualityScore) +
    weights.steering * clamp01(params.steeringScore) -
    weights.cost * costIndex

  return {
    qualityScore: clamp01(params.qualityScore),
    steeringScore: clamp01(params.steeringScore),
    costIndex,
    utilityScore,
  }
}

export class PromptEvalTraceWriteError extends Schema.TaggedError<PromptEvalTraceWriteError>()(
  'PromptEvalTraceWriteError',
  {
    path: Schema.String,
    message: Schema.String,
  },
) {}

const directoryName = (path: string): string => {
  const normalized = path.replace(/\\/g, '/')
  const index = normalized.lastIndexOf('/')
  return index <= 0 ? '.' : normalized.slice(0, index)
}

export const appendPromptEvalTraceJsonl = (
  path: string,
  trace: PromptVariantRunTrace,
): Effect.Effect<void, PromptEvalTraceWriteError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const dir = directoryName(path)

    yield* fs.makeDirectory(dir, { recursive: true }).pipe(
      Effect.mapError(
        (error) =>
          new PromptEvalTraceWriteError({
            path,
            message: error instanceof Error ? error.message : String(error),
          }),
      ),
    )

    yield* fs.writeFileString(path, `${JSON.stringify(trace)}\n`, { flag: 'a' }).pipe(
      Effect.mapError(
        (error) =>
          new PromptEvalTraceWriteError({
            path,
            message: error instanceof Error ? error.message : String(error),
          }),
      ),
    )
  })
