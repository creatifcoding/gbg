#!/usr/bin/env bun

import os from 'node:os'

import { Chunk, Deferred, Duration, Effect, Fiber, Layer, Stream } from 'effect'

import {
  OverlayReducerPipeline,
  RenderNode,
  RenderOverlayOutput,
  RenderPatch,
  makeOverlayReducerPipelineLayer,
  type RenderOverlayRegistration,
  type RenderReducerInput,
} from '../../src/lib/harness/rendering'
import {
  type OverlayBenchWorkload,
  makeOverlayBenchFixture,
} from '../../src/lib/harness/__bench__/fixtures/overlay-reducer-fixtures'

type VariantId = 'A-probe' | 'B-fork-join-light' | 'C-fork-join-heavy'

type Variant = {
  readonly id: VariantId
  readonly label: string
  readonly overlays: (fixture: ReadonlyArray<typeof RenderReducerInput.Type>) => ReadonlyArray<RenderOverlayRegistration>
}

type BenchResult = {
  readonly variantId: VariantId
  readonly variantLabel: string
  readonly workload: OverlayBenchWorkload
  readonly eventCount: number
  readonly concurrency: number
  readonly rounds: number
  readonly throughputEventsPerSec: number
  readonly p50LatencyMs: number
  readonly p95LatencyMs: number
  readonly p99LatencyMs: number
  readonly peakBacklog: number
  readonly p95Backlog: number
  readonly avgBatchSize: number
  readonly emissions: number
}

const percentile = (values: ReadonlyArray<number>, p: number): number => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[index] ?? 0
}

const median = (values: ReadonlyArray<number>): number => percentile(values, 50)

const toArray = <A>(chunk: Chunk.Chunk<A>): ReadonlyArray<A> => Array.from(chunk)

const uniqueMatches = (fixture: ReadonlyArray<typeof RenderReducerInput.Type>) => {
  const map = new Map<string, { lane: (typeof fixture)[number]['lane']; class: (typeof fixture)[number]['class'] }>()
  for (const entry of fixture) {
    map.set(`${entry.lane}:${entry.class}`, { lane: entry.lane, class: entry.class })
  }
  return Array.from(map.values())
}

const probeOverlay = (fixture: ReadonlyArray<typeof RenderReducerInput.Type>): RenderOverlayRegistration => ({
  id: 'overlay-probe',
  priority: 1_000,
  matches: uniqueMatches(fixture),
  run: (batch) =>
    Effect.succeed(
      new RenderOverlayOutput({
        overlayId: 'overlay-probe',
        lane: 'control',
        patches: batch.map(
          (entry) =>
            new RenderPatch({
              path: '/probe/seq',
              op: 'append',
              value: entry.seq,
              lane: entry.lane,
              overlayId: 'overlay-probe',
            }),
        ),
        nodes: [],
        diagnostics: [],
      }),
    ),
})

const textOverlay = (yieldSteps = 0): RenderOverlayRegistration => ({
  id: 'overlay-text',
  priority: 500,
  matches: [
    { lane: 'text', class: 'delta' },
    { lane: 'text', class: 'terminal' },
    { lane: 'thinking', class: 'delta' },
  ],
  run: (batch) =>
    Effect.gen(function* () {
      for (let i = 0; i < yieldSteps; i += 1) {
        yield* Effect.yieldNow()
      }

      return new RenderOverlayOutput({
        overlayId: 'overlay-text',
        lane: 'text',
        patches: batch.map(
          (entry) =>
            new RenderPatch({
              path: '/text/lane',
              op: entry.class === 'delta' ? 'append' : 'set',
              value: `${entry.tag}:${entry.seq}`,
              lane: entry.lane,
              overlayId: 'overlay-text',
            }),
        ),
        nodes: [],
        diagnostics: [],
      })
    }),
})

const controlOverlay = (yieldSteps = 0): RenderOverlayRegistration => ({
  id: 'overlay-control',
  priority: 400,
  matches: [
    { lane: 'control', class: 'error' },
    { lane: 'control', class: 'terminal' },
    { lane: 'extension', class: 'extension' },
  ],
  run: (batch) =>
    Effect.gen(function* () {
      for (let i = 0; i < yieldSteps; i += 1) {
        yield* Effect.yieldNow()
      }

      return new RenderOverlayOutput({
        overlayId: 'overlay-control',
        lane: 'control',
        patches: batch.map(
          (entry) =>
            new RenderPatch({
              path: '/control/events',
              op: 'append',
              value: `${entry.class}:${entry.seq}`,
              lane: entry.lane,
              overlayId: 'overlay-control',
            }),
        ),
        nodes: batch.map(
          (entry) =>
            new RenderNode({
              id: `control-${entry.seq}`,
              kind: 'control-event',
              lane: entry.lane,
              props: { class: entry.class, tag: entry.tag },
              children: [],
            }),
        ),
        diagnostics: [],
      })
    }),
})

