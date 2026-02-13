/**
 * Channel + Junction Benchmark (Rigorous Matrix)
 *
 * Purpose:
 * - Provide reproducible E2E measurements for ChannelService outlet delivery
 * - Distinguish direct inlet->outlet throughput from inlet->junction->outlet behavior
 * - Persist JSON artifact for audit/review
 */

import { describe, it, expect } from 'vitest'
import { Chunk, Effect, Fiber, Option, Stream, pipe } from 'effect'
import * as fs from 'node:fs'
import * as path from 'node:path'

import { ChannelBuilder } from '../constructs/ChannelBuilder'
import { ChannelService, ChannelServiceLive } from '../constructs/ChannelService'
import type { InletId, JunctionKind, OutletId } from '../constructs/Channel'

type PayloadTier = 'small' | 'medium' | 'large'
type TopologyMode = 'direct' | 'junction'

type TrialResult = {
  readonly mode: TopologyMode
  readonly tier: PayloadTier
  readonly junctionKind: JunctionKind | null
  readonly emitted: number
  readonly received: number
  readonly elapsedMs: number
  readonly eventsPerSecond: number
  readonly completed: boolean
  readonly timedOut: boolean
}

type BenchmarkReport = {
  readonly generatedAt: string
  readonly runtime: {
    readonly bun: string | undefined
    readonly node: string | undefined
    readonly platform: string
    readonly arch: string
  }
  readonly config: {
    readonly repeats: number
    readonly directEventCount: number
    readonly directTimeoutMs: number
    readonly junctionEventCount: number
    readonly junctionTimeoutMs: number
    readonly tiers: readonly PayloadTier[]
    readonly junctionKinds: readonly JunctionKind[]
  }
  readonly summary: {
    readonly directAvgEps: number
    readonly directMinEps: number
    readonly directMaxEps: number
    readonly directCompletionRate: number
    readonly junctionCompletionRate: number
    readonly junctionTimeoutRate: number
  }
  readonly directTrials: readonly TrialResult[]
  readonly junctionTrials: readonly TrialResult[]
}

const PAYLOAD_BYTES: Record<PayloadTier, number> = {
  small: 512,
  medium: 3072,
  large: 20480,
}

const TIERS: readonly PayloadTier[] = ['small', 'medium', 'large']
const JUNCTION_KINDS: readonly JunctionKind[] = [
  'map',
  'filter',
  'merge',
  'broadcast',
  'partition',
  'buffer',
]

const REPEATS = 2
const DIRECT_EVENT_COUNT = 1_000
const DIRECT_TIMEOUT_MS = 500
const JUNCTION_EVENT_COUNT = 300
const JUNCTION_TIMEOUT_MS = 1000

const REPORT_PATH = path.join(
  process.cwd(),
  'artifacts',
  'benchmarks',
  'streams-channel-junction-benchmark.json',
)

const safeNow = () => Date.now()

const makePayload = (tier: PayloadTier, seq: number) => {
  const target = PAYLOAD_BYTES[tier]
  const base = `evt:${seq}:tier:${tier}:`
  const bodySize = Math.max(0, target - base.length)
  return {
    seq,
    tier,
    data: `${base}${'x'.repeat(bodySize)}`,
  }
}

const buildDirect = (id: string) =>
  ChannelBuilder.create(id)
    .name(`bench-${id}`)
    .inlet('in', { name: 'Input' })
    .outlet('out', { name: 'Output', broadcast: true, maxLag: 64 })
    .wire('in', 'out')

const buildJunction = (id: string, kind: JunctionKind) => {
  const config =
    kind === 'buffer'
      ? {
          capacity: 4096,
          strategy: 'drop-oldest',
          flushMs: 0,
        }
      : kind === 'partition'
        ? {
            predicate: (payload: unknown) => {
              if (
                typeof payload === 'object' &&
                payload !== null &&
                'seq' in payload
              ) {
                return Number((payload as { readonly seq: number }).seq) % 2 === 0
              }
              return false
            },
            leftLabel: 'even',
            rightLabel: 'odd',
          }
        : undefined

  return ChannelBuilder.create(id)
    .name(`bench-${id}`)
    .inlet('in', { name: 'Input' })
    .junction('j', { kind, name: `J-${kind}`, config })
    .outlet('out', { name: 'Output', broadcast: true, maxLag: 64 })
    .wire('in', 'j')
    .wire('j', 'out')
}

