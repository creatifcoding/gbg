/**
 * STX Streaming Testbed — INSTRUMENTED DIAGNOSTIC
 *
 * Every phase has console.log breadcrumbs.
 * Read output from Vite terminal: [browser:log] lines.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import * as Effect from 'effect-v4/Effect'
import * as Stream from 'effect-v4/Stream'
import { Atom, AtomRegistry } from 'effect-v4/unstable/reactivity'
import { stxLatest, useStxLatest } from '@tmnl/stx'

const S = {
  bg: '#0a0a14',
  panel: { marginBottom: 20, padding: 16, border: '1px solid #333', borderRadius: 8 },
  h2: { fontSize: 14, color: '#888', margin: '0 0 8px' } as const,
  pass: '#00d4aa',
  fail: '#ff4466',
  wait: '#ffaa33',
}

function Badge({ ok }: { ok: boolean | null }) {
  const color = ok === null ? S.wait : ok ? S.pass : S.fail
  const label = ok === null ? 'WAITING' : ok ? 'PASS' : 'FAIL'
  return <span style={{ color, fontWeight: 700, marginLeft: 12, fontSize: 12 }}>[{label}]</span>
}

function DiagnosticPanel() {
  console.log('[STX-DIAG] DiagnosticPanel render')

  // ── Phase 0: React works ──
  const [clicks, setClicks] = useState(0)

  // ── Phase 1: Stream.tick fires ──
  const [tickCount, setTickCount] = useState(0)
  useEffect(() => {
    console.log('[STX-DIAG] Phase 1: mounting Stream.tick effect')
    let count = 0
    const fiber = Effect.runFork(
      Stream.runForEach(
        Stream.tick("200 millis").pipe(
          Stream.mapEffect(() => Effect.sync(() => ++count)),
          Stream.take(20),
        ),
        (n) => Effect.sync(() => {
          if (count <= 3 || count === 10 || count === 20) {
            console.log(`[STX-DIAG] Phase 1: tick ${count}`)
          }
          setTickCount(n as number)
        })
      )
    )
    console.log('[STX-DIAG] Phase 1: fiber forked', fiber)
    return () => { console.log('[STX-DIAG] Phase 1: cleanup') }
  }, [])

  // ── Phase 2a: registry.set + registry.get ──
  const [manualAtomVal, setManualAtomVal] = useState<string>('not tested')
  useEffect(() => {
    console.log('[STX-DIAG] Phase 2a: testing registry.set → registry.get')
    const reg = AtomRegistry.make()
    const a = Atom.make(0)
    console.log('[STX-DIAG] Phase 2a: atom created', a)
    console.log('[STX-DIAG] Phase 2a: atom TypeId check', (a as any)['~effect/reactivity/Atom'] !== undefined)
    reg.mount(a)
    console.log('[STX-DIAG] Phase 2a: atom mounted, get before set =', reg.get(a))
    reg.set(a, 42)
    const got = reg.get(a)
    console.log('[STX-DIAG] Phase 2a: set 42, got', got)
    setManualAtomVal(got === 42 ? `PASS (set 42, got ${got})` : `FAIL (set 42, got ${got})`)
  }, [])

  // ── Phase 2b: registry.subscribe fires ──
  const [subLog, setSubLog] = useState<string[]>([])
  useEffect(() => {
    console.log('[STX-DIAG] Phase 2b: testing registry.subscribe')
    const reg = AtomRegistry.make()
    const a = Atom.make(0)
    reg.mount(a)

    let notifyCount = 0
    const unsub = reg.subscribe(a, (val) => {
      notifyCount++
      console.log(`[STX-DIAG] Phase 2b: subscribe fired #${notifyCount}, val=${val}`)
      setSubLog(prev => [...prev, `notified: ${val} @ ${Date.now()}`])
    })
    console.log('[STX-DIAG] Phase 2b: subscribed, unsub =', typeof unsub)

    setTimeout(() => {
      console.log('[STX-DIAG] Phase 2b: setting value to 1')
      reg.set(a, 1)
    }, 200)
    setTimeout(() => {
      console.log('[STX-DIAG] Phase 2b: setting value to 2')
      reg.set(a, 2)
    }, 400)
    setTimeout(() => {
      console.log('[STX-DIAG] Phase 2b: setting value to 3')
      reg.set(a, 3)
      console.log(`[STX-DIAG] Phase 2b: total notifications so far: ${notifyCount}`)
    }, 600)

    return unsub
  }, [])

  // ── Phase 2c: registry.set from inside Effect.runFork ──
  const [effectSetLog, setEffectSetLog] = useState<string[]>([])
  useEffect(() => {
    console.log('[STX-DIAG] Phase 2c: testing set FROM INSIDE Effect.runFork')
    const reg = AtomRegistry.make()
    const a = Atom.make(0)
    reg.mount(a)

    let notifyCount = 0
    const unsub = reg.subscribe(a, (val) => {
      notifyCount++
      console.log(`[STX-DIAG] Phase 2c: subscribe fired #${notifyCount}, val=${val}`)
      setEffectSetLog(prev => [...prev, `notified: ${val}`])
    })

    // Set from inside Effect.sync inside Effect.runFork
    const fiber = Effect.runFork(
      Effect.gen(function*() {
        console.log('[STX-DIAG] Phase 2c: inside Effect.gen, about to set 100')
        reg.set(a, 100)
        console.log('[STX-DIAG] Phase 2c: set 100, get =', reg.get(a))

        yield* Effect.sleep("200 millis")
        console.log('[STX-DIAG] Phase 2c: after sleep, about to set 200')
        reg.set(a, 200)
        console.log('[STX-DIAG] Phase 2c: set 200, get =', reg.get(a))

        yield* Effect.sleep("200 millis")
        console.log('[STX-DIAG] Phase 2c: after sleep, about to set 300')
        reg.set(a, 300)
        console.log('[STX-DIAG] Phase 2c: set 300, get =', reg.get(a))
        console.log(`[STX-DIAG] Phase 2c: total notifications: ${notifyCount}`)
      })
    )
    console.log('[STX-DIAG] Phase 2c: fiber forked')

    return unsub
  }, [])

  // ── Phase 3: stxLatest full pipeline ──
  const registry3 = useMemo(() => {
    console.log('[STX-DIAG] Phase 3: creating registry')
    return AtomRegistry.make()
  }, [])

  const latest = useMemo(() => {
    console.log('[STX-DIAG] Phase 3: creating stxLatest')
    let c = 0
    const stream = Stream.tick("300 millis").pipe(
      Stream.mapEffect(() => Effect.sync(() => {
        c++
        if (c <= 3 || c === 10) {
          console.log(`[STX-DIAG] Phase 3: stream emitting ${c}`)
        }
        return c
      })),
      Stream.take(30),
    )
    const inst = stxLatest<number>(stream, registry3)
    console.log('[STX-DIAG] Phase 3: stxLatest created, valueAtom =', inst.value)
    console.log('[STX-DIAG] Phase 3: initial registry.get(valueAtom) =', registry3.get(inst.value))
    return inst
  }, [registry3])

  useEffect(() => () => {
    console.log('[STX-DIAG] Phase 3: disposing')
    latest.control.dispose()
  }, [latest])

  // Hook result
  const hookResult = useStxLatest(latest)
  console.log('[STX-DIAG] Phase 3: useStxLatest returned', {
    value: hookResult.value,
    loading: hookResult.loading,
    error: hookResult.error,
  })

  // Manual subscribe to same atom
  const [manualSubVal, setManualSubVal] = useState<string>('waiting')
  useEffect(() => {
    console.log('[STX-DIAG] Phase 3: subscribing manually to valueAtom')
    let count = 0
    const unsub = registry3.subscribe(latest.value, (val) => {
      count++
      if (count <= 3 || count === 10) {
        console.log(`[STX-DIAG] Phase 3: manual subscribe fired #${count}, val=${val}`)
      }
      setManualSubVal(`${val} @ ${Date.now()}`)
    })
    console.log('[STX-DIAG] Phase 3: manual subscribe registered')
    return unsub
  }, [registry3, latest.value])

  // Poll registry.get
  const [pollVal, setPollVal] = useState<string>('waiting')
  useEffect(() => {
    const id = setInterval(() => {
      const v = registry3.get(latest.value)
      setPollVal(`${v} @ ${Date.now()}`)
    }, 500)
    return () => clearInterval(id)
  }, [registry3, latest.value])

  return (
    <div style={{ background: S.bg, color: '#ddd', fontFamily: '"JetBrains Mono", monospace', padding: 24, minHeight: '100vh' }}>
      <h1 style={{ color: S.pass, fontSize: 22, margin: '0 0 20px' }}>
        STX STREAMING — INSTRUMENTED DIAGNOSTIC
      </h1>

      <section style={S.panel}>
        <h2 style={S.h2}>Phase 0: React <Badge ok={clicks > 0 ? true : null} /></h2>
        <button onClick={() => setClicks(c => c + 1)}
          style={{ background: S.pass, color: '#000', padding: '6px 14px', border: 'none', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
          clicks: {clicks}
        </button>
      </section>

      <section style={S.panel}>
        <h2 style={S.h2}>Phase 1: Stream.tick <Badge ok={tickCount > 0 ? true : null} /></h2>
        <div style={{ fontSize: 20, color: tickCount > 0 ? S.pass : S.fail }}>ticks: {tickCount} / 20</div>
      </section>

      <section style={S.panel}>
        <h2 style={S.h2}>Phase 2a: set→get <Badge ok={manualAtomVal.startsWith('PASS') ? true : manualAtomVal === 'not tested' ? null : false} /></h2>
        <div style={{ fontSize: 13 }}>{manualAtomVal}</div>
      </section>

      <section style={S.panel}>
        <h2 style={S.h2}>Phase 2b: subscribe (setTimeout) <Badge ok={subLog.length >= 3 ? true : subLog.length > 0 ? true : null} /></h2>
        <div style={{ fontSize: 12, color: '#aaa' }}>
          {subLog.length === 0 && <span style={{ color: S.wait }}>waiting...</span>}
          {subLog.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </section>

      <section style={S.panel}>
        <h2 style={S.h2}>Phase 2c: subscribe (Effect.runFork) <Badge ok={effectSetLog.length >= 3 ? true : effectSetLog.length > 0 ? true : null} /></h2>
        <div style={{ fontSize: 12, color: '#aaa' }}>
          {effectSetLog.length === 0 && <span style={{ color: S.wait }}>waiting...</span>}
          {effectSetLog.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </section>

      <section style={S.panel}>
        <h2 style={S.h2}>Phase 3: stxLatest→useStxLatest <Badge ok={hookResult.value !== undefined ? true : null} /></h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: '#666' }}>useStxLatest().value:</div>
            <div style={{ fontSize: 20, color: hookResult.value !== undefined ? S.pass : S.fail, fontWeight: 700 }}>
              {hookResult.value !== undefined ? String(hookResult.value) : 'undefined'}
            </div>
            <div style={{ fontSize: 11, color: '#555' }}>loading: {String(hookResult.loading)} | error: {hookResult.error ? String(hookResult.error) : 'none'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#666' }}>manual subscribe:</div>
            <div style={{ fontSize: 14, color: manualSubVal !== 'waiting' ? S.pass : S.wait }}>{manualSubVal}</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>poll (500ms):</div>
            <div style={{ fontSize: 14, color: pollVal !== 'waiting' ? S.pass : S.wait }}>{pollVal}</div>
          </div>
        </div>
      </section>

      <div style={{ fontSize: 11, color: '#444', marginTop: 24, lineHeight: 1.8 }}>
        2c fail → registry.set inside Effect.runFork doesn't notify subscribers<br/>
        3 poll=works but subscribe=fail → set stores but doesn't notify from fiber context<br/>
        3 poll=stuck → stream not running inside materializer<br/>
        Check [browser:log] in Vite terminal for [STX-DIAG] breadcrumbs
      </div>
    </div>
  )
}

export function StxStreamingTestbed() {
  return <DiagnosticPanel />
}

export default StxStreamingTestbed
