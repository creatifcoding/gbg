import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Match, Option, PubSub, Ref, Schema, Stream } from 'effect'

import {
  HarnessBrowserTransport,
  type HarnessBrowserTransportShape,
} from '../HarnessBrowserTransport'
import { HarnessRuntime } from '../HarnessRuntime'
import { HarnessRuntimeBrowserLive } from '../HarnessRuntimeBrowser'
import { HarnessRemoteCommand, HarnessWsRequestEnvelope } from '../HarnessBrowserRemoteSchemas'

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

  it.effect('maps pi session commands over browser transport', () =>
    Effect.gen(function* () {
      const commandLogRef = yield* Ref.make<Array<Record<string, unknown>>>([])
      const eventsPubSub = yield* PubSub.unbounded<unknown>()

      const transportLayer = Layer.succeed(HarnessBrowserTransport, {
        request: (command) =>
          Effect.gen(function* () {
            yield* Ref.update(commandLogRef, (current) => [...current, command as Record<string, unknown>])

            return yield* Match.value(command._tag).pipe(
              Match.when('remote:list_pi_sessions', () =>
                Effect.succeed({
                  ok: true,
                  data: {
                    sessions: [
                      {
                        _tag: 'PiSessionListItem',
                        ref: {
                          _tag: 'PiCliSessionRef',
                          id: 'pi-session-1',
                          path: '/tmp/pi-session-1.jsonl',
                          cwd: '/workspace/tmnl',
                        },
                        title: 'pi replay',
                        createdAt: 1,
                        updatedAt: 2,
                        messageCount: 2,
                        preview: 'hello from pi',
                        allMessagesText: 'hello from pi assistant reply',
                        localProject: true,
                        sourceRank: 0,
                      },
                    ],
                    loadedAt: 3,
                    elapsedMs: 4,
                    scope: command.options?.scope ?? 'current-plus-all',
                  },
                }),
              ),
              Match.when('remote:load_pi_session_snapshot', () =>
                Effect.succeed({
                  ok: true,
                  data: {
                    sessionId: command.sessionId ?? 'pi:pi-session-1',
                    headSeq: 0,
                    events: [],
                  },
                }),
              ),
              Match.when('remote:load_pi_session_preview_snapshot', () =>
                Effect.succeed({
                  ok: true,
                  data: {
                    sessionId: command.args.sessionId ?? 'pi:pi-session-1',
                    headSeq: 1_000_000_001,
                    events: [],
                  },
                }),
              ),
              Match.orElse(() => Effect.succeed({ ok: true, data: {} })),
            )
          }),
        events: Stream.fromPubSub(eventsPubSub),
      } satisfies HarnessBrowserTransportShape)

      const runtimeLayer = HarnessRuntimeBrowserLive.pipe(Layer.provide(transportLayer))

      const [list, snapshot, preview, commandLog] = yield* Effect.gen(function* () {
        const runtime = yield* HarnessRuntime
        const list = yield* runtime.listPiSessions({ scope: 'current', limit: 5 })
        const snapshot = yield* runtime.loadPiSessionSnapshot({
          path: '/tmp/pi-session-1.jsonl',
          sessionId: 'pi:custom-session-1',
        })
        const preview = yield* runtime.loadPiSessionPreviewSnapshot({
          path: '/tmp/pi-session-1.jsonl',
          sessionId: 'pi:preview-session-1',
          maxEntries: 12,
        })
        const commandLog = yield* Ref.get(commandLogRef)
        return [list, snapshot, preview, commandLog] as const
      }).pipe(Effect.provide(runtimeLayer))

      expect(list.sessions).toHaveLength(1)
      expect(list.sessions[0].ref.id).toBe('pi-session-1')
      expect(snapshot.sessionId).toBe('pi:custom-session-1')
      expect(preview.sessionId).toBe('pi:preview-session-1')
      expect(preview.headSeq).toBe(1_000_000_001)
      expect(commandLog.some((entry) => entry._tag === 'remote:list_pi_sessions')).toBe(true)
      expect(commandLog.some((entry) => entry._tag === 'remote:list_pi_sessions' && (entry.options as any)?.scope === 'current')).toBe(true)
      expect(commandLog.some((entry) => entry._tag === 'remote:load_pi_session_snapshot')).toBe(true)
      expect(commandLog.some((entry) => entry._tag === 'remote:load_pi_session_preview_snapshot')).toBe(true)
    }),
  )

  it('decodes pi session commands in the remote schema union', () => {
    const listCommand = Schema.decodeSync(HarnessRemoteCommand)({
      _tag: 'remote:list_pi_sessions' as const,
      options: { scope: 'current' as const, limit: 10 },
    })
    expect(listCommand._tag).toBe('remote:list_pi_sessions')

    const loadEnvelope = Schema.decodeSync(HarnessWsRequestEnvelope)({
      _tag: 'remote:ws_request' as const,
      requestId: 'req-pi-load',
      command: {
        _tag: 'remote:load_pi_session_snapshot' as const,
        path: '/tmp/pi-session.jsonl',
        sessionId: 'pi:session-1',
      },
    })
    expect(loadEnvelope.command._tag).toBe('remote:load_pi_session_snapshot')

    const previewEnvelope = Schema.decodeSync(HarnessWsRequestEnvelope)({
      _tag: 'remote:ws_request' as const,
      requestId: 'req-pi-preview',
      command: {
        _tag: 'remote:load_pi_session_preview_snapshot' as const,
        args: {
          path: '/tmp/pi-session.jsonl',
          sessionId: 'pi:session-1',
          maxEntries: 24,
        },
      },
    })
    expect(previewEnvelope.command._tag).toBe('remote:load_pi_session_preview_snapshot')
  })

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
