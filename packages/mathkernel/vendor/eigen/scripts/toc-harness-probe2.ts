/**
 * TOC Probe 2: Isolate the transport request/response matching.
 * Two sequential requests on the same ManagedRuntime.
 */
import { Effect, Layer, ManagedRuntime, Option, Ref, HashMap } from 'effect'
import { HarnessRuntime } from '../src/lib/harness/HarnessRuntime'
import { HarnessRuntimeBrowserLive } from '../src/lib/harness/HarnessRuntimeBrowser'
import {
  HarnessBrowserTransport,
  HarnessBrowserTransportWebSocketDefault,
} from '../src/lib/harness/HarnessBrowserTransport'

const FullLayer = HarnessRuntimeBrowserLive.pipe(
  Layer.provide(HarnessBrowserTransportWebSocketDefault),
)

async function test() {
  const mr = ManagedRuntime.make(FullLayer)

  // Call 1 — works
  console.log('[1] openSession...')
  const s1 = await mr.runPromise(
    Effect.gen(function* () {
      const rt = yield* HarnessRuntime
      return yield* rt.openSession('toc-a', 'general')
    }),
  )
  console.log('[1] ✓', s1.sessionId)

  // Call 2 — DIFFERENT nodeId to avoid server-side session cache
  console.log('[2] openSession (different node)...')
  const s2 = await mr.runPromise(
    Effect.gen(function* () {
      const rt = yield* HarnessRuntime
      return yield* rt.openSession('toc-b', 'general')
    }).pipe(Effect.timeout('5 seconds')),
  )
  console.log('[2]', s2 ? `✓ ${(s2 as any).sessionId}` : '✗ TIMEOUT')

  await mr.dispose()
}

test().then(
  () => { console.log('PASS'); process.exit(0) },
  (err) => { console.error('FAIL:', err); process.exit(1) },
)
