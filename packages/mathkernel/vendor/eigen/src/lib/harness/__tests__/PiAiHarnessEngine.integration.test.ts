import { describe, expect, it } from '@effect/vitest'
import type {
  AssistantMessage,
  AssistantMessageEvent,
  AssistantMessageEventStream,
  Context as PiAiContext,
  Message as PiAiMessage,
  Model as PiAiModel,
  SimpleStreamOptions,
  StopReason,
  ToolCall,
} from '@mariozechner/pi-ai'
import { Effect, Layer, Option } from 'effect'

import { HarnessSessionStoreMemoryLive } from '../HarnessSessionStoreMemory'
import { PiAiEventAdapterLive } from '../PiAiEventAdapter'
import {
  PiAiHarnessEngine,
  PiAiHarnessEngineCoreLive,
  PiAiHarnessEngineError,
} from '../PiAiHarnessEngine'
import { PiAiPolicy, PiAiPolicyConfig } from '../PiAiPolicy'
import { PiAiStreamClient } from '../PiAiStreamClient'
import { PiAiToolRuntime } from '../PiAiToolRuntime'

const ZERO_USAGE = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    total: 0,
  },
}

const makeAssistant = (params: {
  readonly content: AssistantMessage['content']
  readonly stopReason: StopReason
  readonly errorMessage?: string
}): AssistantMessage => ({
  role: 'assistant',
  content: params.content,
  api: 'openai-responses',
  provider: 'openai',
  model: 'gpt-4o-mini',
  usage: ZERO_USAGE,
  stopReason: params.stopReason,
  errorMessage: params.errorMessage,
  timestamp: Date.now(),
})

const makePartialAssistant = (
  content: AssistantMessage['content'],
): AssistantMessage =>
  makeAssistant({
    content,
    stopReason: 'toolUse',
  })

const makeImmediateStream = (
  events: ReadonlyArray<AssistantMessageEvent>,
  message: AssistantMessage,
): AssistantMessageEventStream =>
  ({
    async *[Symbol.asyncIterator]() {
      for (const event of events) {
        yield event
      }
    },
    result: async () => message,
  }) as AssistantMessageEventStream

const makeAbortableStream = (signal: AbortSignal | undefined): AssistantMessageEventStream =>
  ({
    async *[Symbol.asyncIterator]() {
      yield {
        type: 'text_delta',
        contentIndex: 0,
        delta: 'still-running',
        partial: makePartialAssistant([{ type: 'text', text: 'still-running' }]),
      }

      await new Promise<void>((resolve) => {
        if (signal === undefined || signal.aborted) {
          resolve()
          return
        }

        signal.addEventListener('abort', () => resolve(), { once: true })
      })
    },
    result: async () =>
      makeAssistant({
        content: [{ type: 'text', text: 'partial-before-abort' }],
        stopReason: 'aborted',
        errorMessage: 'aborted by test',
      }),
  }) as AssistantMessageEventStream

const withEngine = (
  stream: (
    model: PiAiModel<any>,
    context: PiAiContext,
    options: SimpleStreamOptions,
  ) => AssistantMessageEventStream,
  executeTool?: (toolCall: ToolCall) => Effect.Effect<PiAiMessage, never>,
  maxToolRounds = 4,
) => {
  const policyLayer = Layer.succeed(
    PiAiPolicy,
    PiAiPolicy.of({
      config: new PiAiPolicyConfig({
        provider: 'openai',
        model: 'gpt-4o-mini',
        systemPrompt: 'test harness prompt',
        apiKey: Option.none(),
        oauthAuthFile: 'auth.json',
        cacheRetention: 'short',
        maxRetryDelayMs: Option.none(),
        requestTimeoutMs: 1000,
        retryCount: 0,
        maxConcurrentStreams: 2,
        toolTimeoutMs: 0,
        unboundedToolPatterns: [],
        compactionEnabled: true,
        compactionReserveTokens: 16384,
        compactionKeepRecentTokens: 20000,
        compactionSummaryModel: Option.none(),
        sessionIdPrefix: 'test-chat',
        agentIdPrefix: 'test-agent',
        defaultReasoning: Option.none(),
      }),
      resolveModel: Effect.succeed({ id: 'fake', provider: 'openai', api: 'openai-responses' } as PiAiModel<any>),
      makeStreamOptions: ({ sessionId, signal }) =>
        Effect.succeed({
          sessionId,
          signal,
          cacheRetention: 'short',
        }),
    }),
  )

  const streamLayer = Layer.succeed(
    PiAiStreamClient,
    PiAiStreamClient.of({ stream }),
  )

  const toolLayer = Layer.succeed(
    PiAiToolRuntime,
    PiAiToolRuntime.of({
      tools: [],
      maxToolRounds,
      execute:
        executeTool ??
        ((toolCall) =>
          Effect.succeed({
            role: 'toolResult',
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            content: [{ type: 'text', text: 'ok' }],
            isError: false,
            timestamp: Date.now(),
          })),
    }),
  )

  return PiAiHarnessEngineCoreLive.pipe(
    Layer.provide(HarnessSessionStoreMemoryLive),
    Layer.provide(toolLayer),
    Layer.provide(streamLayer),
    Layer.provide(PiAiEventAdapterLive),
    Layer.provide(policyLayer),
  )
}

