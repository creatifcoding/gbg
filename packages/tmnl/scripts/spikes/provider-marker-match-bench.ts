#!/usr/bin/env bun

import os from 'node:os'

import { Match, pipe } from 'effect'

import {
  type RawMarkerEvent,
  type TaggedMarker,
  type WorkloadName,
  makeWorkloadFixture,
} from '../../src/lib/harness/__bench__/fixtures/provider-marker-fixtures'

type Dispatch = {
  readonly raw: (event: RawMarkerEvent) => number
  readonly marker: (event: TaggedMarker) => number
}

type VariantId = 'A-switch-switch' | 'B-match-switch' | 'C-switch-match' | 'D-match-match'

type Variant = {
  readonly id: VariantId
  readonly label: string
  readonly dispatch: Dispatch
}

type BenchResult = {
  readonly variantId: VariantId
  readonly variantLabel: string
  readonly workload: WorkloadName
  readonly eventCount: number
  readonly rounds: number
  readonly checksum: number
  readonly medianOpsPerSec: number
  readonly medianNsPerOp: number
  readonly p95NsPerOp: number
  readonly p50NsPerOp: number
  readonly minOpsPerSec: number
  readonly maxOpsPerSec: number
  readonly heapDeltaBytes: number
}

const rawSwitchDispatch = (event: RawMarkerEvent): number => {
  switch (event.type) {
    case 'start':
      return 1
    case 'text_start':
      return 2
    case 'text_delta':
      return 3
    case 'text_end':
      return 4
    case 'thinking_start':
      return 5
    case 'thinking_delta':
      return 6
    case 'thinking_end':
      return 7
    case 'toolcall_start':
      return 8
    case 'toolcall_delta':
      return 9
    case 'toolcall_end':
      return 10
    case 'done':
      return 11
    case 'error':
      return 12
  }
}

const rawMatchDispatch = pipe(
  Match.type<RawMarkerEvent>(),
  Match.discriminatorsExhaustive('type')({
    start: () => 1,
    text_start: () => 2,
    text_delta: () => 3,
    text_end: () => 4,
    thinking_start: () => 5,
    thinking_delta: () => 6,
    thinking_end: () => 7,
    toolcall_start: () => 8,
    toolcall_delta: () => 9,
    toolcall_end: () => 10,
    done: () => 11,
    error: () => 12,
  }),
)

const markerSwitchDispatch = (event: TaggedMarker): number => {
  switch (event._tag) {
    case 'provider:marker/start':
      return 1
    case 'provider:marker/text_start':
      return 2
    case 'provider:marker/text_delta':
      return 3
    case 'provider:marker/text_end':
      return 4
    case 'provider:marker/thinking_start':
      return 5
    case 'provider:marker/thinking_delta':
      return 6
    case 'provider:marker/thinking_end':
      return 7
    case 'provider:marker/toolcall_start':
      return 8
    case 'provider:marker/toolcall_delta':
      return 9
    case 'provider:marker/toolcall_end':
      return 10
    case 'provider:marker/done':
      return 11
    case 'provider:marker/error':
      return 12
    case 'provider:marker/unknown':
      return 13
  }
}

const markerMatchDispatch = pipe(
  Match.type<TaggedMarker>(),
  Match.tagsExhaustive({
    'provider:marker/start': () => 1,
    'provider:marker/text_start': () => 2,
    'provider:marker/text_delta': () => 3,
    'provider:marker/text_end': () => 4,
    'provider:marker/thinking_start': () => 5,
    'provider:marker/thinking_delta': () => 6,
    'provider:marker/thinking_end': () => 7,
    'provider:marker/toolcall_start': () => 8,
    'provider:marker/toolcall_delta': () => 9,
    'provider:marker/toolcall_end': () => 10,
    'provider:marker/done': () => 11,
    'provider:marker/error': () => 12,
    'provider:marker/unknown': () => 13,
  }),
)

const variants: ReadonlyArray<Variant> = [
  {
    id: 'A-switch-switch',
    label: 'Baseline: switch(raw) + switch(tag)',
    dispatch: { raw: rawSwitchDispatch, marker: markerSwitchDispatch },
  },
  {
    id: 'B-match-switch',
    label: 'Match raw: Match.discriminatorsExhaustive + switch(tag)',
    dispatch: { raw: rawMatchDispatch, marker: markerSwitchDispatch },
  },
  {
    id: 'C-switch-match',
    label: 'Hybrid: switch(raw) + Match.tagsExhaustive',
    dispatch: { raw: rawSwitchDispatch, marker: markerMatchDispatch },
  },
  {
    id: 'D-match-match',
    label: 'Full Match: Match.discriminatorsExhaustive + Match.tagsExhaustive',
    dispatch: { raw: rawMatchDispatch, marker: markerMatchDispatch },
  },
]

const percentile = (values: ReadonlyArray<number>, p: number): number => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[index] ?? 0
}

const median = (values: ReadonlyArray<number>): number => percentile(values, 50)

const runRound = (
  rawEvents: ReadonlyArray<RawMarkerEvent>,
  markerEvents: ReadonlyArray<TaggedMarker>,
  dispatch: Dispatch,
): { elapsedMs: number; checksum: number; chunkNsPerOp: ReadonlyArray<number> } => {
  const chunkSize = 1024
  let checksum = 0
  const chunkNsPerOp: Array<number> = []

  const started = performance.now()

  for (let i = 0; i < rawEvents.length; i += chunkSize) {
    const chunkStart = performance.now()
    const upper = Math.min(i + chunkSize, rawEvents.length)

    for (let j = i; j < upper; j += 1) {
      const raw = rawEvents[j]
      const marker = markerEvents[j]
      checksum = (checksum ^ (dispatch.raw(raw) * 31 + dispatch.marker(marker))) >>> 0
    }

    const elapsed = performance.now() - chunkStart
    const processed = upper - i
    chunkNsPerOp.push((elapsed * 1_000_000) / processed)
  }

  const elapsedMs = performance.now() - started
  return { elapsedMs, checksum, chunkNsPerOp }
}

