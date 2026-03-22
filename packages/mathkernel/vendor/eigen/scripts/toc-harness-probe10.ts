/**
 * TOC Probe 10: Does FiberSet.runtime work for multiple runFork calls
 * from a synchronous WebSocket callback?
 */
import { Effect, FiberSet, Scope, Deferred, Runtime, Fiber, Exit } from 'effect'

const program = Effect.scoped(
  Effect.gen(function* () {
    const scope = yield* Effect.scope
    const fiberSet = yield* FiberSet.make().pipe(Scope.extend(scope))
    const run = yield* FiberSet.runtime(fiberSet)<void>()

    // Simulate WebSocket onMessage firing 3 times synchronously
    let callCount = 0
    const results: string[] = []

    const handler = (msg: string) => {
      callCount++
      const n = callCount
      console.log(`[handler] called #${n}: "${msg}"`)
      const eff = Effect.gen(function* () {
        console.log(`[fiber #${n}] started`)
        results.push(msg)
        console.log(`[fiber #${n}] done, results:`, results)
      })
      const fiber = run(eff)
      console.log(`[handler] fiber #${n} forked, interrupted?`, fiber === undefined)
    }

    // Simulate sync dispatch (like WebSocket onMessage)
    handler('msg-1')
    handler('msg-2')
    handler('msg-3')

    // Give fibers time to run
    yield* Effect.sleep('500 millis')
    
    console.log('[main] results:', results)
    console.log('[main] expected 3, got', results.length)
    
    if (results.length !== 3) {
      console.error('[main] ✗ FAILED — not all fibers ran')
    } else {
      console.log('[main] ✓ ALL FIBERS RAN')
    }
  }),
)

Effect.runPromise(program).then(
  () => process.exit(0),
  (err) => { console.error('FAIL:', err); process.exit(1) },
)
