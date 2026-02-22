/**
 * Questionnaire Extension for Pi
 *
 * Generic questionnaire engine with conditional branching.
 * Powered by Effect Schema (definitions) + effect-atom (state) + pi TUI (rendering).
 *
 * Three interfaces:
 * 1. Tool: LLM calls `questionnaire` with inline JSON spec
 * 2. Tool: LLM calls `query-surveys` to search past questionnaire results
 * 3. Library: Other extensions import createQuestionnaire()
 *
 * Persistence: Auto-saves completed questionnaires to S3-compatible storage
 * (MinIO/R2/S3) via BucketStore service. Respects `persist: false` opt-out.
 *
 * @module
 */

import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'
import { spawn } from 'node:child_process'
import * as fs from 'node:fs'
import { Type } from '@sinclair/typebox'
import { Effect, Schema, Layer } from 'effect'
import { S3Service } from '@effect-aws/client-s3'
import { Questionnaire, QuestionnaireResult } from './schema.ts'
import { createRenderer } from './renderer.ts'
import * as Engine from './engine.ts'
import {
  QuestionnaireStore,
  QuestionnaireStoreLive,
  BucketStore,
  InMemoryBucketStoreLive,
  BucketStoreConfig,
  S3BucketStoreLive,
  QueryFilter,
  PersistedResult,
  RichAnswerEntry,
} from './persistence/index.ts'
import {
  EmbeddingService,
  OpenAIEmbeddingLive,
  OllamaEmbeddingLive,
  NoOpEmbeddingLive,
  SemanticQueryEngine,
  SemanticQueryEngineLive,
  DuckDBClient,
  DuckDBClientMinIO,
  SemanticQuery,
} from './semantic/index.ts'

// Compound questionnaire imports
import {
  CompoundSpec,
  CompoundRun,
  CompoundQueryFilter,
  CompoundSpecError,
  CompoundRunError,
  CompoundValidationError,
  AccumulatorSnapshot,
} from './compound/schemas.ts'
import { hydrateGraph, validateGraph, toMermaid, getTopologicalOrder } from './compound/graph.ts'
import { CompoundStore, CompoundStoreLive } from './compound/CompoundStore.ts'
import { DAGScheduler, DAGSchedulerLive } from './compound/DAGScheduler.ts'
import { AccumulatorService, AccumulatorServiceLive } from './compound/AccumulatorService.ts'
import { RoutingEngine, RoutingEngineLive } from './compound/RoutingEngine.ts'

// =============================================================================
// Library API — for other extensions
// =============================================================================

export { Questionnaire, Question, QuestionOption, Answer, QuestionnaireResult } from './schema.ts'
export { createRenderer } from './renderer.ts'
export * as Engine from './engine.ts'
export * as Persistence from './persistence/index.ts'
export * as Semantic from './semantic/index.ts'

// Compound questionnaire system
export * as Compound from './compound/index.ts'

/**
 * Run a questionnaire in pi's TUI. Returns the result.
 *
 * Usage from another extension:
 * ```ts
 * import { runQuestionnaire, Questionnaire } from '../questionnaire/index.ts'
 *
 * const result = await runQuestionnaire(ctx, new Questionnaire({
 *   id: 'my-survey',
 *   title: 'Quick Survey',
 *   questions: [...],
 *   startId: 'q1',
 * }))
 * ```
 */
export async function runQuestionnaire(
  ctx: { hasUI: boolean; ui: any },
  spec: Questionnaire,
  options?: { dynamicResolver?: Engine.DynamicHookResolver },
): Promise<QuestionnaireResult> {
  if (!ctx.hasUI) {
    return new QuestionnaireResult({
      questionnaireId: spec.id,
      answers: [],
      cancelled: true,
      completedAt: new Date().toISOString(),
    })
  }

  return ctx.ui.custom<QuestionnaireResult>((tui: any, theme: any, _kb: any, done: any) => {
    return createRenderer({ tui, theme, done, spec, dynamicResolver: options?.dynamicResolver })
  })
}

// =============================================================================
// Dynamic microagent resolver (primary: pi-agent session)
// =============================================================================

type DynamicResolverCtx = { cwd: string }

interface DynamicRedactionPolicy {
  omitQuestionIds?: string[]
  omitNotes?: boolean
  omitHistory?: boolean
  omitHookPayload?: boolean
}

interface PiJsonRunResult {
  exitCode: number
  killed: boolean
  abortedBySignal: boolean
  stderr: string
  finalAssistantText: string
  assistantModel?: string
  assistantProvider?: string
  attempts: number
  durationMs: number
}

const PI_DYNAMIC_TOOL_NAME = 'pi-agent.dynamic-next'

function supportsDynamicTool(toolName: string): boolean {
  return toolName.toLowerCase().trim() === PI_DYNAMIC_TOOL_NAME
}

function defaultDynamicMetaPrompt(): string {
  return [
    'You are a questionnaire branch microagent running inside pi.',
    'Given questionnaire context and current answer, decide whether to inject a new next question or modify the upcoming question.',
    'Respect policyMode strictly. If policyMode is inject/modify, do not choose the other mode. If either, choose best fit.',
    'Return strict JSON only. Never include markdown fences or prose outside JSON.',
  ].join(' ')
}

const dynamicDecisionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    mode: { type: 'string', enum: ['inject', 'modify', 'none'] },
    note: { type: 'string' },
    targetId: { type: 'string' },
    question: { type: 'object', additionalProperties: true },
    patch: { type: 'object', additionalProperties: true },
    audit: { type: 'object', additionalProperties: true },
  },
  required: ['mode'],
} as const

function normalizeDecision(raw: unknown): Engine.DynamicHookDecision | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const mode = r.mode
  if (mode !== 'inject' && mode !== 'modify' && mode !== 'none') return null

  return {
    mode,
    note: typeof r.note === 'string' ? r.note : undefined,
    targetId: typeof r.targetId === 'string' ? r.targetId : undefined,
    question: r.question,
    patch: r.patch,
    audit: r.audit,
  }
}

function safeJsonParse(text: string): unknown {
  return JSON.parse(text)
}

function sanitizeIdPart(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120)
}

function buildRedactedContext(input: Engine.DynamicHookInvocation): {
  readonly redaction: DynamicRedactionPolicy
  readonly context: Record<string, unknown>
} {
  const payload = (typeof input.hook.payload === 'object' && input.hook.payload && !Array.isArray(input.hook.payload))
    ? input.hook.payload as Record<string, unknown>
    : {}

  const redaction = (typeof payload.redact === 'object' && payload.redact && !Array.isArray(payload.redact))
    ? payload.redact as DynamicRedactionPolicy
    : {}

  const omitSet = new Set((redaction.omitQuestionIds ?? []).map(String))

  const allAnswers: Record<string, unknown> = {}
  for (const [qid, answers] of Object.entries(input.allAnswers)) {
    if (omitSet.has(qid)) continue
    allAnswers[qid] = answers.map((a) => ({
      questionId: a.questionId,
      value: a.value,
      label: a.label,
      wasCustom: a.wasCustom,
      note: redaction.omitNotes ? undefined : a.note,
    }))
  }

  const currentAnswers = input.currentAnswers.map((a) => ({
    questionId: a.questionId,
    value: a.value,
    label: a.label,
    wasCustom: a.wasCustom,
    note: redaction.omitNotes ? undefined : a.note,
  }))

  const context = {
    questionnaire: {
      id: input.spec.id,
      title: input.spec.title,
      description: input.spec.description,
    },
    branch: {
      fromQuestionId: input.currentQuestion.id,
      fromPrompt: input.currentQuestion.prompt,
      fromType: input.currentQuestion.type,
      answerValues: input.answerValues,
      currentAnswers,
    },
    routing: {
      staticNextId: input.staticNextId,
      staticNextQuestion: input.staticNextQuestion,
      policyMode: input.hook.mode ?? 'inject',
      targetIdHint: input.hook.targetId,
    },
    history: redaction.omitHistory ? [] : input.history,
    allAnswers,
    hook: {
      hookId: input.hook.hookId,
      toolName: input.hook.toolName,
      payload: redaction.omitHookPayload ? undefined : input.hook.payload,
    },
  }

  return { redaction, context }
}