const runVariant = (
  variant: Variant,
  workload: WorkloadName,
  eventCount: number,
  rounds: number,
): BenchResult => {
  const fixture = makeWorkloadFixture(workload, eventCount)

  // Warm-up rounds to reduce first-run distortion.
  runRound(fixture.rawEvents, fixture.markerEvents, variant.dispatch)
  runRound(fixture.rawEvents, fixture.markerEvents, variant.dispatch)

  const memoryBefore = process.memoryUsage().heapUsed

  const roundOpsPerSec: Array<number> = []
  const roundNsPerOp: Array<number> = []
  const allChunkNsPerOp: Array<number> = []
  let checksum = 0

  for (let round = 0; round < rounds; round += 1) {
    const result = runRound(fixture.rawEvents, fixture.markerEvents, variant.dispatch)
    checksum ^= result.checksum

    const opsPerSec = fixture.rawEvents.length / (result.elapsedMs / 1000)
    const nsPerOp = (result.elapsedMs * 1_000_000) / fixture.rawEvents.length

    roundOpsPerSec.push(opsPerSec)
    roundNsPerOp.push(nsPerOp)
    allChunkNsPerOp.push(...result.chunkNsPerOp)
  }

  const memoryAfter = process.memoryUsage().heapUsed

  return {
    variantId: variant.id,
    variantLabel: variant.label,
    workload,
    eventCount,
    rounds,
    checksum,
    medianOpsPerSec: median(roundOpsPerSec),
    medianNsPerOp: median(roundNsPerOp),
    p95NsPerOp: percentile(allChunkNsPerOp, 95),
    p50NsPerOp: percentile(allChunkNsPerOp, 50),
    minOpsPerSec: Math.min(...roundOpsPerSec),
    maxOpsPerSec: Math.max(...roundOpsPerSec),
    heapDeltaBytes: memoryAfter - memoryBefore,
  }
}

const formatNumber = (value: number, digits = 2): string => value.toLocaleString('en-US', { maximumFractionDigits: digits })
const formatBytes = (bytes: number): string => `${formatNumber(bytes / 1024, 1)} KiB`

const parseArg = (name: string): string | undefined => {
  const prefix = `--${name}=`
  const hit = process.argv.find((arg) => arg.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : undefined
}

const quick = process.argv.includes('--quick')
const stress = process.argv.includes('--stress')
const rounds = Number(parseArg('rounds') ?? (quick ? 3 : 5))
const explicitEventCount = Number(parseArg('events') ?? '0')

const eventCounts: ReadonlyArray<number> = explicitEventCount > 0 ? [explicitEventCount] : quick ? [50_000] : stress ? [50_000, 500_000, 2_000_000] : [50_000, 500_000]

const workloads: ReadonlyArray<WorkloadName> = ['text-heavy', 'tool-heavy', 'mixed-reasoning']

console.log('Provider Marker Match vs Switch — Performance Spike')
console.log(`Bun: ${process.versions.bun ?? 'unknown'} | Node ABI: ${process.version}`)
console.log(`CPU: ${os.cpus()[0]?.model ?? 'unknown'} | Cores: ${os.cpus().length}`)
console.log(`Mode: ${quick ? 'quick' : stress ? 'stress' : 'standard'} | Rounds: ${rounds}`)
console.log(`Event counts: ${eventCounts.join(', ')}`)
console.log('')

for (const eventCount of eventCounts) {
  for (const workload of workloads) {
    const results = variants.map((variant) => runVariant(variant, workload, eventCount, rounds))
    const baseline = results.find((result) => result.variantId === 'A-switch-switch')

    console.log(`Workload=${workload} | events=${eventCount.toLocaleString('en-US')}`)
    console.log('-----------------------------------------------------------------------------------------------')
    console.log('Variant                      | ops/sec (median) | ns/op (median) | p95 ns/op | heap Δ | vs base')
    console.log('-----------------------------------------------------------------------------------------------')

    for (const result of results) {
      const vsBase = baseline ? ((result.medianOpsPerSec - baseline.medianOpsPerSec) / baseline.medianOpsPerSec) * 100 : 0
      const vsBaseLabel = baseline ? `${vsBase >= 0 ? '+' : ''}${formatNumber(vsBase, 2)}%` : 'n/a'

      console.log(
        `${result.variantId.padEnd(28)} | ${formatNumber(result.medianOpsPerSec).padStart(16)} | ${formatNumber(result.medianNsPerOp, 1).padStart(14)} | ${formatNumber(result.p95NsPerOp, 1).padStart(9)} | ${formatBytes(result.heapDeltaBytes).padStart(10)} | ${vsBaseLabel.padStart(8)}`,
      )
    }

    const checksums = new Set(results.map((result) => result.checksum))
    if (checksums.size !== 1) {
      console.log('⚠️  checksum mismatch across variants — correctness gate FAILED')
    } else {
      console.log('✅ checksum parity across variants')
    }

    console.log('')
  }
}

console.log('Spike complete.')
console.log('Next: copy output into src/lib/harness/docs/benchmarks/provider-marker-match-benchmark-report.md')
