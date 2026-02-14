/**
 * AgentTask Log Atom Surface (DI-able)
 *
 * Provides a Context.Tag service whose shape exposes all log-view atoms.
 * This allows callers to inject different runtime layers (mock, NATS, NATS+micro)
 * without hard-coding atom/runtime wiring at import sites.
 *
 * @module agent-task/atoms/surface
 */

import { Atom } from '@effect-atom/atom'
import { Context, DateTime, Effect, Layer, Stream } from 'effect'

import type { LogLevel } from '../schemas/log-level'
import type { AssembledLogEntry } from '../services/CodecService'
import { AgentTaskService } from '../services/AgentTaskService'
import {
  AgentTaskServiceMock,
  AgentTaskServiceNats,
  AgentTaskServiceNatsMicro,
} from '../services/layers'

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

/** Log view filter configuration. */
export interface LogFilterState {
  /** Minimum severity threshold */
  readonly minLevel: LogLevel
  /** Substring search in message content */
  readonly search: string
  /** Substring match on source field */
  readonly source: string
  /** Optional time range bounds (epoch ms) */
  readonly timeRange: {
    readonly start: number | null
    readonly end: number | null
  }
  /** Optional regex pattern for message matching */
  readonly regex: string
}

/** Log view scroll mode. */
export type TailMode = 'tail' | 'inspect'

/** Default filter state — show everything. */
export const DEFAULT_FILTER: LogFilterState = {
  minLevel: 'DEBUG',
  search: '',
  source: '',
  timeRange: { start: null, end: null },
  regex: '',
}

// ---------------------------------------------------------------------------
// Atom surface shape
// ---------------------------------------------------------------------------

export interface AgentTaskLogAtomSurfaceAtoms {
  readonly logRuntimeAtom: ReturnType<typeof Atom.runtime>
  readonly logBufferFamily: ReturnType<typeof Atom.family<string, Atom.Writable<ReadonlyArray<AssembledLogEntry>>>>
  readonly logStreamTrigger: ReturnType<ReturnType<typeof Atom.runtime>['fn<string>']>
  readonly logFilterAtom: Atom.Writable<LogFilterState>
  readonly tailModeFamily: ReturnType<typeof Atom.family<string, Atom.Writable<TailMode>>>
  readonly filteredLogBufferFamily: ReturnType<typeof Atom.family<string, Atom.Atom<ReadonlyArray<AssembledLogEntry>>>>
  readonly logCountFamily: ReturnType<typeof Atom.family<string, Atom.Atom<number>>>
  readonly logTotalCountFamily: ReturnType<typeof Atom.family<string, Atom.Atom<number>>>
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a complete log atom surface bound to a specific AgentTask layer.
 */
export const createAgentTaskLogAtomSurfaceAtoms = (
  runtimeLayer: Layer.Layer<AgentTaskService, unknown, never>,
): AgentTaskLogAtomSurfaceAtoms => {
  const logRuntimeAtom = Atom.runtime(runtimeLayer)

  const logBufferFamily = Atom.family(
    (_taskId: string) => Atom.make<ReadonlyArray<AssembledLogEntry>>([]),
  )

  const logStreamTrigger = logRuntimeAtom.fn<string>()(
    (taskId, ctx) =>
      Effect.gen(function* () {
        const svc = yield* AgentTaskService
        const bufferAtom = logBufferFamily(taskId)

        const stream = yield* svc.subscribeLogs(taskId)

        yield* stream.pipe(
          Stream.runForEach((entry) =>
            Effect.sync(() => {
              const current = ctx.get(bufferAtom)
              const merged = svc.mergeIntoBuffer(current, [entry])
              ctx.set(bufferAtom, merged)
            }),
          ),
        )

        return true as const
      }),
  )

  const logFilterAtom = Atom.make<LogFilterState>(DEFAULT_FILTER)

  const tailModeFamily = Atom.family(
    (_taskId: string) => Atom.make<TailMode>('tail'),
  )

  const filteredLogBufferFamily = Atom.family(
    (taskId: string) =>
      Atom.readable((get) => {
        const buffer = get(logBufferFamily(taskId))
        const filter = get(logFilterAtom)

        return applyFilters(buffer, filter)
      }),
  )

  const logCountFamily = Atom.family(
    (taskId: string) =>
      Atom.readable((get) => get(filteredLogBufferFamily(taskId)).length),
  )

  const logTotalCountFamily = Atom.family(
    (taskId: string) =>
      Atom.readable((get) => get(logBufferFamily(taskId)).length),
  )

  return {
    logRuntimeAtom,
    logBufferFamily,
    logStreamTrigger,
    logFilterAtom,
    tailModeFamily,
    filteredLogBufferFamily,
    logCountFamily,
    logTotalCountFamily,
  }
}

// ---------------------------------------------------------------------------
// Filter implementation
// ---------------------------------------------------------------------------

const applyFilters = (
  buffer: ReadonlyArray<AssembledLogEntry>,
  filter: LogFilterState,
): ReadonlyArray<AssembledLogEntry> => {
  let result = buffer

  if (filter.minLevel !== 'DEBUG') {
    const severity: Record<string, number> = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
      FATAL: 4,
    }
    const threshold = severity[filter.minLevel] ?? 0
    result = result.filter((a) => a.severityOrd >= threshold)
  }