function buildDynamicPrompt(systemPrompt: string, contextPayload: unknown): string {
  return [
    systemPrompt,
    '',
    'Return JSON ONLY with this schema:',
    JSON.stringify(dynamicDecisionJsonSchema),
    '',
    'Input context JSON:',
    JSON.stringify(contextPayload),
    '',
    'Rules:',
    '- Output must be valid JSON object only.',
    '- mode must be one of inject|modify|none.',
    '- If mode=inject include `question` as a valid questionnaire Question shape.',
    '- If mode=modify include `patch`; optionally include `targetId`.',
    '- Respect policyMode strictly from routing.policyMode.',
  ].join('\n')
}

async function runPiJsonPrompt(
  cwd: string,
  sessionFile: string,
  model: string,
  provider: string | undefined,
  timeoutMs: number,
  prompt: string,
  signal?: AbortSignal,
): Promise<PiJsonRunResult> {
  const started = Date.now()

  const args = [
    '--mode', 'json',
    '-p',
    '--session', sessionFile,
    '--model', model,
    ...(provider ? ['--provider', provider] : []),
    prompt,
  ]

  return await new Promise<PiJsonRunResult>((resolve) => {
    const proc = spawn('pi', args, {
      cwd,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let killed = false
    let abortedBySignal = false
    let stderr = ''
    let buffer = ''
    let finalAssistantText = ''
    let assistantModel: string | undefined
    let assistantProvider: string | undefined

    const killProcess = () => {
      killed = true
      try {
        proc.kill('SIGKILL')
      } catch {
        // ignore
      }
    }

    const timeout = setTimeout(() => {
      killProcess()
    }, timeoutMs)

    const onAbort = () => {
      abortedBySignal = true
      killProcess()
    }

    if (signal) {
      if (signal.aborted) onAbort()
      else signal.addEventListener('abort', onAbort, { once: true })
    }

    const processLine = (line: string) => {
      if (!line.trim()) return
      let event: any
      try {
        event = JSON.parse(line)
      } catch {
        return
      }

      if (event.type === 'message_end' && event.message?.role === 'assistant') {
        const parts = Array.isArray(event.message.content) ? event.message.content : []
        const text = parts
          .map((p: any) => p?.type === 'text' ? String(p.text ?? '') : '')
          .join('')
        if (text.trim().length > 0) finalAssistantText = text
        assistantModel = typeof event.message.model === 'string' ? event.message.model : assistantModel
        assistantProvider = typeof event.message.provider === 'string' ? event.message.provider : assistantProvider
      }
    }

    proc.stdout.on('data', (data) => {
      buffer += data.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) processLine(line)
    })

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      clearTimeout(timeout)
      if (signal) signal.removeEventListener('abort', onAbort)
      if (buffer.trim()) processLine(buffer)
      resolve({
        exitCode: code ?? 1,
        killed,
        abortedBySignal,
        stderr,
        finalAssistantText,
        assistantModel,
        assistantProvider,
        attempts: 1,
        durationMs: Date.now() - started,
      })
    })

    proc.on('error', (err) => {
      clearTimeout(timeout)
      if (signal) signal.removeEventListener('abort', onAbort)
      resolve({
        exitCode: 1,
        killed,
        abortedBySignal,
        stderr: `${stderr}\n${String(err)}`,
        finalAssistantText,
        assistantModel,
        assistantProvider,
        attempts: 1,
        durationMs: Date.now() - started,
      })
    })
  })
}

function createDynamicResolver(ctx?: DynamicResolverCtx): Engine.DynamicHookResolver {
  const sessionByHook = new Map<string, string>()
  const runNamespace = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  return async (input, controls) => {
    if (!supportsDynamicTool(input.hook.toolName)) {
      return {
        mode: 'none',
        note: `unsupported toolName "${input.hook.toolName}"; expected "${PI_DYNAMIC_TOOL_NAME}"`,
        audit: {
          resolver: PI_DYNAMIC_TOOL_NAME,
          skipped: true,
          reason: 'unsupported_tool_name',
          configuredToolName: input.hook.toolName,
        },
      }
    }

    const hookPayload = (typeof input.hook.payload === 'object' && input.hook.payload && !Array.isArray(input.hook.payload))
      ? input.hook.payload as Record<string, unknown>
      : {}

    const model = input.hook.model ?? process.env.QUESTIONNAIRE_DYNAMIC_PI_MODEL ?? 'claude-sonnet-4-5'
    const provider = (typeof hookPayload.provider === 'string' && hookPayload.provider.trim().length > 0)
      ? hookPayload.provider.trim()
      : (process.env.QUESTIONNAIRE_DYNAMIC_PI_PROVIDER || undefined)
    const timeoutHint = typeof hookPayload.timeoutMs === 'number'
      ? hookPayload.timeoutMs
      : Number(process.env.QUESTIONNAIRE_DYNAMIC_TIMEOUT_MS ?? 10000)
    const timeoutMs = Math.max(1, Math.min(120_000, Math.round(timeoutHint)))
    const maxAttempts = 2 // initial try + one retry, then fallback

    const baseDir = process.env.QUESTIONNAIRE_DYNAMIC_PI_SESSION_DIR ?? `${process.env.HOME ?? '/tmp'}/.pi/agent/questionnaire-dynamic`
    fs.mkdirSync(baseDir, { recursive: true })
    const key = `${runNamespace}__${sanitizeIdPart(input.spec.id)}__${sanitizeIdPart(input.hook.hookId)}`
    const sessionFile = sessionByHook.get(key) ?? `${baseDir}/${key}.jsonl`
    sessionByHook.set(key, sessionFile)

    const { redaction, context } = buildRedactedContext(input)
    const systemPrompt = input.hook.metaPrompt ?? defaultDynamicMetaPrompt()
    const prompt = buildDynamicPrompt(systemPrompt, context)

    let lastError = 'unknown dynamic resolver error'
    const attemptsAudit: Array<Record<string, unknown>> = []

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const run = await runPiJsonPrompt(
        ctx?.cwd ?? process.cwd(),
        sessionFile,
        model,
        provider,
        timeoutMs,
        attempt === 1
          ? prompt
          : `${prompt}\n\nRetry note: previous output was invalid. Return STRICT JSON object only.`,
        controls?.signal,
      )

      let decision: Engine.DynamicHookDecision | null = null
      let parseError: string | undefined

      if (run.abortedBySignal) {
        attemptsAudit.push({
          attempt,
          requestedModel: model,
          requestedProvider: provider,
          assistantModel: run.assistantModel,
          assistantProvider: run.assistantProvider,
          timeoutMs,
          exitCode: run.exitCode,
          killed: run.killed,
          abortedBySignal: run.abortedBySignal,
          durationMs: run.durationMs,
          stderr: run.stderr,
          rawAssistantText: run.finalAssistantText,
          parseError: 'aborted_by_signal',
        })

        return {
          mode: 'none',
          note: 'dynamic microagent interrupted by operator; using static branch',
          audit: {
            resolver: PI_DYNAMIC_TOOL_NAME,
            sessionFile,
            model,
            provider,
            timeoutMs,
            interrupted: true,
            attempts: attemptsAudit,
            redaction,
          },
        }
      }

      if (run.exitCode !== 0 || run.killed) {
        parseError = run.killed
          ? `pi-agent timeout after ${timeoutMs}ms`
          : `pi-agent exit code ${run.exitCode}`
      } else if (!run.finalAssistantText.trim()) {
        parseError = 'pi-agent returned empty assistant text'
      } else {
        try {
          const parsed = safeJsonParse(run.finalAssistantText)
          decision = normalizeDecision(parsed)
          if (!decision) parseError = 'pi-agent returned JSON not matching decision schema'
        } catch (e) {
          parseError = e instanceof Error ? e.message : String(e)
        }
      }

      attemptsAudit.push({
        attempt,
        requestedModel: model,
        requestedProvider: provider,
        assistantModel: run.assistantModel,
        assistantProvider: run.assistantProvider,
        timeoutMs,
        exitCode: run.exitCode,
        killed: run.killed,
        abortedBySignal: run.abortedBySignal,
        durationMs: run.durationMs,
        stderr: run.stderr,
        rawAssistantText: run.finalAssistantText,
        parseError,
      })

      if (decision) {
        return {
          ...decision,
          audit: {
            ...(decision.audit ?? {}),
            resolver: PI_DYNAMIC_TOOL_NAME,
            sessionFile,
            model,
            provider,
            timeoutMs,
            attempts: attemptsAudit,
            redaction,
          },
        }
      }

      lastError = parseError ?? lastError
    }

    return {
      mode: 'none',
      note: `dynamic microagent failed after retry; falling back to static branch (${lastError})`,
      audit: {
        resolver: PI_DYNAMIC_TOOL_NAME,
        sessionFile,
        model,
        provider,
        timeoutMs,
        attempts: attemptsAudit,
        redaction,
      },
    }
  }
}

