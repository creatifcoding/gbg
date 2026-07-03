import { Context, Effect, Layer } from 'effect'
import * as Schema from 'effect/Schema'

import {
  AgentCallFailed,
  AgentCallStarted,
  AgentCallSucceeded,
  AgentOptions,
  LogRecorded,
  ParallelCompleted,
  ParallelStarted,
  PhaseStarted,
  PipelineCompleted,
  PipelineStarted,
  RunStarted,
  RunSucceeded,
  WorkflowCall,
  WorkflowRun,
  type WorkflowCall as WorkflowCallType,
  type WorkflowDigest,
  type WorkflowJournalEntry,
  type WorkflowName,
  type WorkflowRun as WorkflowRunType,
} from '../domain/schemas'
import { SubagentAdapter } from './SubagentAdapter'
import { WorkflowCompiler } from './WorkflowCompiler'
import { WorkflowJournal } from './WorkflowJournal'
import { WorkflowRegistry } from './WorkflowRegistry'
import { WorkflowScriptRunner, type WorkflowCoordinatorGlobals } from './WorkflowScriptRunner'
import { WorkflowStore } from './WorkflowStore'
import type { AgentRequest, WorkflowRunResult, WorkflowRuntimeShape } from './types'
import { digestUnknown, makeCallId, makeRunId } from './utils'

