import { describe, expect, it } from 'vitest'
import { Effect, Layer, ManagedRuntime } from 'effect'

import {
  PROMPT_TEMPLATE_SUBAGENT_REQUEST_EVENT,
  PROMPT_TEMPLATE_SUBAGENT_RESPONSE_EVENT,
  PROMPT_TEMPLATE_SUBAGENT_UPDATE_EVENT,
  SubagentAdapter,
  makePiSubagentsAdapterLayer,
} from '../src/services/index'
import { decodeCallId, decodeRunId } from '../src/services/utils'

class MemoryEvents {
  readonly handlers = new Map<string, Set<(data: unknown) => void>>()
  readonly emitted: Array<{ event: string; data: unknown }> = []

  on(event: string, handler: (data: unknown) => void): () => void {
    const handlers = this.handlers.get(event) ?? new Set()
    handlers.add(handler)
    this.handlers.set(event, handlers)
    return () => handlers.delete(handler)
  }

  emit(event: string, data: unknown): void {
    this.emitted.push({ event, data })
    for (const handler of this.handlers.get(event) ?? []) {
      queueMicrotask(() => handler(data))
    }
  }
}

describe('pi-subagents event bridge adapter', () => {
  it('emits prompt-template request and resolves matching response', async () => {
    const events = new MemoryEvents()
    events.on(PROMPT_TEMPLATE_SUBAGENT_REQUEST_EVENT, (data) => {
      const request = data as { requestId: string }
      events.emit(PROMPT_TEMPLATE_SUBAGENT_RESPONSE_EVENT, {
        ...request,
        contentText: 'delegated answer',
        messages: [],
        isError: false,
      })
    })
    const runtime = ManagedRuntime.make(
      makePiSubagentsAdapterLayer({
        events,
        cwd: '/tmp/project',
        defaultAgent: 'delegate',
        defaultModel: 'test/model',
      }),
    )

    try {
      const response = await runtime.runPromise(
        Effect.gen(function* () {
          const adapter = yield* SubagentAdapter
          return yield* adapter.runAgent({
            runId: decodeRunId('run-bridge'),
            callId: decodeCallId('call-bridge'),
            key: 'bridge',
            prompt: 'Do bridge work',
          })
        }),
      )

      expect(response.text).toBe('delegated answer')
      expect(response.metadata).toMatchObject({ adapter: 'pi-subagents', agent: 'delegate', model: 'test/model' })
      expect(events.emitted[0]).toMatchObject({
        event: PROMPT_TEMPLATE_SUBAGENT_REQUEST_EVENT,
        data: { agent: 'delegate', task: 'Do bridge work', context: 'fresh', model: 'test/model', cwd: '/tmp/project' },
      })
    } finally {
      await runtime.dispose()
    }
  })

  it('normalizes progress updates for workflow phase surfaces', async () => {
    const events = new MemoryEvents()
    const progress: unknown[] = []
    events.on(PROMPT_TEMPLATE_SUBAGENT_REQUEST_EVENT, (data) => {
      const request = data as { requestId: string; model: string }
      events.emit(PROMPT_TEMPLATE_SUBAGENT_UPDATE_EVENT, {
        requestId: request.requestId,
        currentTool: 'read',
        recentOutput: 'scanning files',
        recentOutputLines: ['scanning files'],
        toolCount: 1,
        durationMs: 42,
        taskProgress: [
          {
            index: 0,
            agent: 'delegate',
            status: 'running',
            currentTool: 'read',
            recentOutput: 'scanning files',
            model: request.model,
          },
        ],
      })
      events.emit(PROMPT_TEMPLATE_SUBAGENT_RESPONSE_EVENT, {
        ...request,
        contentText: 'done',
        messages: [],
        isError: false,
      })
    })
    const runtime = ManagedRuntime.make(
      makePiSubagentsAdapterLayer({
        events,
        cwd: '/tmp/project',
        defaultAgent: 'delegate',
        defaultModel: 'test/model',
        onProgress: (update) => progress.push(update),
      }),
    )

    try {
      const response = await runtime.runPromise(
        Effect.gen(function* () {
          const adapter = yield* SubagentAdapter
          return yield* adapter.runAgent({
            runId: decodeRunId('run-bridge-progress'),
            callId: decodeCallId('call-bridge-progress'),
            key: 'bridge-progress',
            phase: 'research',
            prompt: 'Do bridge work',
          })
        }),
      )

      expect(progress).toHaveLength(1)
      expect(progress[0]).toMatchObject({
        key: 'bridge-progress',
        phase: 'research',
        agent: 'delegate',
        model: 'test/model',
        currentTool: 'read',
        recentOutput: 'scanning files',
        status: 'running',
      })
      expect(response.metadata).toMatchObject({
        lastProgress: { key: 'bridge-progress', phase: 'research', currentTool: 'read' },
      })
    } finally {
      await runtime.dispose()
    }
  })

  it('retries retryable model failures with fallback models', async () => {
    const events = new MemoryEvents()
    events.on(PROMPT_TEMPLATE_SUBAGENT_REQUEST_EVENT, (data) => {
      const request = data as { requestId: string; model: string }
      if (request.model === 'bad/model') {
        events.emit(PROMPT_TEMPLATE_SUBAGENT_RESPONSE_EVENT, {
          ...request,
          messages: [],
          isError: true,
          errorText: '403 forbidden model unavailable',
        })
        return
      }
      events.emit(PROMPT_TEMPLATE_SUBAGENT_RESPONSE_EVENT, {
        ...request,
        contentText: `ok from ${request.model}`,
        messages: [],
        isError: false,
      })
    })
    const runtime = ManagedRuntime.make(
      makePiSubagentsAdapterLayer({
        events,
        cwd: '/tmp/project',
        defaultAgent: 'delegate',
        defaultModel: 'bad/model',
        fallbackModels: ['good/model'],
      }),
    )

    try {
      const response = await runtime.runPromise(
        Effect.gen(function* () {
          const adapter = yield* SubagentAdapter
          return yield* adapter.runAgent({
            runId: decodeRunId('run-bridge-fallback'),
            callId: decodeCallId('call-bridge-fallback'),
            key: 'bridge-fallback',
            prompt: 'Do bridge work',
          })
        }),
      )

      expect(response.text).toBe('ok from good/model')
      const requests = events.emitted.filter((entry) => entry.event === PROMPT_TEMPLATE_SUBAGENT_REQUEST_EVENT)
      expect(requests.map((entry) => (entry.data as { model: string }).model)).toEqual(['bad/model', 'good/model'])
    } finally {
      await runtime.dispose()
    }
  })
})
