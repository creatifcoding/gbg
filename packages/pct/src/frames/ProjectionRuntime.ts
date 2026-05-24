/**
 * ProjectionWorker runtime vertical slice.
 *
 * This is the first executable bridge from pure source messages to materialized
 * frame outputs. It is still port-driven: source reading, Timescale writes, and
 * optional LNK frame-stream writes are injected seams.
 *
 * @module @tmnl/pct/frames/ProjectionRuntime
 */

import * as Context from "effect-v4/Context"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as Ref from "effect-v4/Ref"
import * as Schema from "effect-v4/Schema"

import {
  emptyProjectionPartLedgerState,
  frameTimeoutOutcome,
  ledgerDecisionForPart,
  mergeFramePart,
  recordLedgerDecision,
  sourceMessageToFramePart,
  type ProjectionPartLedgerState,
} from "./ProjectionAssembly.js"
import {
  MaterializedFrame,
  ProjectionDeadLetter,
  ProjectionOutputReceipt,
  ProjectionTickResult,
  ProjectionWorkerConfig,
  ProjectionWorkerRunSummary,
  ProjectionWorkerSnapshot,
  type FrameAssemblyState as FrameAssemblyStateType,
  type MaterializedFrame as MaterializedFrameType,
  type ProjectionDeadLetter as ProjectionDeadLetterType,
  type ProjectionOutputReceipt as ProjectionOutputReceiptType,
  type ProjectionSourceMessage as ProjectionSourceMessageType,
  type ProjectionTickResult as ProjectionTickResultType,
  type ProjectionWorkerConfig as ProjectionWorkerConfigType,
} from "./ProjectionWorker.js"
import { ProjectionWorkerRunner } from "./ProjectionScheduler.js"

// ─── Runtime errors ─────────────────────────────────────────────────────────

export class ProjectionRuntimeError extends Schema.TaggedErrorClass<ProjectionRuntimeError>()(
  "ProjectionRuntimeError",
  {
    projectionId: Schema.String,
    message: Schema.String,
  },
) {}

// ─── Ports ──────────────────────────────────────────────────────────────────

export interface ProjectionSourceReaderShape {
  readonly read: (
    config: ProjectionWorkerConfigType,
  ) => Effect.Effect<ReadonlyArray<ProjectionSourceMessageType>, unknown>
}

export class ProjectionSourceReader extends Context.Service<
  ProjectionSourceReader,
  ProjectionSourceReaderShape
>()("@tmnl/pct/frames/ProjectionSourceReader") {}

export interface TimescaleFrameWriterShape {
  readonly write: (
    config: ProjectionWorkerConfigType,
    frame: MaterializedFrameType,
  ) => Effect.Effect<ProjectionOutputReceiptType, unknown>
}

export class TimescaleFrameWriter extends Context.Service<
  TimescaleFrameWriter,
  TimescaleFrameWriterShape
>()("@tmnl/pct/frames/TimescaleFrameWriter") {}

export interface FrameStreamWriterShape {
  readonly write: (
    config: ProjectionWorkerConfigType,
    frame: MaterializedFrameType,
  ) => Effect.Effect<ProjectionOutputReceiptType, unknown>
}

export class FrameStreamWriter extends Context.Service<
  FrameStreamWriter,
  FrameStreamWriterShape
>()("@tmnl/pct/frames/FrameStreamWriter") {}

// ─── In-memory source reader for tests/proofs ───────────────────────────────

export const projectionSourceReaderLayerMemory = (
  messages: ReadonlyArray<ProjectionSourceMessageType>,
): Layer.Layer<ProjectionSourceReader> =>
  Layer.effect(
    ProjectionSourceReader,
    Effect.gen(function* () {
      const queueRef = yield* Ref.make<ReadonlyArray<ProjectionSourceMessageType>>([...messages])
      return ProjectionSourceReader.of({
        read: (config) =>
          Ref.modify(queueRef, (queue) => {
            const selected: ProjectionSourceMessageType[] = []
            const rest: ProjectionSourceMessageType[] = []
            for (const message of queue) {
              if (selected.length < config.maxMessagesPerTick && message.projectionId === config.spec.id) {
                selected.push(message)
              } else {
                rest.push(message)
              }
            }
            return [selected, rest] as const
          }),
      })
    }),
  )

