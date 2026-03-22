import { describe, it, expect } from '@effect/vitest'
import { Duration, Effect, Layer, Option, PubSub, Ref, Stream, TestClock } from 'effect'

import {
  ChatDataProvider,
  ExtensionUIResponse,
  SendMessageOptions,
} from '../../ChatDataProvider'
import { PiProvider } from '../PiProvider'
import {
  HarnessRuntime,
  type HarnessRuntimeShape,
  type HarnessEvent,
} from '../../../../harness'
import { HarnessRuntimeError } from '../../../../harness/HarnessRuntime'

interface MockSessionState {
  readonly sessionId: string
  readonly nodeId: string
  readonly role: string
  readonly headSeq: number
  readonly events: ReadonlyArray<HarnessEvent>
}

const makeMockHarnessRuntimeLayer = () =>
  Effect.gen(function* () {
    const sessionsRef = yield* Ref.make<Record<string, MockSessionState>>({})
    const nodeToSessionRef = yield* Ref.make<Record<string, string>>({})
    const eventsPubSub = yield* PubSub.unbounded<HarnessEvent>()
    const sessionCounterRef = yield* Ref.make(0)

    const nextSessionId = () =>
      Ref.updateAndGet(sessionCounterRef, (n) => n + 1).pipe(
        Effect.map((n) => `session-${n}`),
      )

    const append = (
      sessionId: string,
      makeEvent: (nextSeq: number) => HarnessEvent,
    ) =>
      Effect.gen(function* () {
        const event = yield* Ref.modify(sessionsRef, (sessions) => {
          const session = sessions[sessionId]
          const nextSeq = session.headSeq + 1
          const evt = makeEvent(nextSeq)
          return [evt, {
            ...sessions,
            [sessionId]: {
              ...session,
              headSeq: nextSeq,
              events: [...session.events, evt],
            },
          }] as const
        })

        yield* PubSub.publish(eventsPubSub, event)
      })

    const runtime: HarnessRuntimeShape = {
      backend: 'pi-ai',

      openSession: (nodeId, role) =>
        Effect.gen(function* () {
          const existing = yield* Ref.get(nodeToSessionRef).pipe(Effect.map((map) => map[nodeId]))
          if (existing) {
            const session = yield* Ref.get(sessionsRef).pipe(Effect.map((sessions) => sessions[existing]))
            return {
              sessionId: session.sessionId as any,
              nodeId: session.nodeId,
              role: session.role as any,
              agentId: `agent-${session.sessionId}`,
              headSeq: session.headSeq as any,
              backend: 'pi-ai' as const,
            }
          }

          const sessionId = yield* nextSessionId()
          const session: MockSessionState = {
            sessionId,
            nodeId,
            role,
            headSeq: 0,
            events: [],
          }

          yield* Ref.update(sessionsRef, (sessions) => ({ ...sessions, [sessionId]: session }))
          yield* Ref.update(nodeToSessionRef, (map) => ({ ...map, [nodeId]: sessionId }))

          yield* append(sessionId, (seq) => ({
            _tag: 'chat:v2/session_opened',
            sessionId: sessionId as any,
            seq: seq as any,
            at: Date.now(),
            nodeId,
            role,
            agentId: `agent-${sessionId}`,
          }))

          const created = yield* Ref.get(sessionsRef).pipe(Effect.map((sessions) => sessions[sessionId]))
          return {
            sessionId: created.sessionId as any,
            nodeId: created.nodeId,
            role: created.role as any,
            agentId: `agent-${created.sessionId}`,
            headSeq: created.headSeq as any,
            backend: 'pi-ai' as const,
          }
        }),

      resumeSession: (sessionId, fromSeq) =>
        Effect.gen(function* () {
          const session = yield* Ref.get(sessionsRef).pipe(Effect.map((sessions) => sessions[sessionId as any]))
          const events = Option.match(fromSeq, {
            onNone: () => session.events,
            onSome: (seq) => session.events.filter((event) => event.seq > seq),
          })

          return {
            sessionId: session.sessionId as any,
            headSeq: session.headSeq as any,
            events,
          }
        }),

      send: (sessionId, clientMessageId, text) =>
        Effect.gen(function* () {
          const sid = sessionId as any as string

          yield* append(sid, (seq) => ({
            _tag: 'chat:v2/send_accepted',
            sessionId,
            seq: seq as any,
            at: Date.now(),
            clientMessageId,
            userMessageId: `user-${sid}-${seq}` as any,
          }))

          const assistantMessageId = `assistant-${sid}`
          yield* append(sid, (seq) => ({
            _tag: 'chat:v2/assistant_start',
            sessionId,
            seq: seq as any,
            at: Date.now(),
            messageId: assistantMessageId as any,
          }))

          yield* append(sid, (seq) => ({
            _tag: 'chat:v2/assistant_delta',
            sessionId,
            seq: seq as any,
            at: Date.now(),
            messageId: assistantMessageId as any,
            delta: `echo:${text}`,
          }))

          yield* append(sid, (seq) => ({
            _tag: 'chat:v2/assistant_final',
            sessionId,
            seq: seq as any,
            at: Date.now(),
            messageId: assistantMessageId as any,
            text: `echo:${text}`,
          }))

          return {
            accepted: true as const,
            sessionId,
            backend: 'pi-ai' as const,
          }
        }),

      getSnapshot: (sessionId, fromSeq) =>
        Effect.gen(function* () {
          const session = yield* Ref.get(sessionsRef).pipe(Effect.map((sessions) => sessions[sessionId as any]))
          const events = Option.match(fromSeq, {
            onNone: () => session.events,
            onSome: (seq) => session.events.filter((event) => event.seq > seq),
          })

          return {
            sessionId,
            headSeq: session.headSeq as any,
            events,
          }
        }),

      abortSession: (sessionId) =>
        append(sessionId as any as string, (seq) => ({
          _tag: 'chat:v2/error',
          sessionId,
          seq: seq as any,
          at: Date.now(),
          code: 'aborted',
          message: 'aborted by test runtime',
        })),

      respondExtensionUI: () => Effect.void,

      events: Stream.fromPubSub(eventsPubSub),
    }

    return Layer.succeed(HarnessRuntime, runtime)
  })

