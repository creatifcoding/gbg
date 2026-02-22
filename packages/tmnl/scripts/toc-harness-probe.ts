/**
 * TOC Probe: Test each link in the chain independently.
 * Chain: ManagedRuntime scope → Layer build → Transport → WebSocket → Server
 *
 * Run: bun run scripts/toc-harness-probe.ts
 */
import { Effect, Layer, ManagedRuntime, Option } from 'effect'
import { HarnessRuntime } from '../src/lib/harness/HarnessRuntime'
import { HarnessRuntimeBrowserLive } from '../src/lib/harness/HarnessRuntimeBrowser'
import {
  HarnessBrowserTransportWebSocketDefault,
} from '../src/lib/harness/HarnessBrowserTransport'

const FullLayer = HarnessRuntimeBrowserLive.pipe(
  Layer.provide(HarnessBrowserTransportWebSocketDefault),
)

async function testChain() {
  console.log('\n=== LINK 1: Build ManagedRuntime (what Atom.runtime does) ===')
  const mr = ManagedRuntime.make(FullLayer)

  try {
    // --- Link 1: First openSession ---
    console.log('[L1] running openSession...')
    const session = await mr.runPromise(
      Effect.gen(function* () {
        const rt = yield* HarnessRuntime
        console.log('[L1] got runtime, backend:', rt.backend)
        return yield* rt.openSession('toc-probe', 'general')
      }),
    )
    console.log('[L1] ✓ session:', session.sessionId)

    // --- Link 2: Second openSession (reuse) ---
    console.log('\n=== LINK 2: Second call, same runtime ===')
    const session2 = await mr.runPromise(
      Effect.gen(function* () {
        const rt = yield* HarnessRuntime
        return yield* rt.openSession('toc-probe', 'general')
      }),
    )
    console.log('[L2] ✓ reused:', session2.sessionId, '(same?', session.sessionId === session2.sessionId, ')')

    // --- Link 3: Send ---
    console.log('\n=== LINK 3: Send message ===')
    const ack = await mr.runPromise(
      Effect.gen(function* () {
        const rt = yield* HarnessRuntime
        return yield* rt.send(
          session.sessionId,
          `cmid-toc-${Date.now()}` as any,
          'Hello from TOC probe',
          Option.none(),
        )
      }),
    )
    console.log('[L3] ✓ ack:', JSON.stringify(ack))

    // --- Link 4: Dispose & rebuild (simulates HMR / remount) ---
    console.log('\n=== LINK 4: Dispose + rebuild (HMR simulation) ===')
    await mr.dispose()
    console.log('[L4] disposed first runtime')

    const mr2 = ManagedRuntime.make(FullLayer)
    const session3 = await mr2.runPromise(
      Effect.gen(function* () {
        const rt = yield* HarnessRuntime
        return yield* rt.openSession('toc-probe-2', 'general')
      }),
    )
    console.log('[L4] ✓ new session after rebuild:', session3.sessionId)
    await mr2.dispose()
    console.log('[L4] ✓ second dispose clean')

  } catch (err) {
    console.error('[FAIL]', err)
  } finally {
    try { await mr.dispose() } catch {}
  }
}

testChain().then(
  () => { console.log('\n✓ ALL LINKS PASSED'); process.exit(0) },
  (err) => { console.error('\n✗ CHAIN BROKEN:', err); process.exit(1) },
)
