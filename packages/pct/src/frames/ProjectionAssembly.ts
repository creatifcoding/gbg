/**
 * Pure frame assembly kernel.
 *
 * This module owns deterministic bucket/frame-id calculation and local frame
 * state transitions. It does not tail LNK streams, write Timescale rows, host
 * NATS, or decide durable truth. Those are runtime/port concerns, darling.
 *
 * @module @tmnl/pct/frames/ProjectionAssembly
 */

import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"

import type { FrameProjectionSpec as FrameProjectionSpecType } from "./FrameProjectionSpec.js"
import {
  FrameAssemblyState,
  FrameCompleteness,
  FramePart,
  type FrameAssemblyState as FrameAssemblyStateType,
  type FramePart as FramePartType,
  type ProjectionSourceMessage as ProjectionSourceMessageType,
  type ProjectionTimeoutOutcome as ProjectionTimeoutOutcomeType,
} from "./ProjectionWorker.js"

// ─── Errors ─────────────────────────────────────────────────────────────────

export class ProjectionAssemblyError extends Schema.TaggedErrorClass<ProjectionAssemblyError>()(
  "ProjectionAssemblyError",
  {
    projectionId: Schema.String,
    message: Schema.String,
  },
) {}

// ─── Deterministic keys ─────────────────────────────────────────────────────

export const ProjectionFrameBucket = Schema.Struct({
  projectionId: Schema.String,
  bucketStart: Schema.String,
  bucketEnd: Schema.String,
  deadlineAt: Schema.String,
  bucketMs: Schema.Number,
})
export type ProjectionFrameBucket = typeof ProjectionFrameBucket.Type

export const ProjectionSourceOffsetKey = Schema.Struct({
  projectionId: Schema.String,
  streamId: Schema.String,
  offset: Schema.String,
})
export type ProjectionSourceOffsetKey = typeof ProjectionSourceOffsetKey.Type

export const ProjectionPartLedgerEntry = Schema.Struct({
  key: ProjectionSourceOffsetKey,
  frameId: Schema.String,
  partKey: Schema.String,
  recordedAt: Schema.Number,
})
export type ProjectionPartLedgerEntry = typeof ProjectionPartLedgerEntry.Type

export const ProjectionPartLedgerDecision = Schema.Struct({
  accepted: Schema.Boolean,
  duplicate: Schema.Boolean,
  entry: ProjectionPartLedgerEntry,
})
export type ProjectionPartLedgerDecision = typeof ProjectionPartLedgerDecision.Type

export const ProjectionPartLedgerState = Schema.Struct({
  entries: Schema.Array(ProjectionPartLedgerEntry),
})
export type ProjectionPartLedgerState = typeof ProjectionPartLedgerState.Type

export const emptyProjectionPartLedgerState = (): ProjectionPartLedgerState =>
  ProjectionPartLedgerState.make({ entries: [] })

const FIXED_INTERVAL_MS: Record<string, number> = {
  millisecond: 1,
  milliseconds: 1,
  second: 1_000,
  seconds: 1_000,
  minute: 60_000,
  minutes: 60_000,
  hour: 3_600_000,
  hours: 3_600_000,
  day: 86_400_000,
  days: 86_400_000,
  week: 604_800_000,
  weeks: 604_800_000,
}

const parseFixedIntervalMs = (
  projectionId: string,
  interval: string,
): Effect.Effect<number, ProjectionAssemblyError> => {
  const match = /^([0-9]+)\s+([a-z]+)$/.exec(interval.trim())
  if (match === null) {
    return Effect.fail(new ProjectionAssemblyError({
      projectionId,
      message: `invalid frame interval literal: ${interval}`,
    }))
  }
  const count = Number(match[1] ?? "")
  const unit = match[2] ?? ""
  const unitMs = FIXED_INTERVAL_MS[unit]
  if (!Number.isFinite(count) || count <= 0 || unitMs === undefined) {
    return Effect.fail(new ProjectionAssemblyError({
      projectionId,
      message: `frame interval must use fixed millisecond/second/minute/hour/day/week units, got: ${interval}`,
    }))
  }
  return Effect.succeed(count * unitMs)
}