const waitFor = <A>(
  effect: Effect.Effect<A>,
  predicate: (value: A) => boolean,
  attempts = 200,
): Effect.Effect<A> =>
  effect.pipe(
    Effect.flatMap((value) =>
      predicate(value)
        ? Effect.succeed(value)
        : attempts <= 0
          ? Effect.fail(new Error('timed out waiting for condition'))
          : Effect.yieldNow().pipe(Effect.zipRight(waitFor(effect, predicate, attempts - 1))),
    ),
  )

describe('PiProvider', () => {
  it.effect('exposes initial provider state with no messages', () =>
    Effect.scoped(
      Effect.gen(function* () {
        const harnessLayer = yield* makeMockHarnessRuntimeLayer()
        const providerLayer = PiProvider.layer({
          nodeId: 'chat-node-1',
          role: 'general',
        }).pipe(Layer.provide(harnessLayer))

        const state = yield* Effect.gen(function* () {
          const provider = yield* ChatDataProvider
          return yield* provider.getState
        }).pipe(Effect.provide(providerLayer))

        expect(state.status).toBe('idle')
        expect(state.messages.length).toBe(0)
        expect(state.isStreaming).toBe(false)
      }),
    ),
  )

  it.effect('sends through harness runtime and projects assistant events', () =>
    Effect.scoped(
      Effect.gen(function* () {
        const harnessLayer = yield* makeMockHarnessRuntimeLayer()
        const providerLayer = PiProvider.layer({
          nodeId: 'chat-node-2',
          role: 'general',
        }).pipe(Layer.provide(harnessLayer))

        const messages = yield* Effect.gen(function* () {
          const provider = yield* ChatDataProvider

          yield* provider.sendMessage(
            new SendMessageOptions({
              text: 'hello harness',
              systemPrompt: Option.none(),
              attachments: [],
            }),
          )

          return yield* waitFor(
            provider.getMessages,
            (rows) => rows.some((m) => m.role === 'assistant' && (m.text ?? '').includes('echo:hello harness')),
          )
        }).pipe(Effect.provide(providerLayer))

        expect(messages.some((m) => m.role === 'user' && m.text === 'hello harness')).toBe(true)
        expect(messages.some((m) => m.role === 'assistant' && (m.text ?? '').includes('echo:hello harness'))).toBe(true)
      }),
    ),
  )

  it.effect('exposes reducer-derived harness metrics on pi provider path', () =>
    Effect.scoped(
      Effect.gen(function* () {
        const harnessLayer = yield* makeMockHarnessRuntimeLayer()
        const providerLayer = PiProvider.layer({
          nodeId: 'chat-node-metrics',
          role: 'general',
        }).pipe(Layer.provide(harnessLayer))

        const metrics = yield* Effect.gen(function* () {
          const provider = yield* ChatDataProvider

          yield* provider.sendMessage(
            new SendMessageOptions({
              text: 'metrics please',
              systemPrompt: Option.none(),
              attachments: [],
            }),
          )

          if (!provider.getMetrics) {
            return yield* Effect.fail(new Error('expected getMetrics to be available on PiProvider'))
          }

          yield* TestClock.adjust(Duration.millis(50))
          return yield* provider.getMetrics
        }).pipe(Effect.provide(providerLayer))

        expect(typeof metrics.renderTransformBatchMs).toBe('number')
        expect(typeof metrics.renderBacklogDepth).toBe('number')
      }),
    ),
  )

  it.effect('clear opens a fresh harness session and resets messages', () =>
    Effect.scoped(
      Effect.gen(function* () {
        const harnessLayer = yield* makeMockHarnessRuntimeLayer()
        const providerLayer = PiProvider.layer({
          nodeId: 'chat-node-clear',
          role: 'general',
        }).pipe(Layer.provide(harnessLayer))

        const [before, after] = yield* Effect.gen(function* () {
          const provider = yield* ChatDataProvider

          yield* provider.sendMessage(
            new SendMessageOptions({
              text: 'before clear',
              systemPrompt: Option.none(),
              attachments: [],
            }),
          )

          const beforeClear = yield* waitFor(
            provider.getMessages,
            (rows) => rows.some((m) => m.role === 'assistant'),
          )

          yield* provider.clear
          const afterClear = yield* provider.getMessages

          return [beforeClear, afterClear] as const
        }).pipe(Effect.provide(providerLayer))

        expect(before.length).toBeGreaterThan(0)
        expect(after.length).toBe(0)
      }),
    ),
  )

  it.effect('maps harness open-session failures to ProviderNotConfiguredError', () => {
    const failingHarness = Layer.succeed(HarnessRuntime, {
      backend: 'pi-ai',
      openSession: () =>
        Effect.fail(
          new HarnessRuntimeError({
            code: 'open-failed',
            message: 'intentional failure',
            cause: Option.none(),
          }),
        ),
      resumeSession: () => Effect.dieMessage('not used'),
      send: () => Effect.dieMessage('not used'),
      getSnapshot: () => Effect.dieMessage('not used'),
      abortSession: () => Effect.void,
      respondExtensionUI: () => Effect.void,
      events: Stream.empty,
    } satisfies HarnessRuntimeShape)

    const providerLayer = PiProvider.layer({
      nodeId: 'chat-node-fail',
      role: 'general',
    }).pipe(Layer.provide(failingHarness))

    return Effect.gen(function* () {
      const result = yield* Effect.scoped(
        Effect.gen(function* () {
          return yield* ChatDataProvider
        }),
      ).pipe(
        Effect.provide(providerLayer),
        Effect.either,
      )

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('ProviderNotConfiguredError')
      }
    })
  })

  it.effect('returns ChatSendError for unknown extension response request id', () =>
    Effect.scoped(
      Effect.gen(function* () {
        const harnessLayer = yield* makeMockHarnessRuntimeLayer()
        const providerLayer = PiProvider.layer({
          nodeId: 'chat-node-ext',
          role: 'general',
        }).pipe(Layer.provide(harnessLayer))

        const responseResult = yield* Effect.gen(function* () {
          const provider = yield* ChatDataProvider
          return yield* provider.respondExtensionUI!(
            new ExtensionUIResponse({
              requestId: 'missing-request-id',
              kind: 'confirm',
              value: Option.none(),
              confirmed: Option.some(true),
            }),
          ).pipe(Effect.either)
        }).pipe(Effect.provide(providerLayer))

        expect(responseResult._tag).toBe('Left')
      }),
    ),
  )

  it.effect('browserLayer works with provided harness runtime', () =>
    Effect.scoped(
      Effect.gen(function* () {
        const harnessLayer = yield* makeMockHarnessRuntimeLayer()
        const providerLayer = PiProvider.browserLayer({
          nodeId: 'chat-node-browser',
          role: 'general',
        }).pipe(Layer.provide(harnessLayer))

        const state = yield* Effect.gen(function* () {
          const provider = yield* ChatDataProvider
          yield* provider.sendMessage(
            new SendMessageOptions({
              text: 'hello browser alias',
              systemPrompt: Option.none(),
              attachments: [],
            }),
          )

          return yield* waitFor(
            provider.getState,
            (s) => s.messages.length >= 2,
          )
        }).pipe(Effect.provide(providerLayer))

        expect(state.messages.length).toBeGreaterThanOrEqual(2)
      }),
    ),
  )
})