export class WorkflowRuntime extends Context.Service<WorkflowRuntime, WorkflowRuntimeShape>()(
  '@tmnl/pi-workflows/WorkflowRuntime',
) {
  static readonly layer = Layer.effect(
    WorkflowRuntime,
    Effect.gen(function* () {
      const registry = yield* WorkflowRegistry
      const compiler = yield* WorkflowCompiler
      const journal = yield* WorkflowJournal
      const store = yield* WorkflowStore
      const scriptRunner = yield* WorkflowScriptRunner
      const adapter = yield* SubagentAdapter

      const dryRun: WorkflowRuntimeShape['dryRun'] = Effect.fn('@tmnl/pi-workflows/WorkflowRuntime.dryRun')(
        function* (request) {
          const source = yield* registry.resolveSource(request)
          return yield* compiler.inspect(source)
        },
      )

      const run: WorkflowRuntimeShape['run'] = Effect.fn('@tmnl/pi-workflows/WorkflowRuntime.run')(function* (request) {
        const source = yield* registry.resolveSource(request)
        const compiled = yield* compiler.compile(source)
        const runId = makeRunId()
        const inputDigest = digestUnknown(request.input ?? null)
        const startedAt = Date.now()
        const replayPlan = request.resume
          ? findReplayPlan(yield* journal.entries(), compiled.descriptor.meta.name, compiled.descriptor.source.digest, inputDigest)
          : new Map<string, unknown>()

        const initialRun = Schema.decodeUnknownSync(WorkflowRun)({
          id: runId,
          workflowName: compiled.descriptor.meta.name,
          source: compiled.descriptor.source,
          inputDigest,
          status: 'running',
          startedAt,
          calls: [],
        })

        yield* journal.append(
          Schema.decodeUnknownSync(RunStarted)({
            _tag: 'RunStarted',
            runId,
            workflowName: compiled.descriptor.meta.name,
            source: compiled.descriptor.source,
            inputDigest,
            at: startedAt,
          }),
        )
        yield* store.upsertRun(initialRun)

        if (request.dryRun) {
          return {
            run: initialRun,
            descriptor: compiled.descriptor,
            result: compiled.descriptor,
            dryRun: true,
          } satisfies WorkflowRunResult
        }

        const maxConcurrency = normalizeConcurrency(compiled.descriptor.meta.maxConcurrency)
        const bufferedEvents: Array<
          | { readonly _tag: 'PhaseStarted'; readonly name: string; readonly at: number }
          | { readonly _tag: 'LogRecorded'; readonly message: string; readonly details?: unknown; readonly at: number }
        > = []
        let currentPhase: string | undefined
        let agentCallIndex = 0
        const calls: WorkflowCallType[] = []
        const globals: WorkflowCoordinatorGlobals = {
          phase: (name) => {
            currentPhase = name
            bufferedEvents.push({ _tag: 'PhaseStarted', name, at: Date.now() })
          },
          log: (message, details) => {
            bufferedEvents.push({ _tag: 'LogRecorded', message, details, at: Date.now() })
          },
          agent: async (prompt, rawOptions) => {
            const options = Schema.decodeUnknownSync(AgentOptions)(toHostJson(rawOptions ?? {}))
            const callId = makeCallId()
            const key = options.label ?? `agent-${agentCallIndex++}`
            const startedAtCall = Date.now()
            const request: AgentRequest = currentPhase === undefined
              ? { runId, callId, key, prompt, options }
              : { runId, callId, key, prompt, phase: currentPhase, options }
            const startedPayload: Record<string, unknown> = {
              _tag: 'AgentCallStarted',
              runId,
              callId,
              key,
              prompt,
              options,
              at: startedAtCall,
            }
            if (currentPhase !== undefined) {
              startedPayload.phase = currentPhase
            }

            await Effect.runPromise(
              journal.append(Schema.decodeUnknownSync(AgentCallStarted)(startedPayload)),
            )

            if (replayPlan.has(key)) {
              const replayed = replayPlan.get(key)
              const completedAtCall = Date.now()
              await Effect.runPromise(
                journal.append(
                  Schema.decodeUnknownSync(AgentCallSucceeded)({
                    _tag: 'AgentCallSucceeded',
                    runId,
                    callId,
                    key,
                    result: replayed,
                    replayed: true,
                    at: completedAtCall,
                  }),
                ),
              )
              const replayedCall: Record<string, unknown> = {
                id: callId,
                key,
                prompt,
                options,
                status: 'replayed',
                startedAt: startedAtCall,
                completedAt: completedAtCall,
                result: replayed,
              }
              if (currentPhase !== undefined) {
                replayedCall.phase = currentPhase
              }
              calls.push(Schema.decodeUnknownSync(WorkflowCall)(replayedCall))
              return options.output === 'json' ? replayed : String(replayed ?? '')
            }

            try {
              const response = await Effect.runPromise(adapter.runAgent(request))
              const completedAtCall = Date.now()
              await Effect.runPromise(
                journal.append(
                  Schema.decodeUnknownSync(AgentCallSucceeded)({
                    _tag: 'AgentCallSucceeded',
                    runId,
                    callId,
                    key,
                    result: response.output,
                    at: completedAtCall,
                  }),
                ),
              )
              const succeededCall: Record<string, unknown> = {
                id: callId,
                key,
                prompt,
                options,
                status: 'succeeded',
                startedAt: startedAtCall,
                completedAt: completedAtCall,
                result: response.output,
              }
              if (currentPhase !== undefined) {
                succeededCall.phase = currentPhase
              }
              calls.push(Schema.decodeUnknownSync(WorkflowCall)(succeededCall))
              return options.output === 'json' ? response.output : response.text
            } catch (cause) {
              const message = formatUnknownError(cause)
              await Effect.runPromise(
                journal.append(
                  Schema.decodeUnknownSync(AgentCallFailed)({
                    _tag: 'AgentCallFailed',
                    runId,
                    callId,
                    key,
                    error: message,
                    at: Date.now(),
                  }),
                ),
              )
              const failedCall: Record<string, unknown> = {
                id: callId,
                key,
                prompt,
                options,
                status: 'failed',
                startedAt: startedAtCall,
                completedAt: Date.now(),
                error: message,
              }
              if (currentPhase !== undefined) {
                failedCall.phase = currentPhase
              }
              calls.push(Schema.decodeUnknownSync(WorkflowCall)(failedCall))
              throw cause
            }
          },
          parallel: async (tasks, rawOptions) => {
            if (!Array.isArray(tasks)) {
              throw new Error('parallel() expects an array of task thunks.')
            }
            const options = normalizeParallelOptions(toHostJson(rawOptions ?? {}), maxConcurrency)
            const startedAtParallel = Date.now()
            await Effect.runPromise(
              journal.append(
                Schema.decodeUnknownSync(ParallelStarted)({
                  _tag: 'ParallelStarted',
                  runId,
                  ...(options.label === undefined ? {} : { label: options.label }),
                  count: tasks.length,
                  at: startedAtParallel,
                }),
              ),
            )

            const settled = await runWithConcurrency(tasks, options.maxConcurrency, async (task) => {
              if (typeof task !== 'function') {
                throw new Error('parallel() entries must be functions.')
              }
              return await task()
            })
            const failures = settled.filter((item) => item.failed).length
            await Effect.runPromise(
              journal.append(
                Schema.decodeUnknownSync(ParallelCompleted)({
                  _tag: 'ParallelCompleted',
                  runId,
                  ...(options.label === undefined ? {} : { label: options.label }),
                  count: tasks.length,
                  failures,
                  at: Date.now(),
                }),
              ),
            )
            return settled.map((item) => (item.failed ? null : item.value))
          },
          pipeline: async (items, stages, rawOptions) => {
            if (!Array.isArray(items) || !Array.isArray(stages)) {
              throw new Error('pipeline() expects item and stage arrays.')
            }
            const options = normalizePipelineOptions(toHostJson(rawOptions ?? {}), maxConcurrency)
            await Effect.runPromise(
              journal.append(
                Schema.decodeUnknownSync(PipelineStarted)({
                  _tag: 'PipelineStarted',
                  runId,
                  ...(options.label === undefined ? {} : { label: options.label }),
                  itemCount: items.length,
                  stageCount: stages.length,
                  at: Date.now(),
                }),
              ),
            )

            const settled = await runWithConcurrency(items, options.maxConcurrency, async (item, index) => {
              let current = item
              for (const stage of stages) {
                if (typeof stage !== 'function') {
                  throw new Error('pipeline() stages must be functions.')
                }
                current = await stage(current, index)
              }
              return current
            })
            const failures = settled.filter((item) => item.failed).length
            await Effect.runPromise(
              journal.append(
                Schema.decodeUnknownSync(PipelineCompleted)({
                  _tag: 'PipelineCompleted',
                  runId,
                  ...(options.label === undefined ? {} : { label: options.label }),
                  itemCount: items.length,
                  failures,
                  at: Date.now(),
                }),
              ),
            )
            return settled.map((item) => (item.failed ? null : item.value))
          },
        }

        const scriptResult = yield* scriptRunner.execute({
          runId,
          script: compiled.script,
          input: request.input ?? null,
          globals,
        })
        const completedAt = Date.now()

        for (const event of bufferedEvents) {
          if (event._tag === 'PhaseStarted') {
            yield* journal.append(
              Schema.decodeUnknownSync(PhaseStarted)({
                _tag: 'PhaseStarted',
                runId,
                phase: event.name,
                at: event.at,
              }),
            )
          } else {
            yield* journal.append(
              Schema.decodeUnknownSync(LogRecorded)({
                _tag: 'LogRecorded',
                runId,
                message: event.message,
                ...(event.details === undefined ? {} : { details: event.details }),
                at: event.at,
              }),
            )
          }
        }

        yield* journal.append(
          Schema.decodeUnknownSync(RunSucceeded)({
            _tag: 'RunSucceeded',
            runId,
            result: scriptResult,
            at: completedAt,
          }),
        )

        const completedRunInput: Record<string, unknown> = {
          ...initialRun,
          status: 'succeeded',
          completedAt,
          calls,
          result: scriptResult,
        }
        if (currentPhase !== undefined) {
          completedRunInput.phase = currentPhase
        }
        const completedRun = Schema.decodeUnknownSync(WorkflowRun)(completedRunInput) satisfies WorkflowRunType

        yield* store.upsertRun(completedRun)

        return {
          run: completedRun,
          descriptor: compiled.descriptor,
          result: scriptResult,
          dryRun: false,
        } satisfies WorkflowRunResult
      })

      return WorkflowRuntime.of({ dryRun, run })
    }),
  )
}