export const timescaleFrameWriterLayerMemory = (
  framesRef: Ref.Ref<ReadonlyArray<MaterializedFrameType>>,
): Layer.Layer<TimescaleFrameWriter> =>
  Layer.succeed(
    TimescaleFrameWriter,
    TimescaleFrameWriter.of({
      write: (config, frame) =>
        Effect.gen(function* () {
          yield* Ref.update(framesRef, (frames) => [...frames, frame])
          return ProjectionOutputReceipt.make({
            kind: "timescale-frame-row",
            projectionId: frame.projectionId,
            frameId: frame.frameId,
            target: config.plan.frameTable,
            idempotencyKey: `${frame.projectionId}:${frame.frameId}:timescale:${frame.frameRevision}`,
            writtenAt: Date.now(),
          })
        }),
    }),
  )

export const frameStreamWriterLayerMemory = (
  framesRef: Ref.Ref<ReadonlyArray<MaterializedFrameType>>,
): Layer.Layer<FrameStreamWriter> =>
  Layer.succeed(
    FrameStreamWriter,
    FrameStreamWriter.of({
      write: (config, frame) =>
        Effect.gen(function* () {
          yield* Ref.update(framesRef, (frames) => [...frames, frame])
          return ProjectionOutputReceipt.make({
            kind: "lnk-frame-stream",
            projectionId: frame.projectionId,
            frameId: frame.frameId,
            target: config.spec.output.streamId ?? `${config.spec.id}.frames`,
            idempotencyKey: `${frame.projectionId}:${frame.frameId}:lnk:${frame.frameRevision}`,
            writtenAt: Date.now(),
          })
        }),
    }),
  )

export const noopFrameStreamWriterLayer: Layer.Layer<FrameStreamWriter> = Layer.succeed(
  FrameStreamWriter,
  FrameStreamWriter.of({
    write: (_config, frame) =>
      Effect.succeed(ProjectionOutputReceipt.make({
        kind: "lnk-frame-stream",
        projectionId: frame.projectionId,
        frameId: frame.frameId,
        target: "noop",
        idempotencyKey: `${frame.projectionId}:${frame.frameId}:noop`,
        writtenAt: Date.now(),
      })),
  }),
)

// ─── Runtime state ──────────────────────────────────────────────────────────

interface ProjectionRuntimeState {
  readonly frames: ReadonlyMap<string, FrameAssemblyStateType>
  readonly ledger: ProjectionPartLedgerState
  readonly emittedFrameIds: ReadonlySet<string>
}

const emptyRuntimeState = (): ProjectionRuntimeState => ({
  frames: new Map(),
  ledger: emptyProjectionPartLedgerState(),
  emittedFrameIds: new Set(),
})

const payloadFromState = (state: FrameAssemblyStateType): Record<string, unknown> => {
  const payload: Record<string, unknown> = {}
  for (const part of state.parts) payload[part.partKey] = part.payload
  return payload
}

const materializeFrame = (
  config: ProjectionWorkerConfigType,
  state: FrameAssemblyStateType,
  complete: boolean,
  emittedAt = Date.now(),
): MaterializedFrameType =>
  MaterializedFrame.make({
    projectionId: config.spec.id,
    projectionVersion: config.spec.id,
    outputSchemaId: config.spec.output.schemaId,
    frameId: state.frameId,
    frameTime: state.frameTime,
    entityKey: state.entityKey,
    complete,
    missingParts: state.completeness.missingParts,
    imputedParts: state.completeness.imputedParts,
    payload: payloadFromState(state),
    provenance: state.provenance,
    frameRevision: 1,
    emittedAt,
  })

const writeOutputs = (
  config: ProjectionWorkerConfigType,
  timescale: TimescaleFrameWriterShape,
  frameStream: FrameStreamWriterShape,
  frame: MaterializedFrameType,
): Effect.Effect<ReadonlyArray<ProjectionOutputReceiptType>, unknown> =>
  Effect.gen(function* () {
    const timescaleReceipt = yield* timescale.write(config, frame)
    if (config.spec.output.streamId === undefined) return [timescaleReceipt]
    const streamReceipt = yield* frameStream.write(config, frame)
    return [timescaleReceipt, streamReceipt]
  })