const runTrial = (
  mode: TopologyMode,
  tier: PayloadTier,
  runIndex: number,
  junctionKind: JunctionKind | null,
): Effect.Effect<TrialResult, never, ChannelService> =>
  Effect.gen(function* () {
    const service = yield* ChannelService

    const id =
      mode === 'direct'
        ? `bench-direct-${tier}-${runIndex}-${safeNow()}`
        : `bench-junction-${junctionKind ?? 'none'}-${tier}-${runIndex}-${safeNow()}`

    const builder =
      mode === 'direct'
        ? buildDirect(id)
        : buildJunction(id, junctionKind ?? 'map')

    const channelId = yield* service.register(builder)
    yield* service.open(channelId)

    const inletId = `${channelId}:inlet:in` as InletId
    const outletId = `${channelId}:outlet:out` as OutletId

    const emitCount = mode === 'direct' ? DIRECT_EVENT_COUNT : JUNCTION_EVENT_COUNT
    const timeoutMs = mode === 'direct' ? DIRECT_TIMEOUT_MS : JUNCTION_TIMEOUT_MS

    const outletStream = yield* service.getOutletStream(channelId, outletId)
    const sourceStream = pipe(
      Stream.range(0, emitCount - 1),
      Stream.map((i) => makePayload(tier, i)),
    )

    const startedAt = performance.now()

    const collectorFiber = yield* pipe(
      outletStream,
      Stream.take(emitCount),
      Stream.runCollect,
      Effect.timeout(`${timeoutMs} millis`),
      Effect.option,
      Effect.fork,
    )

    // Ensure collector subscribes before producer starts.
    yield* Effect.sleep('5 millis')

    // Starts producer in a fiber; returns quickly while outlet is consumed.
    yield* service.connectStream(channelId, inletId, sourceStream, `bench-source:${id}`)

    const collected = yield* Fiber.join(collectorFiber)

    const elapsedMs = performance.now() - startedAt
    const received = Option.isSome(collected)
      ? Chunk.size(collected.value as Chunk.Chunk<unknown>)
      : 0

    yield* service.close(channelId, 'benchmark trial complete')

    const eventsPerSecond = elapsedMs > 0 ? received / (elapsedMs / 1000) : 0

    return {
      mode,
      tier,
      junctionKind,
      emitted: emitCount,
      received,
      elapsedMs,
      eventsPerSecond,
      completed: received === emitCount,
      timedOut: Option.isNone(collected),
    }
  })

const avg = (values: ReadonlyArray<number>) =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length

const pct = (num: number, den: number) => (den === 0 ? 0 : num / den)

describe('Channel/Junction benchmark matrix', () => {
  it(
    'generates benchmark report and validates delivery characteristics',
    async () => {
      const program = Effect.gen(function* () {
        const directTrials: TrialResult[] = []
        const junctionTrials: TrialResult[] = []

        for (let r = 1; r <= REPEATS; r++) {
          for (const tier of TIERS) {
            directTrials.push(yield* runTrial('direct', tier, r, null))
          }
        }

        for (let r = 1; r <= REPEATS; r++) {
          for (const tier of TIERS) {
            for (const kind of JUNCTION_KINDS) {
              junctionTrials.push(yield* runTrial('junction', tier, r, kind))
            }
          }
        }

        const directEps = directTrials.map((t) => t.eventsPerSecond)
        const directCompleted = directTrials.filter((t) => t.completed).length

        const junctionCompleted = junctionTrials.filter((t) => t.completed).length
        const junctionTimedOut = junctionTrials.filter((t) => t.timedOut).length

        const report: BenchmarkReport = {
          generatedAt: new Date().toISOString(),
          runtime: {
            bun: process.versions.bun,
            node: process.versions.node,
            platform: process.platform,
            arch: process.arch,
          },
          config: {
            repeats: REPEATS,
            directEventCount: DIRECT_EVENT_COUNT,
            directTimeoutMs: DIRECT_TIMEOUT_MS,
            junctionEventCount: JUNCTION_EVENT_COUNT,
            junctionTimeoutMs: JUNCTION_TIMEOUT_MS,
            tiers: TIERS,
            junctionKinds: JUNCTION_KINDS,
          },
          summary: {
            directAvgEps: avg(directEps),
            directMinEps: directEps.length > 0 ? Math.min(...directEps) : 0,
            directMaxEps: directEps.length > 0 ? Math.max(...directEps) : 0,
            directCompletionRate: pct(directCompleted, directTrials.length),
            junctionCompletionRate: pct(junctionCompleted, junctionTrials.length),
            junctionTimeoutRate: pct(junctionTimedOut, junctionTrials.length),
          },
          directTrials,
          junctionTrials,
        }

        yield* Effect.sync(() => {
          fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true })
          fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf-8')
        })

        // Console summary for quick operator read.
        yield* Effect.sync(() => {
          console.log('\n[streams-benchmark] Channel/Junction Matrix Summary')
          console.log(`  report: ${REPORT_PATH}`)
          console.log(
            `  direct eps avg/min/max: ${report.summary.directAvgEps.toFixed(1)} / ${report.summary.directMinEps.toFixed(1)} / ${report.summary.directMaxEps.toFixed(1)}`,
          )
          console.log(
            `  direct completion rate: ${(report.summary.directCompletionRate * 100).toFixed(1)}%`,
          )
          console.log(
            `  junction completion rate: ${(report.summary.junctionCompletionRate * 100).toFixed(1)}%`,
          )
          console.log(
            `  junction timeout rate: ${(report.summary.junctionTimeoutRate * 100).toFixed(1)}%\n`,
          )
        })

        // Assertions designed to detect current system behavior without flake.
        expect(directTrials.length).toBeGreaterThan(0)
        expect(directCompleted).toBeGreaterThan(0)

        // Junction path is expected to be fully routed in this phase.
        expect(junctionCompleted).toBe(junctionTrials.length)
        expect(junctionTimedOut).toBe(0)
      }).pipe(Effect.provide(ChannelServiceLive))

      await Effect.runPromise(program)
    },
    120_000,
  )
})