// =============================================================================
// Persistence Layer — built once per extension lifecycle
// =============================================================================

/**
 * Build the QuestionnaireStore layer.
 * Tries S3/MinIO first; falls back to in-memory if QUESTIONNAIRE_STORE_BACKEND
 * env var is set to 'memory'.
 */
function buildStoreLayer(): Layer.Layer<QuestionnaireStore> {
  const backend = process.env.QUESTIONNAIRE_STORE_BACKEND ?? 'minio'

  if (backend === 'memory') {
    return QuestionnaireStoreLive.pipe(
      Layer.provide(InMemoryBucketStoreLive),
    )
  }

  // S3/MinIO backend — read config from env with fallbacks
  const endpoint = process.env.QUESTIONNAIRE_S3_ENDPOINT ?? 'http://localhost:9000'
  const region = process.env.QUESTIONNAIRE_S3_REGION ?? 'us-east-1'
  const accessKeyId = process.env.QUESTIONNAIRE_S3_ACCESS_KEY ?? 'minioadmin'
  const secretAccessKey = process.env.QUESTIONNAIRE_S3_SECRET_KEY ?? 'minioadmin'
  const bucket = process.env.QUESTIONNAIRE_S3_BUCKET ?? 'questionnaires'

  const configLayer = BucketStoreConfig.Custom({
    endpoint,
    region,
    accessKeyId,
    secretAccessKey,
    bucket,
    forcePathStyle: true,
    keyPrefix: '',
  })

  /** @effect-aws S3Service layer for the configured endpoint */
  const s3ServiceLayer = S3Service.layer({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  })

  return QuestionnaireStoreLive.pipe(
    Layer.provide(S3BucketStoreLive),
    Layer.provide(configLayer),
    Layer.provide(s3ServiceLayer),
  )
}

/** Lazy singleton — initialized on first use */
let _storeLayer: Layer.Layer<QuestionnaireStore> | null = null
function getStoreLayer(): Layer.Layer<QuestionnaireStore> {
  if (!_storeLayer) _storeLayer = buildStoreLayer()
  return _storeLayer
}

/**
 * Build the CompoundStore layer — same BucketStore backend as QuestionnaireStore.
 * CompoundStoreLive depends on BucketStore, which we provide via the same
 * S3/MinIO config used by the regular questionnaire persistence.
 */
function buildCompoundStoreLayer(): Layer.Layer<CompoundStore> {
  const backend = process.env.QUESTIONNAIRE_STORE_BACKEND ?? 'minio'

  if (backend === 'memory') {
    return CompoundStoreLive.pipe(
      Layer.provide(InMemoryBucketStoreLive),
    )
  }

  // S3/MinIO backend — reuse same env vars as QuestionnaireStore
  const endpoint = process.env.QUESTIONNAIRE_S3_ENDPOINT ?? 'http://localhost:9000'
  const region = process.env.QUESTIONNAIRE_S3_REGION ?? 'us-east-1'
  const accessKeyId = process.env.QUESTIONNAIRE_S3_ACCESS_KEY ?? 'minioadmin'
  const secretAccessKey = process.env.QUESTIONNAIRE_S3_SECRET_KEY ?? 'minioadmin'
  const bucket = process.env.QUESTIONNAIRE_S3_BUCKET ?? 'questionnaires'

  const configLayer = BucketStoreConfig.Custom({
    endpoint,
    region,
    accessKeyId,
    secretAccessKey,
    bucket,
    forcePathStyle: true,
    keyPrefix: '',
  })

  const s3ServiceLayer = S3Service.layer({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  })

  return CompoundStoreLive.pipe(
    Layer.provide(S3BucketStoreLive),
    Layer.provide(configLayer),
    Layer.provide(s3ServiceLayer),
  )
}

/** Lazy singleton for compound store */
let _compoundStoreLayer: Layer.Layer<CompoundStore> | null = null
function getCompoundStoreLayer(): Layer.Layer<CompoundStore> {
  if (!_compoundStoreLayer) _compoundStoreLayer = buildCompoundStoreLayer()
  return _compoundStoreLayer
}

/**
 * Run a CompoundStore effect with the configured layer.
 * Same pattern as runStoreEffect — swallows errors gracefully.
 */
async function runCompoundStoreEffect<A>(
  effect: Effect.Effect<A, unknown, CompoundStore>,
): Promise<A | null> {
  try {
    return await Effect.runPromise(
      effect.pipe(
        Effect.provide(getCompoundStoreLayer()),
        Effect.scoped,
      ),
    )
  } catch (err) {
    console.error('[questionnaire/compound-persistence] Compound store operation failed:', err)
    return null
  }
}

// =============================================================================
// Embedding Layer — built once per extension lifecycle
// =============================================================================

/**
 * Load .env from the extension directory (co-located secrets).
 * Called once at module load — populates process.env before Config.redacted reads it.
 */
function loadExtensionEnv(): void {
  try {
    const fs = require('node:fs') as typeof import('node:fs')
    const path = require('node:path') as typeof import('node:path')
    const envPath = path.join(__dirname, '.env')
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        const value = trimmed.slice(eqIdx + 1).trim()
        if (!process.env[key]) process.env[key] = value
      }
    }
  } catch { /* .env is optional */ }
}
loadExtensionEnv()

/**
 * Build the EmbeddingService layer.
 * Provider selection via QUESTIONNAIRE_EMBEDDING_PROVIDER env var:
 *   'openai' (default) — key via Config.redacted("OPENAI_API_KEY"), never plaintext
 *   'ollama' — local Ollama via OpenAI-compat (localhost:11434)
 *   'noop' — zero vectors (testing / no API key)
 */
function buildEmbeddingLayer(): Layer.Layer<EmbeddingService> {
  const provider = process.env.QUESTIONNAIRE_EMBEDDING_PROVIDER ?? 'openai'

  switch (provider) {
    case 'ollama':
      return OllamaEmbeddingLive()
    case 'noop':
      return NoOpEmbeddingLive()
    case 'openai':
    default: {
      if (!process.env.OPENAI_API_KEY) {
        console.warn('[questionnaire/embedding] OPENAI_API_KEY not set, falling back to noop embeddings')
        return NoOpEmbeddingLive()
      }
      // Key flows through Config.redacted — masked in logs/traces
      return OpenAIEmbeddingLive()
    }
  }
}

