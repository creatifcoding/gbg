/**
 * TOC Probe 14: Add raw WebSocket event logging to the exact Layer pattern.
 */
import { Effect, Layer, ManagedRuntime, Context, Deferred, Ref, Option, HashMap } from 'effect'
import * as Socket from '@effect/platform/Socket'

const WS_URL = 'ws://127.0.0.1:8787/api/harness/ws'

interface TestTransport { readonly request: (msg: object) => Effect.Effect<unknown, Error> }
const TestTransport = Context.GenericTag<TestTransport>('TestTransport')

const TestTransportLive = Layer.scoped(
  TestTransport,
  Effect.gen(function* () {
    const pendingRef = yield* Ref.make<HashMap.HashMap<string, Deferred.Deferred<unknown, Error>>>(HashMap.empty())
    const writeRef = yield* Ref.make<Option.Option<(chunk: string | Uint8Array | Socket.CloseEvent) => Effect.Effect<void>>>(Option.none())
    let rawWs: WebSocket | null = null

    const connect = Effect.gen(function* () {
      const existing = yield* Ref.get(writeRef)
      if (Option.isSome(existing)) return existing.value

      const socket = yield* Socket.fromWebSocket(
        Effect.sync(() => {
          const ws = new WebSocket(WS_URL)
          rawWs = ws
          console.log('[acquire] WebSocket created')
          return ws
        }),
        { openTimeout: '10 seconds' },
      )
      const write = yield* socket.writer
      const connected = yield* Deferred.make<void, Error>()

      yield* Effect.fork(
        Effect.gen(function* () {
          yield* socket.runRaw(
            (chunk) => Effect.gen(function* () {
              const raw = typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
              const parsed = JSON.parse(raw)
              console.log(`[handler] ${parsed._tag} ${parsed.requestId ?? '(event)'}`)
              if (parsed._tag === 'remote:ws_response') {
                const pending = yield* Ref.modify(pendingRef, (map) => {
                  const d = HashMap.get(map, parsed.requestId)
                  return [d, HashMap.remove(map, parsed.requestId)] as const
                })
                if (Option.isSome(pending)) yield* Deferred.succeed(pending.value, parsed.response)
              }
            }),
            { onOpen: Deferred.succeed(connected, undefined) },
          )
          console.log('[runRaw] EXITED')
        }).pipe(Effect.catchAll((err) => Effect.sync(() => console.error('[loop] ERROR:', err)))),
      )

      yield* Deferred.await(connected)
      yield* Ref.set(writeRef, Option.some(write))
      console.log('[connect] ready')
      return write
    })

    const request: TestTransport['request'] = (msg) =>
      Effect.gen(function* () {
        const write = yield* connect
        const requestId = `r-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        const d = yield* Deferred.make<unknown, Error>()
        yield* Ref.update(pendingRef, HashMap.set(requestId, d))
        yield* write(JSON.stringify({ _tag: 'remote:ws_request', requestId, command: msg }))
        console.log(`[request] wrote ${requestId}, readyState=${rawWs?.readyState}`)
        return yield* Deferred.await(d).pipe(Effect.timeout('5 seconds'))
      })

    return TestTransport.of({ request })
  }),
).pipe(Layer.provide(Socket.layerWebSocketConstructorGlobal))

async function test() {
  const mr = ManagedRuntime.make(TestTransportLive)

  console.log('=== REQUEST 1 ===')
  await mr.runPromise(Effect.gen(function* () {
    const t = yield* TestTransport
    yield* t.request({ _tag: 'remote:chat_v2_open_session', nodeId: 'p14-a', role: 'general' })
    console.log('[1] ✓')
  }))

  // After request 1, install a RAW onmessage listener to see if the browser even fires it
  console.log('\n=== REQUEST 2 ===')
  const r2 = await mr.runPromise(Effect.gen(function* () {
    const t = yield* TestTransport
    return yield* t.request({ _tag: 'remote:chat_v2_open_session', nodeId: 'p14-b', role: 'general' })
  }).pipe(Effect.timeout('5 seconds')))
  console.log('[2]', r2 ? '✓' : '✗ TIMEOUT')

  await mr.dispose()
}

test().then(
  () => { console.log('PASS'); process.exit(0) },
  (err) => { console.error('FAIL:', err); process.exit(1) },
)
