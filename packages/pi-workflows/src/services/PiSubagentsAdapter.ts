import { Effect, Layer } from 'effect'

import { WorkflowAdapterError } from '../domain/errors'
import { SubagentAdapter } from './SubagentAdapter'
import type { AgentRequest, AgentResponse } from './types'

export const PROMPT_TEMPLATE_SUBAGENT_REQUEST_EVENT = 'prompt-template:subagent:request'
export const PROMPT_TEMPLATE_SUBAGENT_STARTED_EVENT = 'prompt-template:subagent:started'
export const PROMPT_TEMPLATE_SUBAGENT_RESPONSE_EVENT = 'prompt-template:subagent:response'
export const PROMPT_TEMPLATE_SUBAGENT_UPDATE_EVENT = 'prompt-template:subagent:update'
export const PROMPT_TEMPLATE_SUBAGENT_CANCEL_EVENT = 'prompt-template:subagent:cancel'

export type PiSubagentsEventBus = {
  readonly on: (event: string, handler: (data: unknown) => void) => (() => void) | void
  readonly emit: (event: string, data: unknown) => void
}

export type PiSubagentsAdapterOptions = {
  readonly events: PiSubagentsEventBus
  readonly cwd: string
  readonly defaultAgent?: string
  readonly defaultModel?: string
  readonly fallbackModels?: ReadonlyArray<string>
  readonly context?: 'fresh' | 'fork'
  readonly timeoutMs?: number
  readonly onProgress?: (progress: WorkflowSubagentProgress) => void
}

export type WorkflowSubagentProgress = {
  readonly requestId: string
  readonly runId: string
  readonly callId: string
  readonly key: string
  readonly phase?: string
  readonly agent: string
  readonly model?: string
  readonly status?: string
  readonly currentTool?: string
  readonly currentToolArgs?: string
  readonly recentOutput?: string
  readonly recentOutputLines?: ReadonlyArray<string>
  readonly toolCount?: number
  readonly durationMs?: number
  readonly tokens?: number
  readonly tasks?: ReadonlyArray<WorkflowSubagentTaskProgress>
}

export type WorkflowSubagentTaskProgress = {
  readonly index?: number
  readonly agent: string
  readonly status?: string
  readonly currentTool?: string
  readonly currentToolArgs?: string
  readonly recentOutput?: string
  readonly recentOutputLines?: ReadonlyArray<string>
  readonly model?: string
  readonly toolCount?: number
  readonly durationMs?: number
  readonly tokens?: number
}

type DelegationResponse = {
  readonly requestId?: unknown
  readonly contentText?: unknown
  readonly messages?: unknown
  readonly isError?: unknown
  readonly errorText?: unknown
}

type DelegationUpdate = {
  readonly requestId?: unknown
  readonly currentTool?: unknown
  readonly currentToolArgs?: unknown
  readonly recentOutput?: unknown
  readonly recentOutputLines?: unknown
  readonly model?: unknown
  readonly toolCount?: unknown
  readonly durationMs?: unknown
  readonly tokens?: unknown
  readonly taskProgress?: unknown
}

export function makePiSubagentsAdapterLayer(options: PiSubagentsAdapterOptions) {
  return Layer.succeed(SubagentAdapter)({
    runAgent: Effect.fn('@tmnl/pi-workflows/PiSubagentsAdapter.runAgent')(function* (request) {
      return yield* Effect.tryPromise({
        try: (signal) => runViaBridgeWithFallback(options, request, signal),
        catch: (cause) =>
          cause instanceof WorkflowAdapterError
            ? cause
            : new WorkflowAdapterError({
                message: 'pi-subagents bridge request failed.',
                runId: request.runId,
                callId: request.callId,
                cause,
              }),
      })
    }),
  })
}

