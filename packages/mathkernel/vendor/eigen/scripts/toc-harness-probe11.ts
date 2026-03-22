/**
 * TOC Probe 11: Replicate EXACTLY what the transport does.
 * fromWebSocket → socket.writer + socket.runRaw in a forked fiber.
 * Two sequential writes, check if runRaw handler fires for both.
 */
import { Effect, Scope, Deferred, Fiber, Ref, Option, HashMap } from 'effect'
import * as Socket from '@effect/platform/Socket'

const WS_URL = 'ws://127.0.0.1:8787/api/harness/ws'

const program = Effect.scoped(
  Effect.gen(function* () {
    console.log('[1] creating socket...')
    const socket = yield* Socket.fromWebSocket(
      Effect.sync(() => new WebSocket(WS_URL)),
      { openTimeout: '10 seconds' },
    )

    console.log('[2] getting writer...')
    const write = yield* socket.writer

    const pendingRef = yield* Ref.make<HashMap.HashMap<string, Deferred.Deferred<unknown, Error>>>(HashMap.empty())
    const connected = yield* Deferred.make<void, Error>()
    let chunkCount = 0

    // Fork the message loop — exactly like the transport does
    console.log('[3] forking runRaw...')
    const loopFiber = yield* Effect.fork(
      Effect.gen(function* () {
        yield* socket.runRaw(
          (chunk) => Effect.gen(function* () {
            chunkCount++
            const raw = typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
            const parsed = JSON.parse(raw)
            console.log(`[loop] chunk #${chunkCount}: ${parsed._tag} ${parsed.requestId ?? ''}`)

            if (parsed._tag === 'remote:ws_response') {
              const pending = yield* Ref.modify(pendingRef, (map) => {
                const d = HashMap.get(map, parsed.requestId)
                const next = HashMap.remove(map, parsed.requestId)
                return [d, next] as const
              })
              if (Option.isSome(pending)) {
                yield* Deferred.succeed(pending.value, parsed.response)
                console.log(`[loop] resolved ${parsed.requestId}`)
              }
            } else {
              console.log(`[loop] event (ignored)`)
            }
          }),
          { onOpen: Deferred.succeed(connected, undefined) },
        )
        console.log('[loop] runRaw exited')
      }).pipe(
        Effect.catchAll((err) => Effect.sync(() => console.error('[loop] ERROR:', err))),
      ),
    )

    yield* Deferred.await(connected)
    console.log('[4] connected. Sending request 1...')

    // Request 1
    const d1 = yield* Deferred.make<unknown, Error>()
    yield* Ref.update(pendingRef, HashMap.set('r1', d1))
    yield* write(JSON.stringify({
      _tag: 'remote:ws_request',
      requestId: 'r1',
      command: { _tag: 'remote:chat_v2_open_session', nodeId: 'probe11-a', role: 'general' },
    }))
    console.log('[4] sent r1, awaiting...')
    const r1 = yield* Deferred.await(d1).pipe(Effect.timeout('5 seconds'))
    console.log('[4]', r1 ? '✓ r1 response' : '✗ r1 TIMEOUT')

    // Small pause for the event message
    yield* Effect.sleep('300 millis')
    console.log(`[5] chunks so far: ${chunkCount}`)

    // Request 2
    console.log('[6] Sending request 2...')
    const d2 = yield* Deferred.make<unknown, Error>()
    yield* Ref.update(pendingRef, HashMap.set('r2', d2))
    yield* write(JSON.stringify({
      _tag: 'remote:ws_request',
      requestId: 'r2',
      command: { _tag: 'remote:chat_v2_open_session', nodeId: 'probe11-b', role: 'general' },
    }))
    console.log('[6] sent r2, awaiting...')
    const r2 = yield* Deferred.await(d2).pipe(Effect.timeout('5 seconds'))
    console.log('[6]', r2 ? '✓ r2 response' : '✗ r2 TIMEOUT')

    yield* Fiber.interrupt(loopFiber)
    console.log(`[7] total chunks: ${chunkCount}`)
  }),
).pipe(Effect.provide(Socket.layerWebSocketConstructorGlobal))

Effect.runPromise(program).then(
  () => { console.log('PASS'); process.exit(0) },
  (err) => { console.error('FAIL:', err); process.exit(1) },
)