  if (filter.search.length > 0) {
    const lower = filter.search.toLowerCase()
    result = result.filter((a) => a.entry.message.toLowerCase().includes(lower))
  }

  if (filter.source.length > 0) {
    const lower = filter.source.toLowerCase()
    result = result.filter((a) => a.entry.source.toLowerCase().includes(lower))
  }

  if (filter.timeRange.start !== null || filter.timeRange.end !== null) {
    result = result.filter((a) => {
      const ts = DateTime.toEpochMillis(a.entry.timestamp)
      if (filter.timeRange.start !== null && ts < filter.timeRange.start) return false
      if (filter.timeRange.end !== null && ts > filter.timeRange.end) return false
      return true
    })
  }

  if (filter.regex.length > 0) {
    try {
      const re = new RegExp(filter.regex, 'i')
      result = result.filter((a) => re.test(a.entry.message))
    } catch {
      // Invalid regex — silently skip
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Context.Tag service
// ---------------------------------------------------------------------------

export interface AgentTaskLogAtomSurfaceShape {
  readonly atoms: AgentTaskLogAtomSurfaceAtoms
}

export class AgentTaskLogAtomSurface extends Context.Tag(
  'AgentTask/LogAtomSurface',
)<AgentTaskLogAtomSurface, AgentTaskLogAtomSurfaceShape>() {}

export const AgentTaskLogAtomSurfaceCustom = (
  runtimeLayer: Layer.Layer<AgentTaskService, unknown, never>,
) =>
  Layer.succeed(AgentTaskLogAtomSurface, {
    atoms: createAgentTaskLogAtomSurfaceAtoms(runtimeLayer),
  } satisfies AgentTaskLogAtomSurfaceShape)

/** Default DI surface for testbed/dev usage. */
export const AgentTaskLogAtomSurfaceMock = AgentTaskLogAtomSurfaceCustom(
  AgentTaskServiceMock,
)

/** Production surface using NATS transport. */
export const AgentTaskLogAtomSurfaceNats = AgentTaskLogAtomSurfaceCustom(
  AgentTaskServiceNats,
)

/** Production+control plane surface (NATS + micro host composition). */
export const AgentTaskLogAtomSurfaceNatsMicro = AgentTaskLogAtomSurfaceCustom(
  AgentTaskServiceNatsMicro,
)

// ---------------------------------------------------------------------------
// Runtime helpers (resolve Context.Tag -> atoms for React consumers)
// ---------------------------------------------------------------------------

export interface AgentTaskLogAtomSurfaceRuntime {
  readonly runtimeAtom: ReturnType<typeof Atom.runtime>
  readonly atomSurfaceAtom: Atom.Atom<AgentTaskLogAtomSurfaceAtoms>
}

export const createAgentTaskLogAtomSurfaceRuntime = (
  surfaceLayer: Layer.Layer<AgentTaskLogAtomSurface, never, never>,
): AgentTaskLogAtomSurfaceRuntime => {
  const runtimeAtom = Atom.runtime(surfaceLayer)
  const atomSurfaceAtom = runtimeAtom.atom(
    Effect.gen(function* () {
      const surface = yield* AgentTaskLogAtomSurface
      return surface.atoms
    }),
  )

  return {
    runtimeAtom,
    atomSurfaceAtom,
  }
}

export const agentTaskLogSurfaceMockRuntime = createAgentTaskLogAtomSurfaceRuntime(
  AgentTaskLogAtomSurfaceMock,
)

export const agentTaskLogSurfaceNatsRuntime = createAgentTaskLogAtomSurfaceRuntime(
  AgentTaskLogAtomSurfaceNats,
)

export const agentTaskLogSurfaceNatsMicroRuntime = createAgentTaskLogAtomSurfaceRuntime(
  AgentTaskLogAtomSurfaceNatsMicro,
)