async function runViaBridgeWithFallback(
  options: PiSubagentsAdapterOptions,
  request: AgentRequest,
  signal: AbortSignal,
): Promise<AgentResponse> {
  const candidates = buildModelCandidates(
    request.options?.model ?? options.defaultModel ?? 'anthropic/claude-sonnet-4-5',
    options.fallbackModels,
  )
  let lastError: unknown

  for (const model of candidates) {
    try {
      return await runViaBridge(options, request, signal, model)
    } catch (error) {
      lastError = error
      if (!isRetryableModelFailure(error instanceof Error ? error.message : String(error))) {
        throw error
      }
    }
  }

  throw lastError ?? new WorkflowAdapterError({
    message: 'No pi-subagents model candidates were available.',
    runId: request.runId,
    callId: request.callId,
  })
}

function runViaBridge(
  options: PiSubagentsAdapterOptions,
  request: AgentRequest,
  signal: AbortSignal,
  model: string,
): Promise<AgentResponse> {
  const requestId = `${request.runId}:${request.callId}`
  const agent = request.options?.agent ?? options.defaultAgent ?? 'delegate'
  const timeoutMs = request.options?.timeoutMs ?? options.timeoutMs ?? 120_000

  return new Promise((resolve, reject) => {
    let settled = false
    let timeout: ReturnType<typeof setTimeout> | undefined
    let unsubscribeResponse: (() => void) | void
    let unsubscribeUpdate: (() => void) | void
    const progressEvents: WorkflowSubagentProgress[] = []

    const cleanup = () => {
      if (timeout) clearTimeout(timeout)
      if (typeof unsubscribeResponse === 'function') unsubscribeResponse()
      if (typeof unsubscribeUpdate === 'function') unsubscribeUpdate()
      signal.removeEventListener('abort', onAbort)
    }

    const settle = (fn: () => void) => {
      if (settled) return
      settled = true
      cleanup()
      fn()
    }

    const fail = (message: string, cause?: unknown) =>
      settle(() =>
        reject(
          new WorkflowAdapterError({
            message,
            runId: request.runId,
            callId: request.callId,
            cause,
          }),
        ),
      )

    const onAbort = () => {
      options.events.emit(PROMPT_TEMPLATE_SUBAGENT_CANCEL_EVENT, { requestId })
      fail('pi-subagents bridge request aborted.')
    }

    unsubscribeUpdate = options.events.on(PROMPT_TEMPLATE_SUBAGENT_UPDATE_EVENT, (data) => {
      const progress = normalizeSubagentProgress(data, request, requestId, agent, model)
      if (!progress) return
      progressEvents.push(progress)
      options.onProgress?.(progress)
    })

    unsubscribeResponse = options.events.on(PROMPT_TEMPLATE_SUBAGENT_RESPONSE_EVENT, (data) => {
      if (!isRecord(data) || data.requestId !== requestId) return
      const response = data as DelegationResponse
      if (response.isError === true) {
        fail(typeof response.errorText === 'string' ? response.errorText : 'pi-subagents returned an error.', response)
        return
      }

      const text = extractResponseText(response)
      settle(() =>
        resolve({
          callId: request.callId,
          key: request.key,
          output: text,
          text,
          metadata: {
            adapter: 'pi-subagents',
            requestId,
            agent,
            model,
            progress: progressEvents,
            lastProgress: progressEvents.at(-1),
          },
        }),
      )
    })

    signal.addEventListener('abort', onAbort, { once: true })
    timeout = setTimeout(() => fail('pi-subagents bridge request timed out.'), timeoutMs)

    options.events.emit(PROMPT_TEMPLATE_SUBAGENT_REQUEST_EVENT, {
      requestId,
      agent,
      task: request.prompt,
      context: options.context ?? 'fresh',
      model,
      cwd: options.cwd,
    })
  })
}

export function normalizeSubagentProgress(
  data: unknown,
  request: AgentRequest,
  requestId: string,
  agent: string,
  model: string,
): WorkflowSubagentProgress | undefined {
  if (!isRecord(data) || data.requestId !== requestId) return undefined
  const update = data as DelegationUpdate
  const tasks = normalizeTaskProgress(update.taskProgress)
  const progress: WorkflowSubagentProgress = stripUndefined({
    requestId,
    runId: request.runId,
    callId: request.callId,
    key: request.key,
    phase: request.phase,
    agent,
    model: stringOrUndefined(update.model) ?? model,
    status: firstTaskStatus(tasks),
    currentTool: stringOrUndefined(update.currentTool),
    currentToolArgs: stringOrUndefined(update.currentToolArgs),
    recentOutput: stringOrUndefined(update.recentOutput),
    recentOutputLines: stringArrayOrUndefined(update.recentOutputLines),
    toolCount: numberOrUndefined(update.toolCount),
    durationMs: numberOrUndefined(update.durationMs),
    tokens: numberOrUndefined(update.tokens),
    tasks,
  })
  return progress
}