export const WorkflowRuntimeLive = WorkflowRuntime.layer

function findReplayPlan(
  entries: ReadonlyArray<WorkflowJournalEntry>,
  workflowName: WorkflowName,
  sourceDigest: WorkflowDigest | undefined,
  inputDigest: WorkflowDigest,
): Map<string, unknown> {
  if (!sourceDigest) return new Map()

  const matchingRunIds = new Set<string>()
  const succeededRunIds = new Set<string>()
  for (const entry of entries) {
    if (
      entry._tag === 'RunStarted' &&
      entry.workflowName === workflowName &&
      entry.source.digest === sourceDigest &&
      entry.inputDigest === inputDigest
    ) {
      matchingRunIds.add(entry.runId)
    }
    if (entry._tag === 'RunSucceeded') {
      succeededRunIds.add(entry.runId)
    }
  }

  const runId = [...matchingRunIds].reverse().find((candidate) => succeededRunIds.has(candidate))
  if (!runId) return new Map()

  const replay = new Map<string, unknown>()
  for (const entry of entries) {
    if (entry._tag === 'AgentCallSucceeded' && entry.runId === runId && !replay.has(entry.key)) {
      replay.set(entry.key, entry.result)
    }
  }
  return replay
}

type SettledValue =
  | { readonly failed: false; readonly value: unknown }
  | { readonly failed: true; readonly error: unknown }

type ParallelOptionsRuntime = {
  readonly label?: string
  readonly maxConcurrency: number
}

function normalizeParallelOptions(raw: unknown, fallbackMaxConcurrency: number): ParallelOptionsRuntime {
  const record = isRecord(raw) ? raw : {}
  return {
    label: typeof record.label === 'string' ? record.label : undefined,
    maxConcurrency: normalizeConcurrency(record.maxConcurrency, fallbackMaxConcurrency),
  }
}

function normalizePipelineOptions(raw: unknown, fallbackMaxConcurrency: number): ParallelOptionsRuntime {
  return normalizeParallelOptions(raw, fallbackMaxConcurrency)
}

function normalizeConcurrency(value: unknown, fallback = 4): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }
  return Math.max(1, Math.floor(value))
}

async function runWithConcurrency<T>(
  items: ReadonlyArray<T>,
  maxConcurrency: number,
  run: (item: T, index: number) => Promise<unknown>,
): Promise<ReadonlyArray<SettledValue>> {
  const results = new Array<SettledValue>(items.length)
  let cursor = 0

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++
      try {
        results[index] = { failed: false, value: await run(items[index], index) }
      } catch (error) {
        results[index] = { failed: true, error }
      }
    }
  }

  const workerCount = Math.min(maxConcurrency, items.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toHostJson(value: unknown): unknown {
  if (value === undefined) {
    return undefined
  }
  return JSON.parse(JSON.stringify(value))
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { readonly message: unknown }).message)
  }
  return String(error)
}
