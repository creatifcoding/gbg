import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Match, Option, PubSub, Ref, Stream } from 'effect'

import {
  HarnessBrowserTransport,
  type HarnessBrowserTransportShape,
} from '../HarnessBrowserTransport'
import { HarnessRuntime } from '../HarnessRuntime'
import { HarnessRuntimeBrowserLive } from '../HarnessRuntimeBrowser'

describe('HarnessRuntimeBrowser', () => {
  it.effect('maps chat-v2 commands over browser transport', () =>
    Effect.gen(function* () {
      const commandLogRef = yield* Ref.make<Array<Record<string, unknown>>>([])
      const eventsPubSub = yield* PubSub.unbounded<unknown>()

      const transportLayer = Layer.succeed(HarnessBrowserTransport, {
        request: (command) =>
          Effect.gen(function* () {
            yield* Ref.update(commandLogRef, (current) => [...current, command as Record<string, unknown>])

            return yield* Match.value(command._tag).pipe(
              Match.when('remote:chat_v2_open_session', () =>
                Effect.succeed({
                  ok: true,
                  data: {
                    sessionId: 'session-1',
                    nodeId: command.nodeId,
                    role: command.role,
                    agentId: 'agent-1',
                    headSeq: 1,
                  },
                }),
              ),
              Match.when('remote:chat_v2_send', () =>
                Effect.succeed({
                  ok: true,
                  data: {
                    accepted: true,
                    sessionId: command.sessionId,
                  },
                }),
              ),
              Match.when('remote:chat_v2_get_snapshot', () =>
                Effect.succeed({
                  ok: true,
                  data: {
                    sessionId: command.sessionId,
                    headSeq: 2,
                    events: [],
                  },
                }),
              ),
              Match.orElse(() => Effect.succeed({ ok: true, data: {} })),
            )
          }),
        events: Stream.fromPubSub(eventsPubSub),
      } satisfies HarnessBrowserTransportShape)

      const runtimeLayer = HarnessRuntimeBrowserLive.pipe(
        Layer.provide(transportLayer),
      )

      const [session, ack, snapshot, commandLog] = yield* Effect.gen(function* () {
        const runtime = yield* HarnessRuntime

        const session = yield* runtime.openSession('node-browser', 'general', { forceNew: true })
        const ack = yield* runtime.send(
          session.sessionId,
          'client-1' as any,
          'hello browser runtime',
          Option.none(),
        )
        const snapshot = yield* runtime.getSnapshot(session.sessionId, Option.none())

        const commandLog = yield* Ref.get(commandLogRef)
        return [session, ack, snapshot, commandLog] as const
      }).pipe(Effect.provide(runtimeLayer))

      expect(session.backend).toBe('pi-ai')
      expect(ack.accepted).toBe(true)
      expect(snapshot.headSeq).toBe(2)

      expect(commandLog.some((entry) => entry._tag === 'remote:chat_v2_open_session')).toBe(true)
      expect(commandLog.some((entry) => entry._tag === 'remote:chat_v2_open_session' && entry.forceNew === true)).toBe(true)
      expect(commandLog.some((entry) => entry._tag === 'remote:chat_v2_send')).toBe(true)
      expect(commandLog.some((entry) => entry._tag === 'remote:chat_v2_get_snapshot')).toBe(true)
    }),
  )

  it.effect('decodes remote chat-v2 events from browser transport stream', () =>
    Effect.gen(function* () {
      const transportLayer = Layer.succeed(HarnessBrowserTransport, {
        request: () => Effect.succeed({ ok: true, data: {} }),
        events: Stream.succeed({
          _tag: 'remote:chat_v2_event',
          event: {
            _tag: 'chat:v2/session_opened',
            sessionId: 'session-e1',
            seq: 1,
            at: Date.now(),
            nodeId: 'node-e1',
            role: 'general',
            agentId: 'agent-e1',
          },
        }),
      } satisfies HarnessBrowserTransportShape)

      const runtimeLayer = HarnessRuntimeBrowserLive.pipe(Layer.provide(transportLayer))

      const maybeEvent = yield* Effect.gen(function* () {
        const runtime = yield* HarnessRuntime
        return yield* Stream.runHead(runtime.events)
      }).pipe(Effect.provide(runtimeLayer))

      expect(maybeEvent._tag).toBe('Some')
      if (maybeEvent._tag === 'Some') {
        expect(maybeEvent.value._tag).toBe('chat:v2/session_opened')
      }
    }),
  )
})
