# Parse Worker Performance Analysis

## Execution Model Comparison

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MAIN THREAD ONLY (Baseline)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Main Thread:  ──┬─[Network]─┬─[Parse]─┬─[Render]─┬─[Parse]─┬─[Render]──   │
│                  │           │         │          │         │              │
│                  ▼           ▼         ▼          ▼         ▼              │
│  Frame Budget:  ████████████████████████████████████████████████           │
│                 |← 16.67ms →||← blocked →|       |← blocked →|             │
│                                                                             │
│  Problem: Parse blocks render → janky UI                                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        WITH PARSE WORKER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Main Thread:  ──┬─[Network]─┬─[post]─────────────[recv]─┬─[Render]──      │
│                  │           │    │                  │    │                 │
│  Worker:         │           │    └──[Parse]─────────┘    │                 │
│                  │           │                            │                 │
│                  ▼           ▼                            ▼                 │
│  Frame Budget:  ████████████░░░░░░░░░░░░░░░░░░░████████████                │
│                 |← 16.67ms →|    ↑ free time ↑    |← render →|             │
│                                                                             │
│  Benefit: Main thread free during parse → smooth UI                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Cost Model

```
Let:
  T_parse   = JSON.parse(line) + Schema.decode(obj)    [per line]
  T_post    = postMessage serialization overhead       [per batch]
  T_recv    = structured clone + message receive       [per batch]
  N         = lines per batch

Main Thread Cost:
  C_main = N × T_parse                                 [blocking]

Worker Cost:
  C_worker = T_post + T_recv                           [non-blocking]
  C_parse  = N × T_parse                               [parallel, off main]

Total wall time same, but main thread availability differs:

  Main Thread Blocked Time:
    Baseline:  T_blocked = N × T_parse
    Worker:    T_blocked = T_post + T_recv ≈ 2ms      [constant overhead]
```

## Crossover Analysis

```
Worker wins when main thread savings exceed overhead:

  N × T_parse > T_post + T_recv + ε

Where:
  T_parse ≈ 0.1ms per line     (JSON.parse + Schema.decode)
  T_post  ≈ 0.5ms fixed        (postMessage setup)
  T_recv  ≈ 0.5ms fixed        (receive + deserialize)
  ε       ≈ 0.5ms              (context switch, scheduling)

Solving for N:
  N × 0.1ms > 1.5ms
  N > 15 lines

┌──────────────────────────────────────────────────────────────────┐
│                    CROSSOVER POINT                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Main Thread      │                                               │
│  Blocked (ms)     │      Main Thread (baseline)                   │
│                   │           /                                   │
│       40 ─        │          /                                    │
│                   │         /                                     │
│       30 ─        │        /                                      │
│                   │       /                                       │
│       20 ─        │      /                                        │
│                   │     /   Worker (overhead only)                │
│       10 ─        │    / ──────────────────────                   │
│                   │   /                                           │
│        0 ─────────┼──X────────────────────────────                │
│                   │  ↑                                            │
│                   │  N=15 (crossover)                             │
│                   └──────────────────────────────→ Lines (N)      │
│                      10   50   100  200  500                      │
└──────────────────────────────────────────────────────────────────┘
```

## Payload Size Analysis

From research (Surma's postMessage benchmarks):

```
┌─────────────────────────────────────────────────────────────────┐
│              postMessage TRANSFER OVERHEAD                       │
├──────────────┬────────────┬─────────────────────────────────────┤
│ Payload Size │ Overhead   │ Recommendation                       │
├──────────────┼────────────┼─────────────────────────────────────┤
│ < 10 KB      │ < 1ms      │ Skip workers (overhead dominates)    │
│ 10-100 KB    │ 1-10ms     │ Workers beneficial                   │
│ > 100 KB     │ 10-300ms   │ Workers + Transferables required     │
└──────────────┴────────────┴─────────────────────────────────────┘

For NDJSON patches:
  Avg patch size ≈ 100-200 bytes
  10 KB ≈ 50-100 patches

  ∴ Worker beneficial when batch > 50 patches
```

## Amdahl's Law Application

```
Speedup limited by serial portion (postMessage overhead):

  S = 1 / ((1-P) + P/N)

Where:
  P = parallelizable fraction (parsing)
  N = speedup factor (∞ for workers, since it's parallel)

For genifer:
  P ≈ 0.7 (70% is parsing, 30% is render)

  S_max = 1 / (1 - 0.7) = 1 / 0.3 = 3.33x

┌──────────────────────────────────────────────────────────────────┐
│ Maximum theoretical speedup: 3.33x for main thread freedom       │
│ Practical speedup: 2-2.5x (overhead + scheduling)                │
└──────────────────────────────────────────────────────────────────┘
```

## Empirical Expectations

```
Current genifer bottlenecks (from architecture doc):

┌────────────────────┬──────────────┬─────────────┬─────────────┐
│ Bottleneck         │ Location     │ Time/burst  │ Worker?     │
├────────────────────┼──────────────┼─────────────┼─────────────┤
│ JSON.parse(line)   │ streaming.ts │ 5-10ms      │ ✓ Phase 1   │
│ {...spread}        │ schemas.ts   │ 2-5ms       │ ✓ Phase 2   │
│ structuredClone    │ path.ts      │ 3-8ms       │ ✓ Phase 2   │
│ React reconcile    │ renderer.tsx │ 10-20ms     │ ✗ (virtual) │
├────────────────────┼──────────────┼─────────────┼─────────────┤
│ TOTAL              │              │ 20-43ms     │             │
│ After Phase 1      │              │ 10-33ms     │ 20-40% ↓    │
│ After Phase 2      │              │ 10-20ms     │ 50-60% ↓    │
└────────────────────┴──────────────┴─────────────┴─────────────┘

Target: <16.67ms for 60fps
Current: 20-43ms (frame drops)
After workers: 10-20ms (60fps achievable)
```

## Verdict

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CONCLUSION                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Q: Is it faster?                                                        │
│                                                                          │
│  A: WALL CLOCK: No change (same work, different location)                │
│     MAIN THREAD: Yes, 20-40% less blocking (Phase 1)                     │
│     USER EXPERIENCE: Yes, smoother animations during streaming           │
│                                                                          │
│  The win is not raw speed — it's PARALLELISM.                            │
│  Main thread stays free for:                                             │
│    • React rendering                                                     │
│    • User input handling                                                 │
│    • Animation frames                                                    │
│                                                                          │
│  Conditions for benefit:                                                 │
│    • Batch size > 15 lines (~1.5KB)                                      │
│    • Streaming scenario (continuous data)                                │
│    • UI needs to remain responsive during parse                          │
│                                                                          │
│  Not beneficial when:                                                    │
│    • Single small patch (<10 lines)                                      │
│    • Non-streaming one-shot render                                       │
│    • SSR/Node environment (use Fallback layer)                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Benchmark Protocol (to validate)

```typescript
// Add to spike for empirical validation
const benchmark = async (n: number) => {
  const lines = Array(n).fill('{"op":"add","path":"/x","value":1}')

  // Baseline
  const t0 = performance.now()
  for (const line of lines) {
    JSON.parse(line)
  }
  const baseline = performance.now() - t0

  // Worker
  const t1 = performance.now()
  await worker.parseLines(lines)
  const worker = performance.now() - t1

  console.log(`N=${n}: baseline=${baseline}ms, worker=${worker}ms`)
}

// Expected results:
// N=10:  baseline < worker (overhead dominates)
// N=50:  baseline ≈ worker (crossover)
// N=200: baseline > worker (parallelism wins)
```
