import { describe, expect, it } from "vitest"
import * as Effect from "effect-v4/Effect"

import {
  FrameProjectionSpec,
  ProjectionPlan,
  ProjectionWorkerControlFailure,
  makeProjectionWorkerNatsEndpoints,
  mapProjectionWorkerNatsError,
  resolveProjectionWorkerNatsOptions,
  type ProjectionWorkerControlShape,
} from "../src/frames/index.js"

const spec = FrameProjectionSpec.make({
  id: "vitals.snapshot@1.0.0",
  sources: [],
  frame: {
    timeBucket: "5 seconds",
    required: [],
    allowedLatenessMs: 1_000,
    onTimeout: "emit-partial",
  },
  output: {
    table: "vitals_snapshot_frames",
    schemaId: "frames.vitals.snapshot@1.0.0",
    mode: "hybrid-wide",
    columns: [],
  },
})

const plan = ProjectionPlan.make({
  projectionId: spec.id,
  frameTable: "vitals_snapshot_frames",
  sourceFactTable: "metric_observations",
  stateTable: "frame_projection_state",
  ledgerTable: "frame_part_ledger",
  statements: [],
})

const worker = {
  workerId: "worker-a",
  projectionId: spec.id,
  status: "running" as const,
  mode: "tail" as const,
  startedAt: 1,
  stoppedAt: null,
  lastTickAt: 2,
  processedMessages: 3,
  emittedFrames: 1,
  duplicateParts: 0,
  failedFrames: 0,
  lastError: null,
}

const control: ProjectionWorkerControlShape = {
  plan: (request) =>
    Effect.succeed({
      projectionId: request.projectionId,
      plan,
      generatedAt: 10,
    }),
  start: () => Effect.succeed({ worker, started: true }),
  stop: () =>
    Effect.succeed({
      workerId: worker.workerId,
      projectionId: worker.projectionId,
      status: "stopped",
      stoppedAt: 12,
    }),
  status: () => Effect.succeed({ workers: [worker], reportedAt: 13 }),
  runOnce: () =>
    Effect.succeed({
      summary: {
        workerId: worker.workerId,
        projectionId: worker.projectionId,
        status: "stopped",
        ticks: [],
        processedMessages: 3,
        emittedFrames: 1,
        duplicateParts: 0,
        failedFrames: 0,
        startedAt: 1,
        finishedAt: 12,
      },
    }),
  tail: () => Effect.succeed({ worker, status: "running" }),
}

describe("ProjectionWorker NATS host adapter", () => {
  it("builds six schema-backed MSH micro endpoint specs", async () => {
    const resolved = resolveProjectionWorkerNatsOptions({
      subjectRoot: "pct.v1.projection",
      queue: "projection-workers",
    })
    const endpoints = makeProjectionWorkerNatsEndpoints(control, resolved)

    expect(endpoints.map((endpoint) => endpoint.name)).toEqual([
      "projection-plan",
      "projection-start",
      "projection-stop",
      "projection-status",
      "projection-run-once",
      "projection-tail",
    ])
    expect(endpoints.map((endpoint) => endpoint.subject)).toEqual([
      "pct.v1.projection.plan",
      "pct.v1.projection.start",
      "pct.v1.projection.stop",
      "pct.v1.projection.status",
      "pct.v1.projection.run_once",
      "pct.v1.projection.tail",
    ])
    expect(endpoints.every((endpoint) => endpoint.queue === "projection-workers")).toBe(true)
    expect(endpoints.every((endpoint) => endpoint.metadata?.boundary === "semantic-worker-over-msh-micro-substrate")).toBe(true)
  })

  it("delegates endpoint handlers to the injected control service", async () => {
    const resolved = resolveProjectionWorkerNatsOptions()
    const endpoints = makeProjectionWorkerNatsEndpoints(control, resolved)
    const planEndpoint = endpoints.find((endpoint) => endpoint.name === "projection-plan")
    const statusEndpoint = endpoints.find((endpoint) => endpoint.name === "projection-status")

    expect(planEndpoint).toBeDefined()
    expect(statusEndpoint).toBeDefined()

    const planResponse = await Effect.runPromise(
      planEndpoint!.handle({ projectionId: spec.id }, {} as never),
    )
    const statusResponse = await Effect.runPromise(
      statusEndpoint!.handle({}, {} as never),
    )

    expect(planResponse.plan.frameTable).toBe("vitals_snapshot_frames")
    expect(statusResponse.workers[0]?.workerId).toBe("worker-a")
  })

  it("maps control failures to NATS micro service errors", () => {
    const response = mapProjectionWorkerNatsError(
      new ProjectionWorkerControlFailure({
        operation: "projection.start",
        message: "already running",
      }),
    )

    expect(response).toEqual({
      code: 500,
      message: "projection.start: already running",
    })
  })
})
