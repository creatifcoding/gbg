/**
 * TOC Probe 6: Instrument the transport message loop.
 * Add console.log at every step to see where it stops.
 */
import { Effect, Layer, ManagedRuntime, HashMap, Ref, Option, Deferred, Fiber, PubSub, Stream, Match, Either, Schema } from 'effect'
import * as Socket from '@effect/platform/Socket'
import {
  HarnessWsIncomingEnvelope,
  HarnessWsOutgoingEnvelope,
} from '../src/lib/harness/HarnessBrowserRemoteSchemas'

const WS_URL = 'ws://127.0.0.1:8787/api/harness/ws'

const program = Effect.scoped(
  Effect.gen(function* () {
    const pendingRef = yield* Ref.make<HashMap.HashMap<string, Deferred.Deferred<unknown, Error>>>(HashMap.empty())
    const eventCount = { value: 0 }

    // Open socket
    console.log('[transport] connecting to', WS_URL)
    const socket = yield* Socket.fromWebSocket(
      Effect.sync(() => new WebSocket(WS_URL)),
      { openTimeout: '10 seconds' },
    )
    const write = yield* socket.writer
    const connected = yield* Deferred.make<void, Error>()

    // Fork message loop
    const messageLoopFiber = yield* Effect.fork(
      Effect.gen(function* () {
        yield* socket.runRaw(
          (chunk) =>
            Effect.gen(function* () {
              const raw = typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
              console.log(`[loop] raw chunk received (${raw.length} chars)`)
              
              const parsed = JSON.parse(raw)
              console.log('[loop] parsed _tag:', parsed._tag, 'requestId:', parsed.requestId ?? 'n/a')
              
              if (parsed._tag === 'remote:ws_response') {
                const pending = yield* Ref.modify(pendingRef, (map) => {
                  const deferred = HashMap.get(map, parsed.requestId)
                  const next = HashMap.remove(map, parsed.requestId)
                  return [deferred, next] as const
                })
                console.log('[loop] pending match:', Option.isSome(pending) ? 'FOUND' : 'NOT FOUND')
                if (Option.isSome(pending)) {
                  yield* Deferred.succeed(pending.value, parsed.response)
                  console.log('[loop] deferred resolved')
                }
              } else if (parsed._tag === 'remote:ws_event') {
                eventCount.value++
                console.log('[loop] event #', eventCount.value)
              }
              
              console.log('[loop] chunk handler done')
            }),
          { onOpen: Deferred.succeed(connected, undefined) },
        )
        console.log('[loop] runRaw exited')
      }).pipe(
        Effect.catchAll((err) => Effect.sync(() => console.error('[loop] ERROR:', err))),
      ),
    )
    
    yield* Deferred.await(connected)
    console.log('[transport] connected, sending request 1...')

    // Request 1
    const d1 = yield* Deferred.make<unknown, Error>()
    yield* Ref.update(pendingRef, HashMap.set('r1', d1))
    yield* write(JSON.stringify({
      _tag: 'remote:ws_request',
      requestId: 'r1',
      command: { _tag: 'remote:chat_v2_open_session', nodeId: 'probe6-a', role: 'general' },
    }))
    console.log('[transport] request 1 sent, awaiting...')
    const resp1 = yield* Deferred.await(d1).pipe(Effect.timeout('5 seconds'))
    console.log('[transport] response 1:', resp1 ? '✓' : 'TIMEOUT')

    // Wait a beat for the event
    yield* Effect.sleep('500 millis')
    console.log('[transport] events received so far:', eventCount.value)

    // Request 2
    console.log('[transport] sending request 2...')
    const d2 = yield* Deferred.make<unknown, Error>()
    yield* Ref.update(pendingRef, HashMap.set('r2', d2))
    yield* write(JSON.stringify({
      _tag: 'remote:ws_request',
      requestId: 'r2',
      command: { _tag: 'remote:chat_v2_open_session', nodeId: 'probe6-b', role: 'general' },
    }))
    console.log('[transport] request 2 sent, awaiting...')
    const resp2 = yield* Deferred.await(d2).pipe(Effect.timeout('5 seconds'))
    console.log('[transport] response 2:', resp2 ? '✓' : 'TIMEOUT')

    yield* Fiber.interrupt(messageLoopFiber)
  }),
)

Effect.runPromise(program.pipe(Effect.provide(Socket.layerWebSocketConstructorGlobal))).then(
  () => { console.log('PASS'); process.exit(0) },
  (err) => { console.error('FAIL:', err); process.exit(1) },
)
