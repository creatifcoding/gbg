/**
 * TOC Probe 12: Replicate the LAYER pattern.
 * Layer.scoped → lazy connect → forked runRaw → sequential requests via ManagedRuntime.
 */
import { Effect, Layer, ManagedRuntime, Context, Scope, Deferred, Fiber, Ref, Option, HashMap } from 'effect'
import * as Socket from '@effect/platform/Socket'

const WS_URL = 'ws://127.0.0.1:8787/api/harness/ws'

// Minimal service tag
interface TestTransport {
  readonly request: (msg: object) => Effect.Effect<unknown, Error>
}
const TestTransport = Context.GenericTag<TestTransport>('TestTransport')

const TestTransportLive = Layer.scoped(
  TestTransport,
  Effect.gen(function* () {
    const pendingRef = yield* Ref.make<HashMap.HashMap<string, Deferred.Deferred<unknown, Error>>>(HashMap.empty())
    const writeRef = yield* Ref.make<Option.Option<(chunk: string | Uint8Array | Socket.CloseEvent) => Effect.Effect<void>>>(Option.none())

    const connect = Effect.gen(function* () {
      const existing = yield* Ref.get(writeRef)
      if (Option.isSome(existing)) {
        console.log('[transport] reusing socket')
        return existing.value
      }

      console.log('[transport] opening socket...')
      const socket = yield* Socket.fromWebSocket(
        Effect.sync(() => new WebSocket(WS_URL)),
        { openTimeout: '10 seconds' },
      )
      const write = yield* socket.writer
      const connected = yield* Deferred.make<void, Error>()

      const loopFiber = yield* Effect.fork(
        Effect.gen(function* () {
          yield* socket.runRaw(
            (chunk) => Effect.gen(function* () {
              const raw = typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
              const parsed = JSON.parse(raw)
              console.log(`[loop] ${parsed._tag} ${parsed.requestId ?? ''}`)

              if (parsed._tag === 'remote:ws_response') {
                const pending = yield* Ref.modify(pendingRef, (map) => {
                  const d = HashMap.get(map, parsed.requestId)
                  const next = HashMap.remove(map, parsed.requestId)
                  return [d, next] as const
                })
                if (Option.isSome(pending)) {
                  yield* Deferred.succeed(pending.value, parsed.response)
                }
              }
            }),
            { onOpen: Deferred.succeed(connected, undefined) },
          )
        }).pipe(
          Effect.catchAll((err) => Effect.sync(() => console.error('[loop] ERROR:', err))),
        ),
      )

      yield* Deferred.await(connected)
      yield* Ref.set(writeRef, Option.some(write))
      console.log('[transport] connected')
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

    yield* Effect.addFinalizer(() => Effect.sync(() => console.log('[transport] finalized')))

    return TestTransport.of({ request })
  }),
).pipe(Layer.provide(Socket.layerWebSocketConstructorGlobal))

async function test() {
  const mr = ManagedRuntime.make(TestTransportLive)

  console.log('[1] request...')
  const r1 = await mr.runPromise(Effect.gen(function* () {
    const t = yield* TestTransport
    return yield* t.request({ _tag: 'remote:chat_v2_open_session', nodeId: 'probe12-a', role: 'general' })
  }))
  console.log('[1] ✓')

  console.log('[2] request...')
  const r2 = await mr.runPromise(Effect.gen(function* () {
    const t = yield* TestTransport
    return yield* t.request({ _tag: 'remote:chat_v2_open_session', nodeId: 'probe12-b', role: 'general' })
  }).pipe(Effect.timeout('5 seconds')))
  console.log('[2]', r2 ? '✓' : '✗ TIMEOUT')

  await mr.dispose()
}

test().then(
  () => { console.log('PASS'); process.exit(0) },
  (err) => { console.error('FAIL:', err); process.exit(1) },
)
