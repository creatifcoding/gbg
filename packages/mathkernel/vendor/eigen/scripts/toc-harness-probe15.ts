/**
 * TOC Probe 15: Attach a native message listener ALONGSIDE runRaw
 * to verify if the browser WebSocket even receives message 2.
 */
import { Effect, Layer, ManagedRuntime, Context, Deferred, Ref, Option, HashMap } from 'effect'
import * as Socket from '@effect/platform/Socket'

const WS_URL = 'ws://127.0.0.1:8787/api/harness/ws'

interface TestTransport { readonly request: (msg: object) => Effect.Effect<unknown, Error> }
const TestTransport = Context.GenericTag<TestTransport>('TestTransport')

let rawWsRef: WebSocket | null = null

const TestTransportLive = Layer.scoped(
  TestTransport,
  Effect.gen(function* () {
    const pendingRef = yield* Ref.make<HashMap.HashMap<string, Deferred.Deferred<unknown, Error>>>(HashMap.empty())
    const writeRef = yield* Ref.make<Option.Option<(chunk: string | Uint8Array | Socket.CloseEvent) => Effect.Effect<void>>>(Option.none())

    const connect = Effect.gen(function* () {
      const existing = yield* Ref.get(writeRef)
      if (Option.isSome(existing)) return existing.value

      const socket = yield* Socket.fromWebSocket(
        Effect.sync(() => {
          const ws = new WebSocket(WS_URL)
          rawWsRef = ws
          // Native listener to prove browser receives messages
          ws.addEventListener('message', (event) => {
            const data = typeof event.data === 'string' ? event.data : ''
            const parsed = JSON.parse(data)
            console.log(`[NATIVE] msg: ${parsed._tag} ${parsed.requestId ?? ''}`)
          })
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
              console.log(`[EFFECT] msg: ${parsed._tag} ${parsed.requestId ?? ''}`)
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
          console.log('[runRaw] EXITED NORMALLY')
        }).pipe(Effect.catchAll((err) => Effect.sync(() => console.error('[loop] ERROR:', err)))),
      )

      yield* Deferred.await(connected)
      yield* Ref.set(writeRef, Option.some(write))
      return write
    })

    const request: TestTransport['request'] = (msg) =>
      Effect.gen(function* () {
        const write = yield* connect
        const requestId = `r-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        const d = yield* Deferred.make<unknown, Error>()
        yield* Ref.update(pendingRef, HashMap.set(requestId, d))
        yield* write(JSON.stringify({ _tag: 'remote:ws_request', requestId, command: msg }))
        console.log(`[request] sent ${requestId}`)
        return yield* Deferred.await(d).pipe(Effect.timeout('5 seconds'))
      })

    return TestTransport.of({ request })
  }),
).pipe(Layer.provide(Socket.layerWebSocketConstructorGlobal))

async function test() {
  const mr = ManagedRuntime.make(TestTransportLive)

  console.log('=== R1 ===')
  await mr.runPromise(Effect.gen(function* () {
    const t = yield* TestTransport
    yield* t.request({ _tag: 'remote:chat_v2_open_session', nodeId: 'p15-a', role: 'general' })
    console.log('[1] ✓')
  }))

  // Wait for event
  await new Promise(r => setTimeout(r, 500))

  console.log('\n=== R2 ===')
  const r2 = await mr.runPromise(Effect.gen(function* () {
    const t = yield* TestTransport
    return yield* t.request({ _tag: 'remote:chat_v2_open_session', nodeId: 'p15-b', role: 'general' })
  }).pipe(Effect.timeout('5 seconds')))
  console.log('[2]', r2 ? '✓' : '✗ TIMEOUT')

  await mr.dispose()
}

test().then(
  () => { console.log('PASS'); process.exit(0) },
  (err) => { console.error('FAIL:', err); process.exit(1) },
)