let _embeddingLayer: Layer.Layer<EmbeddingService> | null = null
function getEmbeddingLayer(): Layer.Layer<EmbeddingService> {
  if (!_embeddingLayer) _embeddingLayer = buildEmbeddingLayer()
  return _embeddingLayer
}

/**
 * Run an EmbeddingService effect. Swallows errors gracefully.
 */
async function runEmbeddingEffect<A>(
  effect: Effect.Effect<A, unknown, EmbeddingService>,
): Promise<A | null> {
  try {
    return await Effect.runPromise(
      effect.pipe(Effect.provide(getEmbeddingLayer())),
    )
  } catch (err) {
    console.error('[questionnaire/embedding] Embedding operation failed:', err)
    return null
  }
}

/**
 * Run a QuestionnaireStore effect with the configured layer.
 * Swallows errors and logs them — persistence failures should never
 * break the questionnaire flow.
 */
async function runStoreEffect<A>(
  effect: Effect.Effect<A, unknown, QuestionnaireStore>,
): Promise<A | null> {
  try {
    return await Effect.runPromise(
      effect.pipe(
        Effect.provide(getStoreLayer()),
        Effect.scoped,
      ),
    )
  } catch (err) {
    console.error('[questionnaire/persistence] Store operation failed:', err)
    return null
  }
}

/**
 * Persist a completed questionnaire result.
 * Called automatically after completion (unless spec.persist === false).
 */
async function persistResult(
  spec: Questionnaire,
  result: QuestionnaireResult,
): Promise<void> {
  // Save spec (idempotent — creates new version only if content changed)
  await runStoreEffect(
    Effect.gen(function* () {
      const store = yield* QuestionnaireStore
      yield* store.saveSpec(spec, spec.tags)
    }),
  )

  // Get current spec version for the result reference
  const persistedSpec = await runStoreEffect(
    Effect.gen(function* () {
      const store = yield* QuestionnaireStore
      return yield* store.getSpec(spec.id)
    }),
  )

  const specVersion = persistedSpec?.version ?? 1

  // Generate embedding from answer text (non-blocking, best-effort)
  let embedding: ReadonlyArray<number> | null = null
  if (!result.cancelled) {
    const answerText = result.answers
      .map((a) => {
        const q = spec.questionMap.get(a.questionId)
        const label = q?.prompt ?? a.questionId
        return `${label}: ${a.label}${a.note ? ` (${a.note})` : ''}`
      })
      .join('. ')

    if (answerText.trim().length > 0) {
      embedding = await runEmbeddingEffect(
        Effect.gen(function* () {
          const svc = yield* EmbeddingService
          return yield* svc.embed(answerText)
        }),
      )
    }
  }

  // Save the result (with embedding if available)
  await runStoreEffect(
    Effect.gen(function* () {
      const store = yield* QuestionnaireStore
      yield* store.saveResult(spec, result, specVersion, embedding ?? undefined)
    }),
  )
}

// =============================================================================
// Extension — registers tools + commands
// =============================================================================

