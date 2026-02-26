/**
 * StreamingLatencyProbe — End-to-end temporal instrumentation for the delta pipeline.
 *
 * Stamps each delta at every pipeline hop, then computes per-stage latency:
 *
 *   Stage 1: SSE → Engine       (event.at = Date.now() at SSE arrival)
 *   Stage 2: Engine processing   (emitDelta or appendEvent)
 *   Stage 3: WS transport        (server send → client receive)
 *   Stage 4: Event processor     (processEvent entry)
 *   Stage 5: Atom flush          (after 48ms coalesce timer fires)
 *   Stage 6: React render        (component commit via useEffect)
 *
 * Usage:
 *   import { streamingLatencyProbe } from '@/lib/harness/perf/StreamingLatencyProbe'
 *
 *   // At each instrumentation point, call:
 *   streamingLatencyProbe.stamp(seq, 'wire')        // SSE arrival
 *   streamingLatencyProbe.stamp(seq, 'engine')      // After emitDelta
 *   streamingLatencyProbe.stamp(seq, 'ws_send')     // Before WS frame write
 *   streamingLatencyProbe.stamp(seq, 'ws_recv')     // After WS frame parse
 *   streamingLatencyProbe.stamp(seq, 'processor')   // processEvent entry
 *   streamingLatencyProbe.stamp(seq, 'atom_flush')  // After atom write
 *   streamingLatencyProbe.stamp(seq, 'react_render')// In useEffect after render
 *
 *   // Get report:
 *   streamingLatencyProbe.report()
 *   streamingLatencyProbe.snapshot()  // Raw data
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export type ProbeStage =
  | 'wire'          // SSE chunk arrives from Anthropic SDK
  | 'engine'        // After emitDelta/appendEvent in engine
  | 'ws_send'       // Before WS frame write (server side)
  | 'ws_recv'       // After WS frame parse (browser side)
  | 'processor'     // harness-event-processor processEvent entry
  | 'atom_flush'    // After atom write (flushPendingAssistantDeltas)
  | 'react_render'  // React component commit (useEffect)

type DeltaTrace = {
  seq: number
  wire?: number           // Date.now() at SSE arrival
  engine?: number
  ws_send?: number
  ws_recv?: number
  processor?: number
  atom_flush?: number
  react_render?: number
}

type StageLatency = {
  stage: string
  p50: number
  p95: number
  p99: number
  mean: number
  count: number
}

// ─── Probe ─────────────────────────────────────────────────────────────────

const RING_SIZE = 2048  // Keep last N deltas

class StreamingLatencyProbeImpl {
  private ring: DeltaTrace[] = new Array(RING_SIZE)
  private seqToIdx = new Map<number, number>()
  private writePos = 0
  private totalStamped = 0
  private _enabled = false

  get enabled() { return this._enabled }

  enable() {
    this._enabled = true
    this.reset()
    console.log('[StreamingLatencyProbe] ✓ enabled — stamping at each pipeline hop')
  }

  disable() {
    this._enabled = false
    console.log('[StreamingLatencyProbe] ✗ disabled')
  }

  reset() {
    this.ring = new Array(RING_SIZE)
    this.seqToIdx.clear()
    this.writePos = 0
    this.totalStamped = 0
  }

  /**
   * Stamp a delta event at a pipeline stage.
   * Uses Date.now() for cross-process compatibility.
   * Call this at each instrumentation point.
   */
  stamp(seq: number, stage: ProbeStage): void {
    if (!this._enabled) return

    const now = Date.now()
    let idx = this.seqToIdx.get(seq)

    if (idx === undefined) {
      // New trace entry — allocate slot in ring
      idx = this.writePos
      this.ring[idx] = { seq }
      this.seqToIdx.set(seq, idx)
      this.writePos = (this.writePos + 1) % RING_SIZE

      // Evict old entry if ring is full
      if (this.writePos < this.totalStamped) {
        const evicted = this.ring[this.writePos]
        if (evicted) this.seqToIdx.delete(evicted.seq)
      }
      this.totalStamped++
    }

    const trace = this.ring[idx]!
    trace[stage] = now
  }

  /**
   * Stamp using an event's existing `at` field as the wire timestamp,
   * plus the current time as the given stage.
   */
  stampFromEvent(event: { seq?: number; at?: number }, stage: ProbeStage): void {
    if (!this._enabled) return
    const seq = (event as any).seq
    if (typeof seq !== 'number') return

    // If this is the first stamp for this seq and the event has `at`, record wire time
    if (!this.seqToIdx.has(seq) && typeof (event as any).at === 'number') {
      this.stamp(seq, 'wire')
      // Overwrite with the event's original timestamp
      const idx = this.seqToIdx.get(seq)!
      this.ring[idx]!.wire = (event as any).at
    }

    this.stamp(seq, stage)
  }

  /**
   * Get all complete traces (have at least wire + one other stamp).
   */
  private getCompleteTraces(): DeltaTrace[] {
    return this.ring.filter(
      (t): t is DeltaTrace => t != null && t.wire != null && Object.keys(t).length > 2
    )
  }

  /**
   * Compute per-stage latency statistics.
   */
  snapshot(): {
    traces: DeltaTrace[]
    stages: StageLatency[]
    summary: {
      totalTraces: number
      completeTraces: number
      e2e: StageLatency | null
    }
  } {
    const traces = this.getCompleteTraces()

    const stagePairs: [string, ProbeStage, ProbeStage][] = [
      ['wire → engine',       'wire',       'engine'],
      ['engine → ws_send',    'engine',     'ws_send'],
      ['ws_send → ws_recv',   'ws_send',    'ws_recv'],
      ['ws_recv → processor', 'ws_recv',    'processor'],
      ['processor → atom',    'processor',  'atom_flush'],
      ['atom → react',        'atom_flush', 'react_render'],
    ]

    const stages: StageLatency[] = stagePairs.map(([name, from, to]) => {
      const diffs: number[] = []
      for (const t of traces) {
        const f = t[from]
        const tt = t[to]
        if (f != null && tt != null) {
          diffs.push(tt - f)
        }
      }
      diffs.sort((a, b) => a - b)

      const count = diffs.length
      if (count === 0) return { stage: name, p50: 0, p95: 0, p99: 0, mean: 0, count: 0 }

      const sum = diffs.reduce((a, b) => a + b, 0)
      return {
        stage: name,
        p50: diffs[Math.floor(count * 0.5)] ?? 0,
        p95: diffs[Math.floor(count * 0.95)] ?? 0,
        p99: diffs[Math.floor(count * 0.99)] ?? 0,
        mean: sum / count,
        count,
      }
    })

    // End-to-end: wire → react_render
    const e2eDiffs: number[] = []
    for (const t of traces) {
      if (t.wire != null && t.react_render != null) {
        e2eDiffs.push(t.react_render - t.wire)
      }
    }
    e2eDiffs.sort((a, b) => a - b)

    const e2e = e2eDiffs.length > 0
      ? {
          stage: 'wire → react (E2E)',
          p50: e2eDiffs[Math.floor(e2eDiffs.length * 0.5)] ?? 0,
          p95: e2eDiffs[Math.floor(e2eDiffs.length * 0.95)] ?? 0,
          p99: e2eDiffs[Math.floor(e2eDiffs.length * 0.99)] ?? 0,
          mean: e2eDiffs.reduce((a, b) => a + b, 0) / e2eDiffs.length,
          count: e2eDiffs.length,
        }
      : null

    return {
      traces,
      stages,
      summary: {
        totalTraces: this.totalStamped,
        completeTraces: traces.length,
        e2e,
      },
    }
  }

  /**
   * Stamp all traces that have `atom_flush` but no `react_render` with the current time.
   * Call this from React's useEffect after DOM commit — it stamps the entire coalesced batch.
   */
  stampReactRender(): void {
    if (!this._enabled) return
    const now = Date.now()
    for (let i = 0; i < this.ring.length; i++) {
      const trace = this.ring[i]
      if (trace && trace.atom_flush != null && trace.react_render == null) {
        trace.react_render = now
      }
    }
  }

  /**
   * Print a formatted report to console.
   */
  report(): void {
    const { stages, summary } = this.snapshot()

    console.log('\n═══════════════════════════════════════════════════════════')
    console.log('  Streaming Latency Probe — Per-Stage Breakdown')
    console.log(`  ${summary.completeTraces} complete traces / ${summary.totalTraces} total stamped`)
    console.log('═══════════════════════════════════════════════════════════\n')

    const pad = (s: string, n: number) => s.padEnd(n)
    const fmt = (n: number) => `${n.toFixed(1)}ms`.padStart(8)

    console.log(`  ${pad('Stage', 24)} ${pad('p50', 9)} ${pad('p95', 9)} ${pad('p99', 9)} ${pad('mean', 9)} count`)
    console.log(`  ${'─'.repeat(24)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(8)} ─────`)

    for (const s of stages) {
      if (s.count === 0) {
        console.log(`  ${pad(s.stage, 24)} ${'—'.padStart(8)} ${'—'.padStart(8)} ${'—'.padStart(8)} ${'—'.padStart(8)}     0`)
      } else {
        console.log(`  ${pad(s.stage, 24)} ${fmt(s.p50)} ${fmt(s.p95)} ${fmt(s.p99)} ${fmt(s.mean)} ${String(s.count).padStart(5)}`)
      }
    }

    if (summary.e2e) {
      console.log(`  ${'─'.repeat(24)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(8)} ─────`)
      const e = summary.e2e
      console.log(`  ${pad(e.stage, 24)} ${fmt(e.p50)} ${fmt(e.p95)} ${fmt(e.p99)} ${fmt(e.mean)} ${String(e.count).padStart(5)}`)
    }

    console.log()
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────

export const streamingLatencyProbe = new StreamingLatencyProbeImpl()

// Expose on globalThis for console access during development
if (typeof globalThis !== 'undefined') {
  ;(globalThis as any).__streamingLatencyProbe = streamingLatencyProbe
}