const tickFromMessages = (
  config: ProjectionWorkerConfigType,
  reader: ProjectionSourceReaderShape,
  timescale: TimescaleFrameWriterShape,
  frameStream: FrameStreamWriterShape,
  stateRef: Ref.Ref<ProjectionRuntimeState>,
): Effect.Effect<ProjectionTickResultType, unknown> =>
  Effect.gen(function* () {
    const startedAt = Date.now()
    const messages = yield* reader.read(config)
    let state = yield* Ref.get(stateRef)
    let acceptedParts = 0
    let duplicateParts = 0
    const completedFrames: MaterializedFrameType[] = []
    const partialFrames: MaterializedFrameType[] = []
    const deadLetters: ProjectionDeadLetterType[] = []
    const outputReceipts: ProjectionOutputReceiptType[] = []

    for (const message of messages) {
      const part = yield* sourceMessageToFramePart(config.spec, message)
      const ledgerDecision = ledgerDecisionForPart(state.ledger, part)
      if (ledgerDecision.duplicate) {
        duplicateParts += 1
        continue
      }
      state = { ...state, ledger: recordLedgerDecision(state.ledger, ledgerDecision) }
      const current = state.frames.get(part.frameId)
      const merged = yield* mergeFramePart(config.spec, current, part)
      if (merged.duplicate) {
        duplicateParts += 1
        continue
      }
      acceptedParts += 1
      const frames = new Map(state.frames).set(merged.state.frameId, merged.state)
      state = { ...state, frames }

      if (merged.state.completeness.complete && !state.emittedFrameIds.has(merged.state.frameId)) {
        const materialized = materializeFrame(config, merged.state, true)
        completedFrames.push(materialized)
        outputReceipts.push(...yield* writeOutputs(config, timescale, frameStream, materialized))
        state = { ...state, emittedFrameIds: new Set(state.emittedFrameIds).add(merged.state.frameId) }
      }
    }

    let timeoutOutcome: ProjectionTickResultType["timeoutOutcome"] = "none"
    const afterMessages = Date.now()
    for (const frameState of state.frames.values()) {
      if (state.emittedFrameIds.has(frameState.frameId)) continue
      const outcome = yield* frameTimeoutOutcome(config.spec, frameState, afterMessages)
      if (outcome === "none") continue
      timeoutOutcome = outcome
      if (outcome === "emitted-partial") {
        const materialized = materializeFrame(config, frameState, false)
        partialFrames.push(materialized)
        outputReceipts.push(...yield* writeOutputs(config, timescale, frameStream, materialized))
        state = { ...state, emittedFrameIds: new Set(state.emittedFrameIds).add(frameState.frameId) }
      } else if (outcome === "dead-lettered") {
        deadLetters.push(ProjectionDeadLetter.make({
          projectionId: config.spec.id,
          frameId: frameState.frameId,
          reason: "timeout",
          state: frameState,
          recordedAt: Date.now(),
        }))
        state = { ...state, emittedFrameIds: new Set(state.emittedFrameIds).add(frameState.frameId) }
      } else if (outcome === "dropped-partial") {
        state = { ...state, emittedFrameIds: new Set(state.emittedFrameIds).add(frameState.frameId) }
      }
    }

    yield* Ref.set(stateRef, state)
    const finishedAt = Date.now()
    return ProjectionTickResult.make({
      projectionId: config.spec.id,
      workerId: config.workerId,
      processedMessages: messages.length,
      acceptedParts,
      duplicateParts,
      completedFrames,
      partialFrames,
      deadLetters,
      outputReceipts,
      timeoutOutcome,
      startedAt,
      finishedAt,
    })
  })

const summaryFromTick = (
  config: ProjectionWorkerConfigType,
  tick: ProjectionTickResultType,
): typeof ProjectionWorkerRunSummary.Type =>
  ProjectionWorkerRunSummary.make({
    workerId: config.workerId,
    projectionId: config.spec.id,
    status: config.mode === "tail" ? "running" : "stopped",
    ticks: [tick],
    processedMessages: tick.processedMessages,
    emittedFrames: tick.completedFrames.length + tick.partialFrames.length,
    duplicateParts: tick.duplicateParts,
    failedFrames: tick.deadLetters.length,
    startedAt: tick.startedAt,
    finishedAt: tick.finishedAt,
  })

export const projectionRuntimeRunnerLayer: Layer.Layer<
  ProjectionWorkerRunner,
  never,
  ProjectionSourceReader | TimescaleFrameWriter | FrameStreamWriter
> = Layer.effect(
  ProjectionWorkerRunner,
  Effect.gen(function* () {
    const reader = yield* ProjectionSourceReader
    const timescale = yield* TimescaleFrameWriter
    const frameStream = yield* FrameStreamWriter
    const stateRef = yield* Ref.make<ProjectionRuntimeState>(emptyRuntimeState())

    return ProjectionWorkerRunner.of({
      runOnce: (config) =>
        Effect.gen(function* () {
          const tick = yield* tickFromMessages(config, reader, timescale, frameStream, stateRef)
          return summaryFromTick(config, tick)
        }),
      tail: (config) =>
        Effect.succeed(ProjectionWorkerSnapshot.make({
          workerId: config.workerId,
          projectionId: config.spec.id,
          status: "running",
          mode: "tail",
          startedAt: Date.now(),
          stoppedAt: null,
          lastTickAt: null,
          processedMessages: 0,
          emittedFrames: 0,
          duplicateParts: 0,
          failedFrames: 0,
          lastError: null,
        })),
    })
  }),
)