export default function questionnaireExtension(pi: ExtensionAPI) {
  // ─── Tool: questionnaire ───────────────────────────────────────────────

  pi.registerTool({
    name: 'questionnaire',
    label: 'Questionnaire',
    description: `Ask the user one or more questions with conditional branching.

Pass a JSON questionnaire spec with:
- id: unique identifier
- title: display title
- description: optional subtitle
- questions: array of { id, prompt, type, options?, allowOther?, manualEntry?, elaboration?, elaborationPrompt?, next?, nextHook? }
- startId: first question ID
- manualEntry: "always" | "allowOther" | "never" (optional)
- defaultElaborationPrompt: string (optional)
- persist: boolean (default true) — whether to save result to storage
- tags: string[] (optional) — categorization tags for querying later

Question types: "select", "input", "confirm", "multi-select"

Branching via "next" field:
- string: always go to that question ID
- object: map answer values to question IDs, "*" for default
- omit: end questionnaire after this question

Multi-select branching uses the first matching selected value; falls back to "*".

Dynamic inline next-question generation (optional):
- nextHook: { hookId, toolName, when?, mode?, targetId?, metaPrompt?, model?, temperature?, payload? }
- toolName: use "pi-agent.dynamic-next" (primary namespaced resolver)
- when: "*" | "value" | ["value", ...]  (branch discriminator)
- mode: "inject" | "modify" | "either"
- Inject mode can create a new runtime question as the immediate next step.
- Modify mode can patch the upcoming target question in-place.
- All dynamic mutations are preserved in result.dynamicTrace for replay/audit.

Example:
{
  "id": "scope-check",
  "title": "Scope Check",
  "startId": "q1",
  "manualEntry": "always",
  "tags": ["architecture", "decision"],
  "questions": [
    {
      "id": "q1",
      "prompt": "What area should we focus on?",
      "type": "select",
      "options": [
        { "value": "frontend", "label": "Frontend", "description": "React components" },
        { "value": "backend", "label": "Backend", "description": "API and services" }
      ],
      "elaboration": true,
      "elaborationPrompt": "Why this area?",
      "next": { "frontend": "q2_fe", "backend": "q2_be" }
    },
    {
      "id": "q2_fe",
      "prompt": "Which frontend concern?",
      "type": "select",
      "options": [
        { "value": "perf", "label": "Performance" },
        { "value": "a11y", "label": "Accessibility" }
      ]
    },
    {
      "id": "q2_be",
      "prompt": "Which backend concern?",
      "type": "select",
      "options": [
        { "value": "auth", "label": "Authentication" },
        { "value": "data", "label": "Data layer" }
      ]
    }
  ]
}`,
    parameters: Type.Object({
      spec: Type.String({ description: 'JSON questionnaire specification' }),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!ctx.hasUI) {
        return {
          content: [{ type: 'text', text: 'Error: questionnaire requires interactive mode' }],
          isError: true,
        }
      }

      // Parse and validate the spec
      let spec: Questionnaire
      try {
        const raw = JSON.parse(params.spec)
        spec = Schema.decodeUnknownSync(Questionnaire)(raw)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return {
          content: [{ type: 'text', text: `Invalid questionnaire spec: ${msg}` }],
          isError: true,
        }
      }

      // Run it (with dynamic branch microagent resolver)
      const result = await runQuestionnaire(ctx, spec, {
        dynamicResolver: createDynamicResolver(ctx),
      })

      // Auto-persist (unless opted out)
      if (spec.persist !== false) {
        await persistResult(spec, result)
      }

      if (result.cancelled) {
        return {
          content: [{ type: 'text', text: 'User cancelled the questionnaire.' }],
          details: Schema.encodeUnknownSync(QuestionnaireResult)(result),
        }
      }

      // Format answers for LLM
      const answerLines = result.answers.map(a => {
        const q = spec.questionMap.get(a.questionId)
        const label = q?.prompt ?? a.questionId
        const prefix = a.wasCustom ? '(wrote)' : '(selected)'
        const note = a.note ? ` — ${a.note}` : ''
        return `${label}: ${prefix} ${a.label}${note}`
      })

      return {
        content: [{ type: 'text', text: answerLines.join('\n') }],
        details: Schema.encodeUnknownSync(QuestionnaireResult)(result),
      }
    },
  })

  // ─── Tool: query-surveys ───────────────────────────────────────────────

  pi.registerTool({
    name: 'query-surveys',
    label: 'Query Surveys',
    description: `Search and retrieve past questionnaire results from the persistence store.

Supports five query dimensions (all optional, AND-combined):
- specId: Filter by questionnaire ID (exact match)
- dateFrom/dateTo: ISO-8601 date range (e.g., "2025-01-01")
- tags: Array of tags (AND logic — all must match)
- answerMatch: Object of { questionId: valuePattern } for answer content matching
- fullText: Free-text search across all questions and answers
- status: "completed" | "cancelled" | "all" (default: "all")
- limit: Max results (default: 50)
- offset: Pagination offset (default: 0)

Returns matching results with metadata, answer summaries, and pagination info.

Examples:
  { "specId": "scope-check" }
  { "tags": ["architecture"], "status": "completed" }
  { "fullText": "frontend", "dateFrom": "2025-01-01" }
  { "answerMatch": { "q1": "backend" } }
  {}  (returns all results)`,
    parameters: Type.Object({
      specId: Type.Optional(Type.String({ description: 'Filter by questionnaire ID' })),
      dateFrom: Type.Optional(Type.String({ description: 'Start date (ISO-8601)' })),
      dateTo: Type.Optional(Type.String({ description: 'End date (ISO-8601)' })),
      tags: Type.Optional(Type.Array(Type.String(), { description: 'Filter by tags (AND logic)' })),
      answerMatch: Type.Optional(Type.Record(Type.String(), Type.String(), { description: 'Filter by answer content { questionId: pattern }' })),
      fullText: Type.Optional(Type.String({ description: 'Full-text search across all content' })),
      status: Type.Optional(Type.String({ description: '"completed" | "cancelled" | "all"' })),
      limit: Type.Optional(Type.Number({ description: 'Max results (default 50)' })),
      offset: Type.Optional(Type.Number({ description: 'Pagination offset (default 0)' })),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      // Build the query filter
      let filter: QueryFilter
      try {
        filter = Schema.decodeUnknownSync(QueryFilter)({
          specId: params.specId,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          tags: params.tags,
          answerMatch: params.answerMatch,
          fullText: params.fullText,
          status: params.status ?? 'all',
          limit: params.limit ?? 50,
          offset: params.offset ?? 0,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return {
          content: [{ type: 'text', text: `Invalid query filter: ${msg}` }],
          isError: true,
        }
      }

      // Execute query
      const queryResult = await runStoreEffect(
        Effect.gen(function* () {
          const store = yield* QuestionnaireStore
          return yield* store.query(filter)
        }),
      )

      if (!queryResult) {
        return {
          content: [{ type: 'text', text: 'Query failed — persistence store may be unavailable. Check QUESTIONNAIRE_STORE_BACKEND env var.' }],
          isError: true,
        }
      }

      if (queryResult.total === 0) {
        return {
          content: [{ type: 'text', text: 'No matching survey results found.' }],
          details: { total: 0, filters: params },
        }
      }

      // Format results for LLM consumption
      const lines: string[] = [
        `Found ${queryResult.total} result(s) (showing ${queryResult.offset + 1}-${queryResult.offset + queryResult.results.length}):`,
        '',
      ]

      for (const r of queryResult.results) {
        const tagStr = r.tags.length > 0 ? ` [${r.tags.join(', ')}]` : ''
        const statusStr = r.cancelled ? '⊘ cancelled' : '✓ completed'
        lines.push(`── ${r.specId} (v${r.specVersion}) │ ${statusStr} │ ${r.completedAt}${tagStr}`)
        lines.push(`   ID: ${r.resultId}`)

        // Show answer summary — prefer rich (prompt-based) over bare IDs
        const richEntries = r.richAnswerIndex ? Object.entries(r.richAnswerIndex) : []
        if (richEntries.length > 0) {
          for (const [_qId, entry] of richEntries) {
            const rich = entry as { prompt?: string; label?: string; value?: string; wasCustom?: boolean; note?: string }
            const prompt = rich.prompt ?? _qId
            const label = rich.label ?? rich.value ?? ''
            const customTag = rich.wasCustom ? ' (custom)' : ''
            const noteTag = rich.note ? ` — ${rich.note}` : ''
            lines.push(`   ${prompt}: ${label}${customTag}${noteTag}`)
          }
        } else {
          const answerEntries = Object.entries(r.answerIndex)
          if (answerEntries.length > 0) {
            for (const [qId, val] of answerEntries) {
              lines.push(`   ${qId}: ${val}`)
            }
          }
        }
        lines.push('')
      }

      if (queryResult.hasMore) {
        lines.push(`... ${queryResult.total - queryResult.offset - queryResult.results.length} more results available (use offset: ${queryResult.offset + queryResult.limit})`)
      }

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        details: {
          total: queryResult.total,
          limit: queryResult.limit,
          offset: queryResult.offset,
          hasMore: queryResult.hasMore,
          results: queryResult.results.map((r: PersistedResult) => ({
            resultId: r.resultId,
            specId: r.specId,
            specVersion: r.specVersion,
            completedAt: r.completedAt,
            cancelled: r.cancelled,
            tags: r.tags,
            answerIndex: r.answerIndex,
            richAnswerIndex: r.richAnswerIndex,
          })),
        },
      }
    },
  })

  // ─── Tool: semantic-survey-search ──────────────────────────────────────

  pi.registerTool({
    name: 'semantic-survey-search',
    label: 'Semantic Survey Search',
    description: `Search past questionnaire results using natural language (semantic similarity).

Unlike query-surveys (exact match), this tool understands meaning. Ask it things like:
- "surveys where people expressed concern about performance"
- "responses mentioning frontend architecture decisions"
- "anyone who chose TypeScript over Python"

The query text is embedded into a vector and compared against stored answer embeddings.
Requires OPENAI_API_KEY for embedding generation (or Ollama for local).

Parameters:
- query: Natural language search query (required)
- topK: Max results to return (default: 10)
- minScore: Minimum similarity threshold 0-1 (default: 0.5)
- specId: Optional filter by questionnaire ID
- tags: Optional filter by tags
- dateFrom/dateTo: Optional date range filter`,
    parameters: Type.Object({
      query: Type.String({ description: 'Natural language search query' }),
      topK: Type.Optional(Type.Number({ description: 'Max results (default 10)' })),
      minScore: Type.Optional(Type.Number({ description: 'Min similarity 0-1 (default 0.5)' })),
      specId: Type.Optional(Type.String({ description: 'Filter by questionnaire ID' })),
      tags: Type.Optional(Type.Array(Type.String(), { description: 'Filter by tags' })),
      dateFrom: Type.Optional(Type.String({ description: 'Start date (ISO-8601)' })),
      dateTo: Type.Optional(Type.String({ description: 'End date (ISO-8601)' })),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      // Build layers: SemanticQueryEngine needs DuckDBClient + EmbeddingService
      const embeddingLayer = getEmbeddingLayer()
      const duckdbLayer = DuckDBClientMinIO
      const engineLayer = SemanticQueryEngineLive.pipe(
        Layer.provide(embeddingLayer),
        Layer.provide(duckdbLayer),
      )

      try {
        const rawFilters = Object.fromEntries(
          Object.entries({
            specId: params.specId,
            tags: params.tags,
            dateFrom: params.dateFrom,
            dateTo: params.dateTo,
          }).filter(([, value]) => value !== undefined),
        )

        const semanticQuery = Schema.decodeUnknownSync(SemanticQuery)({
          query: params.query,
          topK: params.topK ?? 10,
          minScore: params.minScore ?? 0.5,
          ...(Object.keys(rawFilters).length > 0 ? { filters: rawFilters } : {}),
        })

        const searchResult = await Effect.runPromise(
          Effect.gen(function* () {
            const engine = yield* SemanticQueryEngine
            return yield* engine.search(semanticQuery)
          }).pipe(
            Effect.provide(engineLayer),
            Effect.scoped,
          ),
        )

        if (searchResult.matches.length === 0) {
          return {
            content: [{
              type: 'text',
              text: `No semantically similar results found for "${params.query}" (scanned ${searchResult.totalScanned} results in ${searchResult.executionMs}ms)`,
            }],
            details: { totalScanned: searchResult.totalScanned, executionMs: searchResult.executionMs },
          }
        }

        const lines: string[] = [
          `Found ${searchResult.matches.length} semantically similar result(s) (scanned ${searchResult.totalScanned} in ${searchResult.executionMs}ms):`,
          '',
        ]

        for (const match of searchResult.matches) {
          const tagStr = match.tags.length > 0 ? ` [${match.tags.join(', ')}]` : ''
          const statusStr = match.cancelled ? '⊘ cancelled' : '✓ completed'
          const scoreStr = `${(match.score * 100).toFixed(1)}%`
          lines.push(`── ${match.specId} │ ${statusStr} │ similarity: ${scoreStr}${tagStr}`)
          lines.push(`   ${match.completedAt} │ ID: ${match.resultId}`)
          // Show answer summary
          const rawAnswerIndex = match.answerIndex as unknown
          let answerEntries: Array<[string, unknown]> = []

          if (rawAnswerIndex instanceof Map) {
            answerEntries = [...rawAnswerIndex.entries()].map(([key, value]) => [String(key), value])
          } else if (rawAnswerIndex && typeof rawAnswerIndex === 'object') {
            answerEntries = Object.entries(rawAnswerIndex as Record<string, unknown>)
            if (
              answerEntries.length === 0
              && typeof (rawAnswerIndex as { [Symbol.iterator]?: unknown })[Symbol.iterator] === 'function'
            ) {
              for (const pair of rawAnswerIndex as Iterable<unknown>) {
                if (Array.isArray(pair) && pair.length >= 2) {
                  answerEntries.push([String(pair[0]), pair[1]])
                }
              }
            }
          }

          if (answerEntries.length === 0) {
            const persisted = await runStoreEffect(
              Effect.gen(function* () {
                const store = yield* QuestionnaireStore
                return yield* store.getResult(match.specId, match.resultId)
              }),
            )

            if (persisted?.answerIndex && Object.keys(persisted.answerIndex).length > 0) {
              answerEntries = Object.entries(persisted.answerIndex)
            }
          }

          if (answerEntries.length > 0) {
            for (const [qId, val] of answerEntries) {
              const displayVal = (() => {
                if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
                  return String(val)
                }
                if (val && typeof val === 'object') {
                  const maybeAnswer = val as { value?: unknown; label?: unknown; questionId?: unknown }
                  if (typeof maybeAnswer.value === 'string') return maybeAnswer.value
                  if (typeof maybeAnswer.label === 'string') return maybeAnswer.label
                  if (typeof maybeAnswer.questionId === 'string') return maybeAnswer.questionId
                  try {
                    return JSON.stringify(val)
                  } catch {
                    return String(val)
                  }
                }
                return ''
              })()
              lines.push(`   ${qId}: ${displayVal}`)
            }
          } else if (typeof match.matchedText === 'string' && match.matchedText.trim().length > 0) {
            const summary = match.matchedText.replace(/\s+/g, ' ').trim()
            lines.push(`   summary: ${summary}`)
          }
          lines.push('')
        }

        return {
          content: [{ type: 'text', text: lines.join('\n') }],
          details: {
            query: params.query,
            totalScanned: searchResult.totalScanned,
            executionMs: searchResult.executionMs,
            matches: searchResult.matches,
          },
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return {
          content: [{ type: 'text', text: `Semantic search failed: ${msg}\n\nEnsure OPENAI_API_KEY is set and MinIO is running.` }],
          isError: true,
        }
      }
    },
  })

  // ─── Tool: patch-surveys ─────────────────────────────────────────────

  pi.registerTool({
    name: 'patch-surveys',
    label: 'Patch Surveys',
    description: `Backfill richAnswerIndex on existing survey results that were saved before the enrichment feature.

Iterates over persisted results, checks if richAnswerIndex is populated, and if not, rebuilds it
from the spec's questionMap + the result's answers. Existing enriched results are skipped.

Parameters:
- specId: Optional filter — only patch results for this questionnaire ID
- dryRun: If true, report what would be patched without writing (default: false)

Returns a summary of patched/skipped/failed counts.`,
    parameters: Type.Object({
      specId: Type.Optional(Type.String({ description: 'Only patch results for this spec ID' })),
      dryRun: Type.Optional(Type.Boolean({ description: 'Preview mode — no writes (default: false)' })),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const dryRun = params.dryRun ?? false
      const filterSpecId = params.specId

      const summary = await runStoreEffect(
        Effect.gen(function* () {
          const store = yield* QuestionnaireStore

          // List all specs (or filter to one)
          const catalog = yield* store.listSpecs()
          const targetSpecs = filterSpecId
            ? catalog.specs.filter(s => s.specId === filterSpecId)
            : catalog.specs

          let patched = 0
          let skipped = 0
          let failed = 0
          let noSpec = 0
          const details: Array<{ specId: string; resultId: string; action: string }> = []

          for (const specSummary of targetSpecs) {
            // Load latest spec version and decode into Questionnaire
            const persistedSpec = yield* store.getSpec(specSummary.specId)
            if (!persistedSpec) {
              noSpec++
              continue
            }

            let questionnaire: Questionnaire
            try {
              questionnaire = Schema.decodeUnknownSync(Questionnaire)(persistedSpec.spec)
            } catch {
              // Can't decode spec — skip all its results
              noSpec++
              details.push({ specId: specSummary.specId, resultId: '*', action: 'spec-decode-failed' })
              continue
            }

            // List all results for this spec
            const results = yield* store.listResults(specSummary.specId)

            for (const result of results) {
              // Check if richAnswerIndex already has entries
              const existingRich = result.richAnswerIndex ?? {}
              if (Object.keys(existingRich).length > 0) {
                skipped++
                details.push({ specId: specSummary.specId, resultId: result.resultId, action: 'skipped-already-enriched' })
                continue
              }

              // Decode the result body to get answers
              let qResult: QuestionnaireResult
              try {
                qResult = Schema.decodeUnknownSync(QuestionnaireResult)(result.result)
              } catch {
                failed++
                details.push({ specId: specSummary.specId, resultId: result.resultId, action: 'result-decode-failed' })
                continue
              }

              // Build richAnswerIndex from spec questionMap + answers
              const richAnswerIndex: Record<string, RichAnswerEntry> = {}
              for (const answer of qResult.answers) {
                const question = questionnaire.questionMap.get(answer.questionId)
                richAnswerIndex[answer.questionId] = new RichAnswerEntry({
                  prompt: question?.prompt ?? answer.questionId,
                  value: answer.value,
                  label: answer.label,
                  ...(answer.wasCustom ? { wasCustom: answer.wasCustom } : {}),
                  ...(answer.note ? { note: answer.note } : {}),
                })
              }

              if (Object.keys(richAnswerIndex).length === 0) {
                skipped++
                details.push({ specId: specSummary.specId, resultId: result.resultId, action: 'skipped-no-answers' })
                continue
              }

              if (!dryRun) {
                yield* store.updateResult(
                  specSummary.specId,
                  result.resultId,
                  (existing) => new PersistedResult({
                    ...existing,
                    richAnswerIndex,
                  }),
                )
              }

              patched++
              details.push({ specId: specSummary.specId, resultId: result.resultId, action: dryRun ? 'would-patch' : 'patched' })
            }
          }

          return { patched, skipped, failed, noSpec, dryRun, details }
        }),
      )

      if (!summary) {
        return {
          content: [{ type: 'text', text: 'Patch failed — persistence store may be unavailable.' }],
          isError: true,
        }
      }

      const modeLabel = summary.dryRun ? '(DRY RUN) ' : ''
      const lines: string[] = [
        `${modeLabel}Patch Summary:`,
        `  ${summary.dryRun ? 'Would patch' : 'Patched'}: ${summary.patched}`,
        `  Skipped (already enriched): ${summary.skipped}`,
        `  Failed (decode errors): ${summary.failed}`,
        ...(summary.noSpec > 0 ? [`  Specs not found/decodable: ${summary.noSpec}`] : []),
        '',
      ]

      if (summary.details.length > 0 && summary.details.length <= 50) {
        lines.push('Details:')
        for (const d of summary.details) {
          lines.push(`  ${d.specId} / ${d.resultId}: ${d.action}`)
        }
      } else if (summary.details.length > 50) {
        lines.push(`(${summary.details.length} results processed — details truncated)`)
      }

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        details: summary,
      }
    },
  })

  // ─── Tool: compound-questionnaire ──────────────────────────────────────

  pi.registerTool({
    name: 'compound-questionnaire',
    label: 'Compound Questionnaire',
    description: `Define and validate a compound questionnaire — a DAG of linked surveys.

Pass a JSON compound spec with:
- id: unique compound spec identifier
- title: display title
- nodes: array of { nodeId, specId (ref to existing survey), label?, overrides?, parameters?, preamble? }
- edges: array of { from, to, routing?, label? }
- startNodeIds: array of entry point node IDs
- tags: optional categorization tags

Routing strategies per edge:
- omit routing: unconditional (always follow)
- StaticBranch: { _tag: "StaticBranch", branchMap: { "answer_value": ["next_nodeId"] } }
- PredicateGuard: { _tag: "PredicateGuard", expression: "...", trueTargets: [...], falseTargets: [...] }
- DynamicHookRoute: { _tag: "DynamicHookRoute", hookId: "...", toolName: "..." }

Returns: validated spec, topological execution order, Mermaid diagram, and any validation issues.
This tool validates and saves the spec — actual execution requires the /compound-survey command.`,
    parameters: Type.Object({
      spec: Type.String({ description: 'JSON compound questionnaire specification' }),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      // Parse and validate
      let spec: CompoundSpec
      try {
        const raw = JSON.parse(params.spec)
        spec = Schema.decodeUnknownSync(CompoundSpec)(raw)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return {
          content: [{ type: 'text', text: `Invalid compound spec: ${msg}` }],
          isError: true,
        }
      }

      // Hydrate graph and validate
      let topoOrder: readonly string[]
      let mermaid: string
      let issues: readonly string[]
      try {
        const graph = hydrateGraph(spec)
        issues = validateGraph(spec, graph)
        topoOrder = getTopologicalOrder(graph)
        mermaid = toMermaid(graph)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return {
          content: [{ type: 'text', text: `Graph validation error: ${msg}` }],
          isError: true,
        }
      }

      // Best-effort persistence — save spec to compound store
      let savedVersion: number | null = null
      const persistedSpec = await runCompoundStoreEffect(
        Effect.gen(function* () {
          const store = yield* CompoundStore
          return yield* store.saveCompoundSpec(spec)
        }),
      )
      if (persistedSpec) {
        savedVersion = persistedSpec.version
      }

      // ── If no UI, return validation-only results ──────────────────────
      if (!ctx.hasUI) {
        const issueText = issues.length > 0
          ? `\n\n⚠ Validation issues:\n${issues.map(i => `  - ${i}`).join('\n')}`
          : '\n\n✓ No validation issues'
        const savedText = savedVersion !== null
          ? `\nPersisted: v${savedVersion}`
          : '\nPersistence: skipped (store unavailable)'
        return {
          content: [{
            type: 'text',
            text: [
              `Compound Spec: ${spec.title} (${spec.id})`,
              `Nodes: ${spec.nodes.length}, Edges: ${spec.edges.length}`,
              `Start nodes: ${spec.startNodeIds.join(', ')}`,
              `Topological order: ${topoOrder.join(' → ')}`,
              savedText,
              issueText,
              '\nMermaid Diagram:',
              '```mermaid',
              mermaid,
              '```',
            ].join('\n'),
          }],
          details: {
            specId: spec.id,
            nodeCount: spec.nodes.length,
            edgeCount: spec.edges.length,
            topologicalOrder: topoOrder,
            issues,
            mermaid,
            savedVersion,
          },
        }
      }

      // ── Pre-flight: resolve all referenced survey specs ───────────────
      const surveySpecCache = new Map<string, Questionnaire>()
      const missingSpecs: string[] = []

      for (const node of spec.nodes) {
        const specId = node.specId as string
        if (surveySpecCache.has(specId)) continue

        // Try loading from QuestionnaireStore
        const persisted = await runStoreEffect(
          Effect.gen(function* () {
            const store = yield* QuestionnaireStore
            return yield* store.getSpec(specId)
          }),
        )

        if (persisted?.spec) {
          try {
            const decoded = Schema.decodeUnknownSync(Questionnaire)(persisted.spec)
            surveySpecCache.set(specId, decoded)
          } catch {
            missingSpecs.push(`${specId} (stored but invalid)`)
          }
        } else {
          missingSpecs.push(specId)
        }
      }

      if (missingSpecs.length > 0) {
        return {
          content: [{
            type: 'text',
            text: [
              `Cannot execute compound spec — missing referenced survey specs:`,
              ...missingSpecs.map(s => `  ✗ ${s}`),
              '',
              'These survey specs must be saved first (via the questionnaire tool with persist: true).',
              '',
              `Compound spec "${spec.title}" is valid and persisted (v${savedVersion ?? '?'}).`,
              `Topological order: ${topoOrder.join(' → ')}`,
            ].join('\n'),
          }],
          details: {
            specId: spec.id,
            topologicalOrder: topoOrder,
            missingSpecs,
            mermaid,
            savedVersion,
            validationOnly: true,
          },
        }
      }

      // ── Execute: run the DAG scheduler ────────────────────────────────
      const nodeAnswerSummaries: Array<{ nodeId: string; label: string; answers: string[] }> = []

      try {
        // Build the executeSurvey callback — bridges DAGScheduler to runQuestionnaire
        const executeSurvey = (
          nodeId: string,
          specId: string,
          _accumulator: AccumulatorSnapshot,
        ) =>
          Effect.tryPromise({
            try: async () => {
              const surveySpec = surveySpecCache.get(specId)!

              // Find node definition for preamble/overrides
              const nodeDef = spec.nodes.find(n => (n.nodeId as string) === nodeId)
              const nodeLabel = nodeDef?.label ?? nodeId

              // If node has a preamble, show it as the spec description
              let effectiveSpec = surveySpec
              if (nodeDef?.preamble) {
                effectiveSpec = Schema.decodeUnknownSync(Questionnaire)({
                  ...Schema.encodeUnknownSync(Questionnaire)(surveySpec),
                  description: `[${nodeLabel}] ${nodeDef.preamble}`,
                })
              }

              // Run the survey interactively
              const result = await runQuestionnaire(ctx, effectiveSpec, {
                dynamicResolver: createDynamicResolver(ctx),
              })

              if (result.cancelled) {
                throw new Error(`User cancelled survey at node "${nodeLabel}"`)
              }

              // Persist individual survey result
              if (effectiveSpec.persist !== false) {
                await persistResult(effectiveSpec, result)
              }

              // Extract answers as Record<string, unknown> for the accumulator
              const answers: Record<string, unknown> = {}
              const answerLines: string[] = []
              for (const a of result.answers) {
                answers[a.questionId] = a.value
                const q = effectiveSpec.questionMap.get(a.questionId)
                const label = q?.prompt ?? a.questionId
                const prefix = a.wasCustom ? '(wrote)' : '(selected)'
                const note = a.note ? ` — ${a.note}` : ''
                answerLines.push(`${label}: ${prefix} ${a.label}${note}`)
              }

              nodeAnswerSummaries.push({
                nodeId,
                label: nodeLabel,
                answers: answerLines,
              })

              return {
                resultId: `${specId}/${result.completedAt}`,
                answers,
              }
            },
            catch: (err) =>
              new CompoundRunError({
                message: err instanceof Error ? err.message : String(err),
                specId: spec.id as string,
              }),
          })

        // Build layers for DAG execution
        const dagLayer = Layer.mergeAll(
          AccumulatorServiceLive,
          RoutingEngineLive,
        )

        // Execute the compound pipeline
        const compoundRun = await Effect.runPromise(
          Effect.gen(function* () {
            const scheduler = yield* DAGScheduler
            return yield* scheduler.execute(spec, executeSurvey)
          }).pipe(
            Effect.provide(DAGSchedulerLive),
            Effect.provide(dagLayer),
          ),
        )

        // Persist the compound run
        await runCompoundStoreEffect(
          Effect.gen(function* () {
            const store = yield* CompoundStore
            yield* store.saveCompoundRun(compoundRun)
          }),
        )

        // Format output for LLM
        const statusEmoji = compoundRun.status === 'completed' ? '✓' : '✗'
        const summaryLines = nodeAnswerSummaries.flatMap(n => [
          `\n── ${n.label} (${n.nodeId}) ──`,
          ...n.answers,
        ])

        return {
          content: [{
            type: 'text',
            text: [
              `${statusEmoji} Compound Run: ${spec.title} (${spec.id})`,
              `Run ID: ${compoundRun.runId}`,
              `Status: ${compoundRun.status}`,
              `Path: ${(compoundRun.pathTaken as readonly string[]).join(' → ')}`,
              `Nodes executed: ${nodeAnswerSummaries.length}/${spec.nodes.length}`,
              ...summaryLines,
              compoundRun.error ? `\nError: ${compoundRun.error}` : '',
            ].join('\n'),
          }],
          details: Schema.encodeUnknownSync(CompoundRun)(compoundRun),
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)

        // Even on failure, show what we collected
        const partialSummary = nodeAnswerSummaries.length > 0
          ? '\n\nPartial results before failure:' +
            nodeAnswerSummaries.flatMap(n => [
              `\n── ${n.label} (${n.nodeId}) ──`,
              ...n.answers,
            ]).join('\n')
          : ''

        return {
          content: [{
            type: 'text',
            text: `Compound execution failed: ${msg}${partialSummary}`,
          }],
          isError: true,
        }
      }
    },
  })

  // ─── Tool: query-compound-surveys ──────────────────────────────────────

  pi.registerTool({
    name: 'query-compound-surveys',
    label: 'Query Compound Surveys',
    description: `Query compound questionnaire runs with topology-aware filters.

Parameters (all optional, AND-combined):
- specId: compound spec ID
- runId: specific run ID
- dateFrom/dateTo: ISO-8601 date range
- tags: array of tags (AND logic)
- status: "pending" | "running" | "completed" | "failed" | "cancelled"
- pathContains: array of nodeIds that must appear in the execution path
- limit/offset: pagination (default: 50/0)

Returns matching compound runs with their execution paths, node results, and Mermaid diagrams.`,
    parameters: Type.Object({
      specId: Type.Optional(Type.String({ description: 'Compound spec ID' })),
      runId: Type.Optional(Type.String({ description: 'Specific run ID' })),
      dateFrom: Type.Optional(Type.String({ description: 'Start date (ISO-8601)' })),
      dateTo: Type.Optional(Type.String({ description: 'End date (ISO-8601)' })),
      tags: Type.Optional(Type.Array(Type.String(), { description: 'Filter by tags (AND logic)' })),
      status: Type.Optional(Type.String({ description: '"completed" | "failed" | "cancelled" | "pending" | "running"' })),
      pathContains: Type.Optional(Type.Array(Type.String(), { description: 'Node IDs that must be in path' })),
      limit: Type.Optional(Type.Number({ description: 'Max results (default 50)' })),
      offset: Type.Optional(Type.Number({ description: 'Pagination offset (default 0)' })),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      // Build the query filter
      let filter: CompoundQueryFilter
      try {
        filter = Schema.decodeUnknownSync(CompoundQueryFilter)({
          specId: params.specId,
          runId: params.runId,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          tags: params.tags,
          status: params.status,
          pathContains: params.pathContains,
          limit: params.limit ?? 50,
          offset: params.offset ?? 0,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return {
          content: [{ type: 'text', text: `Invalid query filter: ${msg}` }],
          isError: true,
        }
      }

      // Execute query against CompoundStore
      const runs = await runCompoundStoreEffect(
        Effect.gen(function* () {
          const store = yield* CompoundStore
          return yield* store.queryCompoundRuns(filter)
        }),
      )

      if (!runs) {
        return {
          content: [{ type: 'text', text: 'Query failed — compound store may be unavailable. Check QUESTIONNAIRE_STORE_BACKEND env var.' }],
          isError: true,
        }
      }

      if (runs.length === 0) {
        return {
          content: [{ type: 'text', text: 'No matching compound survey runs found.' }],
          details: { total: 0, filters: params },
        }
      }

      // Format results for LLM consumption
      const lines: string[] = [
        `Found ${runs.length} compound run(s):`,
        '',
      ]

      for (const run of runs) {
        const tagStr = run.tags.length > 0 ? ` [${run.tags.join(', ')}]` : ''
        const statusIcon = run.status === 'completed' ? '✓' : run.status === 'failed' ? '✗' : run.status === 'cancelled' ? '⊘' : '◌'
        lines.push(`── ${run.specId} / ${run.runId} │ ${statusIcon} ${run.status} │ ${run.startedAt}${tagStr}`)

        // Show execution path
        if (run.pathTaken.length > 0) {
          lines.push(`   Path: ${run.pathTaken.join(' → ')}`)
        }

        // Show node execution summary
        const completedNodes = run.nodeExecutions.filter(ne => ne.status === 'completed').length
        const failedNodes = run.nodeExecutions.filter(ne => ne.status === 'failed').length
        const totalNodes = run.nodeExecutions.length
        lines.push(`   Nodes: ${completedNodes}/${totalNodes} completed${failedNodes > 0 ? `, ${failedNodes} failed` : ''}`)

        // Show error if failed
        if (run.error) {
          lines.push(`   Error: ${run.error}`)
        }

        // Show mermaid diagram if available
        if (run.mermaidDiagram) {
          lines.push(`   Diagram available (use details for full Mermaid)`)
        }

        lines.push('')
      }

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        details: {
          total: runs.length,
          filters: params,
          runs: runs.map(r => ({
            runId: r.runId,
            specId: r.specId,
            specVersion: r.specVersion,
            status: r.status,
            startedAt: r.startedAt,
            completedAt: r.completedAt,
            pathTaken: r.pathTaken,
            nodeCount: r.nodeExecutions.length,
            tags: r.tags,
            error: r.error,
            mermaidDiagram: r.mermaidDiagram,
          })),
        },
      }
    },
  })

  // NOTE: /compound-survey command registration requires interactive TUI context
  // which is Phase 5. Skipped for now — compound-questionnaire tool handles
  // spec validation + persistence. Execution via TUI deferred to Phase 5.

  // ─── Command: /survey ──────────────────────────────────────────────────

  pi.registerCommand('survey', {
    description: 'Run a questionnaire from a JSON file (arg: path)',
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify('Survey requires interactive mode', 'warning')
        return
      }

      const filePath = args?.trim()
      if (!filePath) {
        ctx.ui.notify('Usage: /survey <path-to-questionnaire.json>', 'warning')
        return
      }

      try {
        const fs = await import('node:fs')
        const content = fs.readFileSync(filePath, 'utf-8')
        const raw = JSON.parse(content)
        const spec = Schema.decodeUnknownSync(Questionnaire)(raw)
        const result = await runQuestionnaire(ctx, spec, {
          dynamicResolver: createDynamicResolver(ctx),
        })

        // Auto-persist
        if (spec.persist !== false) {
          await persistResult(spec, result)
        }

        if (result.cancelled) {
          ctx.ui.notify('Survey cancelled', 'info')
        } else {
          const summary = result.answers
            .map(a => `${a.questionId}: ${a.label}${a.note ? ` (${a.note})` : ''}`)
            .join(', ')
          ctx.ui.notify(`Survey complete: ${summary}`, 'success')
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        ctx.ui.notify(`Survey error: ${msg}`, 'error')
      }
    },
  })
}
