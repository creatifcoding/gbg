/**
 * TOC Probe 18: Don't fork runRaw. Run it inline with the scope.
 * Hypothesis: Effect.fork creates a child scope that gets cleaned up
 * when the parent (ManagedRuntime.runPromise) completes.
 */
import { Effect, Layer, ManagedRuntime, Context, Deferred, Ref, Option, HashMap, Fiber, Scope } from 'effect'
import * as Socket from '@effect/platform/Socket'

const WS_URL = 'ws://127.0.0.1:8787/api/harness/ws'

interface TestTransport { readonly request: (msg: object) => Effect.Effect<unknown, Error> }
const TestTransport = Context.GenericTag<TestTransport>('TestTransport')

const TestTransportLive = Layer.scoped(
  TestTransport,
  Effect.gen(function* () {
    const pendingRef = yield* Ref.make<HashMap.HashMap<string, Deferred.Deferred<unknown, Error>>>(HashMap.empty())
    
    // Create socket eagerly (not lazily)
    const socket = yield* Socket.fromWebSocket(
      Effect.sync(() => new WebSocket(WS_URL)),
      { openTimeout: '10 seconds' },
    )
    const write = yield* socket.writer
    const connected = yield* Deferred.make<void, Error>()

    // Fork runRaw using Effect.forkScoped so it's tied to the Layer scope, not a child
    yield* Effect.forkScoped(
      socket.runRaw(
        (chunk) =>
          Effect.gen(function* () {
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
          }).pipe(
            Effect.catchAllCause((cause) =>
              Effect.sync(() => console.error(`[handler] DIED`))
            ),
          ),
        { onOpen: Deferred.succeed(connected, undefined) },
      ).pipe(
        Effect.catchAllCause((cause) =>
          Effect.sync(() => console.error('[loop] DIED'))
        ),
      ),
    )

    yield* Deferred.await(connected)
    console.log('[transport] connected')

    const request: TestTransport['request'] = (msg) =>
      Effect.gen(function* () {
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
    yield* t.request({ _tag: 'remote:chat_v2_open_session', nodeId: 'p18-a', role: 'general' })
    console.log('[1] ✓')
  }))

  await new Promise(r => setTimeout(r, 500))

  console.log('\n=== R2 ===')
  const r2 = await mr.runPromise(Effect.gen(function* () {
    const t = yield* TestTransport
    return yield* t.request({ _tag: 'remote:chat_v2_open_session', nodeId: 'p18-b', role: 'general' })
  }).pipe(Effect.timeout('5 seconds')))
  console.log('[2]', r2 ? '✓' : '✗ TIMEOUT')

  await mr.dispose()
}

test().then(
  () => { console.log('PASS'); process.exit(0) },
  (err) => { console.error('FAIL:', err); process.exit(1) },
)
