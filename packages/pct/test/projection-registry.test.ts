import { describe, expect, it } from "vitest"
import * as Effect from "effect-v4/Effect"

import {
  FrameProjectionSpec,
  ProjectionNotFound,
  ProjectionRegistry,
  projectionRegistryLayerMemory,
} from "../src/frames/index.js"

const spec = (id: string, table: string, tag: string) =>
  FrameProjectionSpec.make({
    id,
    description: `${tag} projection`,
    sources: [
      {
        streamId: `${tag}.source`,
        schemaId: `${tag}.source@1.0.0`,
        as: tag,
        timeField: ["observedAt"],
        keyFields: [["entityId"]],
      },
    ],
    frame: {
      timeBucket: "5 seconds",
      required: [tag],
      allowedLatenessMs: 1_000,
      onTimeout: "emit-partial",
    },
    output: {
      table,
      schemaId: `frames.${tag}@1.0.0`,
      mode: "hybrid-wide",
      columns: [
        {
          column: "entity_id",
          sqlType: "text",
          path: ["entityId"],
          role: "key",
          nullable: false,
        },
      ],
    },
  })

describe("ProjectionRegistry", () => {
  it("registers multiple FrameProjectionSpec records with compiled plans", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const registry = yield* ProjectionRegistry
        const vitals = yield* registry.register(spec("vitals.snapshot@1.0.0", "vitals_snapshot_frames", "vitals"), {
          status: "active",
          tags: ["clinical", "vitals"],
          now: 100,
        })
        const machine = yield* registry.register(spec("machine.cycle@1.0.0", "machine_cycle_frames", "cycle"), {
          status: "draft",
          tags: ["iiot"],
          now: 200,
        })
        const active = yield* registry.list({ status: "active" })
        const clinical = yield* registry.list({ tag: "clinical" })
        return { vitals, machine, active, clinical }
      }).pipe(Effect.provide(projectionRegistryLayerMemory)),
    )

    expect(result.vitals.plan.frameTable).toBe("vitals_snapshot_frames")
    expect(result.machine.plan.frameTable).toBe("machine_cycle_frames")
    expect(result.active.map((entry) => entry.projectionId)).toEqual(["vitals.snapshot@1.0.0"])
    expect(result.clinical.map((entry) => entry.projectionId)).toEqual(["vitals.snapshot@1.0.0"])
  })

  it("updates status without changing the original registration timestamp", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const registry = yield* ProjectionRegistry
        yield* registry.register(spec("vitals.snapshot@1.0.0", "vitals_snapshot_frames", "vitals"), {
          now: 100,
        })
        const updated = yield* registry.setStatus("vitals.snapshot@1.0.0", "active", 150)
        const fetched = yield* registry.get("vitals.snapshot@1.0.0")
        return { updated, fetched }
      }).pipe(Effect.provide(projectionRegistryLayerMemory)),
    )

    expect(result.updated.status).toBe("active")
    expect(result.fetched.registeredAt).toBe(100)
    expect(result.fetched.updatedAt).toBe(150)
  })

  it("fails with ProjectionNotFound for missing projections", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const registry = yield* ProjectionRegistry
        return yield* registry.get("missing@1.0.0").pipe(Effect.result)
      }).pipe(Effect.provide(projectionRegistryLayerMemory)),
    )

    expect(result._tag).toBe("Failure")
    if (result._tag === "Failure") {
      expect(result.failure).toBeInstanceOf(ProjectionNotFound)
      expect(result.failure.projectionId).toBe("missing@1.0.0")
    }
  })
})