const toolOverlay = (yieldSteps = 0): RenderOverlayRegistration => ({
  id: 'overlay-tool',
  priority: 300,
  matches: [{ lane: 'tool', class: 'tool' }],
  run: (batch) =>
    Effect.gen(function* () {
      for (let i = 0; i < yieldSteps; i += 1) {
        yield* Effect.yieldNow()
      }

      return new RenderOverlayOutput({
        overlayId: 'overlay-tool',
        lane: 'tool',
        patches: batch.map(
          (entry) =>
            new RenderPatch({
              path: '/tools',
              op: 'append',
              value: entry.seq,
              lane: entry.lane,
              overlayId: 'overlay-tool',
            }),
        ),
        nodes: [],
        diagnostics: [],
      })
    }),
})

const variants: ReadonlyArray<Variant> = [
  {
    id: 'A-probe',
    label: 'Probe only (baseline)',
    overlays: (fixture) => [probeOverlay(fixture)],
  },
  {
    id: 'B-fork-join-light',
    label: 'Probe + 3 overlays (light)',
    overlays: (fixture) => [probeOverlay(fixture), textOverlay(0), controlOverlay(0), toolOverlay(0)],
  },
  {
    id: 'C-fork-join-heavy',
    label: 'Probe + 3 overlays (heavy/yield)',
    overlays: (fixture) => [probeOverlay(fixture), textOverlay(8), controlOverlay(6), toolOverlay(4)],
  },
]

const runRound = (
  variant: Variant,
  workload: OverlayBenchWorkload,
  eventCount: number,
  concurrency: number,
) =>
  Effect.gen(function* () {
    const fixture = makeOverlayBenchFixture(workload, eventCount)
    const layer = makeOverlayReducerPipelineLayer()

    const result = yield* Effect.gen(function* () {
      const pipeline = yield* OverlayReducerPipeline

      for (const overlay of variant.overlays(fixture.inputs)) {
        yield* pipeline.register(overlay)
      }

      const ingestStartedAtMs = new Map<number, number>()
      const latenciesMs: Array<number> = []
      const batchSizes: Array<number> = []
      const backlogSamples: Array<number> = []

      let submitted = 0
      let emittedProbe = 0
      let peakBacklog = 0
      let emissions = 0

      const done = yield* Deferred.make<void>()

      const consumer = yield* Effect.fork(
        Stream.runForEach(pipeline.outputs, (emission) =>
          Effect.gen(function* () {
            emissions += 1

            const probePatches = emission.patches.filter((patch) => patch.overlayId === 'overlay-probe')
            if (probePatches.length > 0) {
              batchSizes.push(probePatches.length)

              for (const patch of probePatches) {
                const seq = typeof patch.value === 'number' ? patch.value : Number.NaN
                if (!Number.isNaN(seq)) {
                  emittedProbe += 1
                  const startedAt = ingestStartedAtMs.get(seq)
                  if (typeof startedAt === 'number') {
                    latenciesMs.push(Math.max(0, emission.emittedAt - startedAt))
                  }
                }
              }
            }

            const backlog = submitted - emittedProbe
            peakBacklog = Math.max(peakBacklog, backlog)
            backlogSamples.push(backlog)

            if (emittedProbe >= fixture.inputs.length) {
              yield* Deferred.succeed(done, undefined).pipe(Effect.catchAll(() => Effect.void))
            }
          }),
        ),
      )

      const startedAt = performance.now()

      yield* Effect.forEach(
        fixture.inputs,
        (input) =>
          Effect.gen(function* () {
            ingestStartedAtMs.set(input.seq, Date.now())
            submitted += 1
            const backlog = submitted - emittedProbe
            peakBacklog = Math.max(peakBacklog, backlog)
            backlogSamples.push(backlog)

            yield* pipeline.ingest(input)
          }),
        { concurrency },
      )

      yield* Deferred.await(done).pipe(
        Effect.timeoutFail({
          duration: Duration.seconds(10),
          onTimeout: () => new Error('timeout waiting for reducer emissions'),
        }),
      )

      const elapsedMs = performance.now() - startedAt
      yield* Fiber.interrupt(consumer)

      return {
        elapsedMs,
        latenciesMs,
        batchSizes,
        backlogSamples,
        peakBacklog,
        emissions,
      }
    }).pipe(Effect.provide(layer))

    return result
  })