const waitForSnapshot = (
  engine: typeof PiAiHarnessEngine.Type,
  sessionId: any,
  predicate: (events: ReadonlyArray<any>) => boolean,
  attempts = 400,
): Effect.Effect<ReadonlyArray<any>, PiAiHarnessEngineError> =>
  engine.getSnapshot(sessionId, Option.none()).pipe(
    Effect.flatMap((snapshot) =>
      predicate(snapshot.events)
        ? Effect.succeed(snapshot.events)
        : attempts <= 0
          ? Effect.fail(
              new PiAiHarnessEngineError({
                code: 'timeout',
                message: `Timed out waiting for snapshot condition on ${sessionId}`,
                cause: Option.none(),
              }),
            )
          : Effect.yieldNow().pipe(
              Effect.zipRight(waitForSnapshot(engine, sessionId, predicate, attempts - 1)),
            ),
    ),
  )

describe('PiAiHarnessEngine (headless integration)', () => {
  it.effect('continues toolUse rounds, executes tools, and emits usage/cost events', () =>
    Effect.gen(function* () {
      const toolCalls: Array<string> = []
      let round = 0

      const toolCall: ToolCall = {
        type: 'toolCall',
        id: 'tool-1',
        name: 'lookup_weather',
        arguments: { city: 'Boston' },
      }

      const layer = withEngine(
        (_model, _context, _options) => {
          round += 1

          if (round === 1) {
            return makeImmediateStream(
              [
                {
                  type: 'toolcall_start',
                  contentIndex: 0,
                  partial: makePartialAssistant([toolCall]),
                },
                {
                  type: 'toolcall_delta',
                  contentIndex: 0,
                  delta: '{"city":"Boston"}',
                  partial: makePartialAssistant([toolCall]),
                },
                {
                  type: 'toolcall_end',
                  contentIndex: 0,
                  toolCall,
                  partial: makePartialAssistant([toolCall]),
                },
              ],
              makeAssistant({ content: [toolCall], stopReason: 'toolUse' }),
            )
          }

          return makeImmediateStream(
            [
              {
                type: 'thinking_delta',
                contentIndex: 0,
                delta: 'synthesizing result',
                partial: makePartialAssistant([{ type: 'thinking', thinking: 'synthesizing result' }]),
              },
              {
                type: 'text_delta',
                contentIndex: 1,
                delta: 'It is 28F and clear.',
                partial: makePartialAssistant([{ type: 'text', text: 'It is 28F and clear.' }]),
              },
            ],
            makeAssistant({
              content: [{ type: 'text', text: 'It is 28F and clear.' }],
              stopReason: 'stop',
            }),
          )
        },
        (call) =>
          Effect.sync(() => {
            toolCalls.push(call.name)
            return {
              role: 'toolResult' as const,
              toolCallId: call.id,
              toolName: call.name,
              content: [{ type: 'text' as const, text: 'weather: 28F clear' }],
              isError: false,
              timestamp: Date.now(),
            }
          }),
      )

      const engine = yield* PiAiHarnessEngine.pipe(Effect.provide(layer))
      const session = yield* engine.openSession('node-harness-1', 'general')
      yield* engine.send(session.sessionId, 'client-1' as any, 'what is the weather?', Option.none())

      const events = yield* waitForSnapshot(
        engine,
        session.sessionId,
        (all) => all.some((event) => event._tag === 'chat:v2/assistant_final'),
      )

      expect(toolCalls).toEqual(['lookup_weather'])
      expect(events.some((event) => event._tag === 'chat:v2/assistant_final')).toBe(true)
      expect(events.some((event) => event._tag === 'chat:v2/provider_marker')).toBe(true)
      expect(
        events.some(
          (event) =>
            event._tag === 'chat:v2/provider_marker' &&
            (event.marker._tag === 'provider:marker/toolcall_start' || event.marker._tag === 'provider:marker/text_delta'),
        ),
      ).toBe(true)

      const usageEvents = events.filter((event) => event._tag === 'chat:v2/usage')
      expect(usageEvents.length).toBeGreaterThanOrEqual(2)
      expect(usageEvents.some((event) => event.stopReason === 'toolUse')).toBe(true)
      expect(usageEvents.some((event) => event.stopReason === 'stop')).toBe(true)

      const metricEvents = events.filter((event) => event._tag === 'chat:v2/metric')
      expect(metricEvents.some((event) => event.metric === 'ackLatencyMs')).toBe(true)
      expect(metricEvents.some((event) => event.metric === 'firstDeltaLagMs')).toBe(true)
      expect(metricEvents.some((event) => event.metric === 'toolRoundTripMs')).toBe(true)
      expect(metricEvents.some((event) => event.metric === 'retryCount')).toBe(true)
    }),
  )

  it.effect('supports headless abort/recover flow (no UI loop required)', () =>
    Effect.gen(function* () {
      let streamCall = 0

      const layer = withEngine((_model, _context, options) => {
        streamCall += 1

        if (streamCall === 1) {
          return makeAbortableStream(options.signal)
        }

        return makeImmediateStream(
          [
            {
              type: 'text_delta',
              contentIndex: 0,
              delta: 'recovered after abort',
              partial: makePartialAssistant([{ type: 'text', text: 'recovered after abort' }]),
            },
          ],
          makeAssistant({
            content: [{ type: 'text', text: 'recovered after abort' }],
            stopReason: 'stop',
          }),
        )
      })

      const engine = yield* PiAiHarnessEngine.pipe(Effect.provide(layer))
      const session = yield* engine.openSession('node-harness-2', 'general')

      yield* engine.send(session.sessionId, 'client-abort-1' as any, 'long running prompt', Option.none())
      yield* Effect.yieldNow()
      yield* engine.abortSession(session.sessionId)

      yield* engine.send(session.sessionId, 'client-abort-2' as any, 'continue after abort', Option.none())

      const events = yield* waitForSnapshot(
        engine,
        session.sessionId,
        (all) =>
          all.some(
            (event) => event._tag === 'chat:v2/assistant_final' && event.text.includes('recovered after abort'),
          ),
      )

      expect(events.some((event) => event._tag === 'chat:v2/send_accepted')).toBe(true)
      expect(events.some((event) => event._tag === 'chat:v2/assistant_final')).toBe(true)
      expect(events.some((event) => event._tag === 'chat:v2/provider_marker')).toBe(true)
    }),
  )

  it.effect('keeps node-idempotent openSession by default but allows forceNew session creation', () =>
    Effect.gen(function* () {
      const layer = withEngine(() =>
        makeImmediateStream(
          [
            {
              type: 'text_delta',
              contentIndex: 0,
              delta: 'noop',
              partial: makePartialAssistant([{ type: 'text', text: 'noop' }]),
            },
          ],
          makeAssistant({
            content: [{ type: 'text', text: 'noop' }],
            stopReason: 'stop',
          }),
        ),
      )

      const engine = yield* PiAiHarnessEngine.pipe(Effect.provide(layer))
      const nodeId = 'node-force-new'

      const first = yield* engine.openSession(nodeId, 'general')
      const second = yield* engine.openSession(nodeId, 'general')
      const third = yield* engine.openSession(nodeId, 'general', { forceNew: true })

      expect(second.sessionId).toBe(first.sessionId)
      expect(third.sessionId).not.toBe(first.sessionId)

      const sessions = yield* engine.listSessions()
      const nodeSessions = sessions.filter((session) => session.nodeId === nodeId)
      expect(nodeSessions.length).toBe(2)
    }),
  )
})