const parseTimestampMs = (
  projectionId: string,
  value: string,
  label: string,
): Effect.Effect<number, ProjectionAssemblyError> => {
  const ms = Date.parse(value)
  return Number.isFinite(ms)
    ? Effect.succeed(ms)
    : Effect.fail(new ProjectionAssemblyError({
        projectionId,
        message: `${label} must be an ISO/date timestamp, got: ${value}`,
      }))
}

const iso = (ms: number): string => new Date(ms).toISOString()

const stableJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(",")}}`
}

const hash = (value: string): string => {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, "0")
}

export const calculateFrameBucket = (
  spec: FrameProjectionSpecType,
  observedAt: string,
): Effect.Effect<ProjectionFrameBucket, ProjectionAssemblyError> =>
  Effect.gen(function* () {
    const bucketMs = yield* parseFixedIntervalMs(spec.id, spec.frame.timeBucket)
    const observedMs = yield* parseTimestampMs(spec.id, observedAt, "observedAt")
    const bucketStartMs = Math.floor(observedMs / bucketMs) * bucketMs
    const bucketEndMs = bucketStartMs + bucketMs
    const deadlineMs = bucketEndMs + spec.frame.allowedLatenessMs
    return ProjectionFrameBucket.make({
      projectionId: spec.id,
      bucketStart: iso(bucketStartMs),
      bucketEnd: iso(bucketEndMs),
      deadlineAt: iso(deadlineMs),
      bucketMs,
    })
  })

export const deterministicFrameId = (
  spec: FrameProjectionSpecType,
  bucketStart: string,
  entityKey: unknown,
): string => `${spec.id}#${bucketStart}#${hash(stableJson(entityKey))}`

export const sourceOffsetKey = (
  projectionId: string,
  streamId: string,
  offset: string,
): ProjectionSourceOffsetKey => ProjectionSourceOffsetKey.make({ projectionId, streamId, offset })

// ─── Message → part ─────────────────────────────────────────────────────────

export const sourceMessageToFramePart = (
  spec: FrameProjectionSpecType,
  message: ProjectionSourceMessageType,
): Effect.Effect<FramePart, ProjectionAssemblyError> =>
  Effect.gen(function* () {
    const binding = spec.sources.find((source) => source.as === message.partKey && source.streamId === message.streamId)
    if (binding === undefined) {
      return yield* Effect.fail(new ProjectionAssemblyError({
        projectionId: spec.id,
        message: `source message ${message.streamId}/${message.partKey} is not declared in projection sources`,
      }))
    }
    if (message.projectionId !== spec.id) {
      return yield* Effect.fail(new ProjectionAssemblyError({
        projectionId: spec.id,
        message: `source message projectionId ${message.projectionId} does not match ${spec.id}`,
      }))
    }
    const bucket = yield* calculateFrameBucket(spec, message.observedAt)
    const frameId = deterministicFrameId(spec, bucket.bucketStart, message.entityKey)
    return FramePart.make({
      projectionId: spec.id,
      frameId,
      frameTime: bucket.bucketStart,
      deadlineAt: bucket.deadlineAt,
      partKey: message.partKey,
      entityKey: message.entityKey,
      payload: message.payload,
      provenance: {
        partKey: message.partKey,
        sourceStreamId: message.streamId,
        sourceOffset: message.offset,
        sourceSchemaId: message.schemaId,
        observedAt: message.observedAt,
        receivedAt: message.receivedAt,
      },
    })
  })

// ─── Part merge and completeness ────────────────────────────────────────────