function normalizeTaskProgress(value: unknown): ReadonlyArray<WorkflowSubagentTaskProgress> | undefined {
  if (!Array.isArray(value)) return undefined
  const tasks = value.flatMap((entry): WorkflowSubagentTaskProgress[] => {
    if (!isRecord(entry)) return []
    const agent = stringOrUndefined(entry.agent)
    if (!agent) return []
    return [stripUndefined({
      index: numberOrUndefined(entry.index),
      agent,
      status: stringOrUndefined(entry.status),
      currentTool: stringOrUndefined(entry.currentTool),
      currentToolArgs: stringOrUndefined(entry.currentToolArgs),
      recentOutput: stringOrUndefined(entry.recentOutput),
      recentOutputLines: stringArrayOrUndefined(entry.recentOutputLines),
      model: stringOrUndefined(entry.model),
      toolCount: numberOrUndefined(entry.toolCount),
      durationMs: numberOrUndefined(entry.durationMs),
      tokens: numberOrUndefined(entry.tokens),
    })]
  })
  return tasks.length > 0 ? tasks : undefined
}

function firstTaskStatus(tasks: ReadonlyArray<WorkflowSubagentTaskProgress> | undefined): string | undefined {
  return tasks?.find((task) => task.status)?.status
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function stringArrayOrUndefined(value: unknown): ReadonlyArray<string> | undefined {
  if (!Array.isArray(value)) return undefined
  const strings = value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
  return strings.length > 0 ? strings : undefined
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, nested]) => nested !== undefined)) as T
}

export function buildModelCandidates(
  primaryModel: string | undefined,
  fallbackModels: ReadonlyArray<string> | undefined,
): ReadonlyArray<string> {
  const seen = new Set<string>()
  const out: string[] = []
  for (const candidate of [primaryModel, ...(fallbackModels ?? [])]) {
    const model = candidate?.trim()
    if (!model || seen.has(model)) continue
    seen.add(model)
    out.push(model)
  }
  return out
}

export function isRetryableModelFailure(error: string | undefined): boolean {
  if (!error) return false
  return [
    /rate\s*limit/i,
    /too many requests/i,
    /\b429\b/,
    /quota/i,
    /billing/i,
    /credit/i,
    /auth(?:entication)?/i,
    /unauthori[sz]ed/i,
    /forbidden/i,
    /api key/i,
    /token expired/i,
    /invalid key/i,
    /provider.*unavailable/i,
    /model.*unavailable/i,
    /model.*disabled/i,
    /model.*not found/i,
    /unknown model/i,
    /overloaded/i,
    /service unavailable/i,
    /temporar(?:ily)? unavailable/i,
    /connection refused/i,
    /fetch failed/i,
    /network error/i,
    /socket hang up/i,
    /upstream/i,
    /timed? out/i,
    /timeout/i,
    /\b502\b/,
    /\b503\b/,
    /\b504\b/,
  ].some((pattern) => pattern.test(error))
}

function extractResponseText(response: DelegationResponse): string {
  if (typeof response.contentText === 'string' && response.contentText.trim()) {
    return response.contentText.trim()
  }

  if (Array.isArray(response.messages)) {
    for (const message of response.messages) {
      const text = extractMessageText(message)
      if (text) return text
    }
  }

  return JSON.stringify(response)
}

function extractMessageText(message: unknown): string | undefined {
  if (!isRecord(message)) return undefined
  const content = message.content
  if (typeof content === 'string' && content.trim()) return content.trim()
  if (!Array.isArray(content)) return undefined
  for (const part of content) {
    if (!isRecord(part)) continue
    if (part.type !== 'text') continue
    if (typeof part.text === 'string' && part.text.trim()) return part.text.trim()
  }
  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