const runVariant = async (
  variant: Variant,
  workload: OverlayBenchWorkload,
  eventCount: number,
  concurrency: number,
  rounds: number,
): Promise<BenchResult> => {
  const throughput: Array<number> = []
  const p50s: Array<number> = []
  const p95s: Array<number> = []
  const p99s: Array<number> = []
  const peakBacklogs: Array<number> = []
  const p95Backlogs: Array<number> = []
  const avgBatchSizes: Array<number> = []
  const emissions: Array<number> = []

  for (let i = 0; i < rounds; i += 1) {
    const round = await Effect.runPromise(runRound(variant, workload, eventCount, concurrency))

    const eventsPerSec = eventCount / (round.elapsedMs / 1000)
    throughput.push(eventsPerSec)

    p50s.push(percentile(round.latenciesMs, 50))
    p95s.push(percentile(round.latenciesMs, 95))
    p99s.push(percentile(round.latenciesMs, 99))

    peakBacklogs.push(round.peakBacklog)
    p95Backlogs.push(percentile(round.backlogSamples, 95))

    const avgBatchSize = round.batchSizes.length === 0 ? 0 : round.batchSizes.reduce((a, b) => a + b, 0) / round.batchSizes.length
    avgBatchSizes.push(avgBatchSize)
    emissions.push(round.emissions)
  }

  return {
    variantId: variant.id,
    variantLabel: variant.label,
    workload,
    eventCount,
    concurrency,
    rounds,
    throughputEventsPerSec: median(throughput),
    p50LatencyMs: median(p50s),
    p95LatencyMs: median(p95s),
    p99LatencyMs: median(p99s),
    peakBacklog: median(peakBacklogs),
    p95Backlog: median(p95Backlogs),
    avgBatchSize: median(avgBatchSizes),
    emissions: Math.round(median(emissions)),
  }
}

const parseArg = (name: string): string | undefined => {
  const prefix = `--${name}=`
  const hit = process.argv.find((arg) => arg.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : undefined
}

const quick = process.argv.includes('--quick')
const stress = process.argv.includes('--stress')
const rounds = Number(parseArg('rounds') ?? (quick ? 2 : 4))
const explicitEventCount = Number(parseArg('events') ?? '0')
const explicitConcurrency = Number(parseArg('concurrency') ?? '0')

const eventCounts: ReadonlyArray<number> = explicitEventCount > 0
  ? [explicitEventCount]
  : quick
    ? [2_000]
    : stress
      ? [5_000, 20_000, 60_000]
      : [5_000, 20_000]

const concurrencies: ReadonlyArray<number> = explicitConcurrency > 0
  ? [explicitConcurrency]
  : quick
    ? [1, 8]
    : stress
      ? [1, 8, 32, 96]
      : [1, 8, 32]

const workloads: ReadonlyArray<OverlayBenchWorkload> = ['text-burst', 'mixed-control', 'multi-session']

const format = (n: number, digits = 2) => n.toLocaleString('en-US', { maximumFractionDigits: digits })

console.log('Overlay Reducer Pipeline — Throughput & Backlog Spike')
console.log(`Bun: ${process.versions.bun ?? 'unknown'} | Node ABI: ${process.version}`)
console.log(`CPU: ${os.cpus()[0]?.model ?? 'unknown'} | Cores: ${os.cpus().length}`)
console.log(`Mode: ${quick ? 'quick' : stress ? 'stress' : 'standard'} | Rounds: ${rounds}`)
console.log(`Event counts: ${eventCounts.join(', ')} | Concurrency: ${concurrencies.join(', ')}`)
console.log('')

for (const workload of workloads) {
  for (const eventCount of eventCounts) {
    for (const concurrency of concurrencies) {
      const results: Array<BenchResult> = []
      for (const variant of variants) {
        const row = await runVariant(variant, workload, eventCount, concurrency, rounds)
        results.push(row)
      }

      const baseline = results[0]

      console.log(`workload=${workload} | events=${eventCount.toLocaleString('en-US')} | concurrency=${concurrency}`)
      console.log('---------------------------------------------------------------------------------------------------------------------')
      console.log('variant                 | throughput ev/s | p50 ms | p95 ms | p99 ms | peak backlog | p95 backlog | avg batch | vs base')
      console.log('---------------------------------------------------------------------------------------------------------------------')

      for (const result of results) {
        const vsBase = baseline
          ? ((result.throughputEventsPerSec - baseline.throughputEventsPerSec) / baseline.throughputEventsPerSec) * 100
          : 0

        const vsBaseLabel = `${vsBase >= 0 ? '+' : ''}${format(vsBase, 2)}%`

        console.log(
          `${result.variantId.padEnd(22)} | ${format(result.throughputEventsPerSec).padStart(16)} | ${format(result.p50LatencyMs, 2).padStart(6)} | ${format(result.p95LatencyMs, 2).padStart(6)} | ${format(result.p99LatencyMs, 2).padStart(6)} | ${format(result.peakBacklog, 0).padStart(12)} | ${format(result.p95Backlog, 0).padStart(11)} | ${format(result.avgBatchSize, 2).padStart(9)} | ${vsBaseLabel.padStart(8)}`,
        )
      }

      console.log('')
    }
  }
}

console.log('Spike complete.')
console.log('Next: paste results into src/lib/harness/docs/benchmarks/overlay-reducer-pipeline-benchmark-report.md')