export const calculateCompleteness = (
  spec: FrameProjectionSpecType,
  parts: ReadonlyArray<FramePartType>,
): typeof FrameCompleteness.Type => {
  const present = new Set(parts.map((part) => part.partKey))
  const missingParts = spec.frame.required.filter((partKey) => !present.has(partKey))
  return FrameCompleteness.make({
    complete: missingParts.length === 0,
    missingParts,
    imputedParts: [],
  })
}

export interface MergeFramePartResult {
  readonly state: FrameAssemblyStateType
  readonly duplicate: boolean
}

export const mergeFramePart = (
  spec: FrameProjectionSpecType,
  current: FrameAssemblyStateType | undefined,
  part: FramePartType,
  now = Date.now(),
): Effect.Effect<MergeFramePartResult, ProjectionAssemblyError> =>
  Effect.gen(function* () {
    if (current !== undefined && current.frameId !== part.frameId) {
      return yield* Effect.fail(new ProjectionAssemblyError({
        projectionId: spec.id,
        message: `cannot merge part for frame ${part.frameId} into frame ${current.frameId}`,
      }))
    }

    const existingParts = current?.parts ?? []
    const duplicate = existingParts.some((existing) =>
      existing.provenance.sourceStreamId === part.provenance.sourceStreamId &&
      existing.provenance.sourceOffset === part.provenance.sourceOffset,
    )
    if (duplicate && current !== undefined) return { state: current, duplicate: true }

    const parts = [
      ...existingParts.filter((existing) => existing.partKey !== part.partKey),
      part,
    ].sort((a, b) => a.partKey.localeCompare(b.partKey))
    const completeness = calculateCompleteness(spec, parts)
    const state = FrameAssemblyState.make({
      projectionId: spec.id,
      frameId: part.frameId,
      frameTime: part.frameTime,
      deadlineAt: part.deadlineAt,
      entityKey: part.entityKey,
      parts,
      completeness,
      provenance: parts.map((entry) => entry.provenance),
      updatedAt: now,
    })
    return { state, duplicate: false }
  })

export const frameTimeoutOutcome = (
  spec: FrameProjectionSpecType,
  state: FrameAssemblyStateType,
  now = Date.now(),
): Effect.Effect<ProjectionTimeoutOutcomeType, ProjectionAssemblyError> =>
  Effect.gen(function* () {
    const deadlineMs = yield* parseTimestampMs(spec.id, state.deadlineAt, "deadlineAt")
    if (state.completeness.complete || now < deadlineMs) return "none" as const
    switch (spec.frame.onTimeout) {
      case "emit-partial":
        return "emitted-partial" as const
      case "drop-partial":
        return "dropped-partial" as const
      case "dead-letter":
        return "dead-lettered" as const
    }
  })

// ─── Source-offset idempotency ledger semantics ─────────────────────────────

const offsetKeyString = (key: ProjectionSourceOffsetKey): string =>
  `${key.projectionId}\n${key.streamId}\n${key.offset}`

export const ledgerDecisionForPart = (
  ledger: ProjectionPartLedgerState,
  part: FramePartType,
  now = Date.now(),
): ProjectionPartLedgerDecision => {
  const key = sourceOffsetKey(part.projectionId, part.provenance.sourceStreamId, part.provenance.sourceOffset)
  const existing = ledger.entries.find((entry) => offsetKeyString(entry.key) === offsetKeyString(key))
  const entry = existing ?? ProjectionPartLedgerEntry.make({
    key,
    frameId: part.frameId,
    partKey: part.partKey,
    recordedAt: now,
  })
  return ProjectionPartLedgerDecision.make({
    accepted: existing === undefined,
    duplicate: existing !== undefined,
    entry,
  })
}

export const recordLedgerDecision = (
  ledger: ProjectionPartLedgerState,
  decision: ProjectionPartLedgerDecision,
): ProjectionPartLedgerState =>
  decision.accepted
    ? ProjectionPartLedgerState.make({ entries: [...ledger.entries, decision.entry] })
    : ledger
