import { describe, expect, it } from "vitest"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"

import { PctDoctorService, pctDoctorServiceLayer } from "../src/doctor/PctDoctor.js"
import { layerMemory as RegistryMemory } from "../src/registry/Memory.js"

describe("PctDoctorService spike", () => {
  it("reports registry snapshot health without transport diagnostics", async () => {
    const report = await Effect.runPromise(
      Effect.gen(function* () {
        const doctor = yield* PctDoctorService
        return yield* doctor.report
      }).pipe(
        Effect.provide(pctDoctorServiceLayer.pipe(Layer.provide(RegistryMemory))),
      ),
    )

    expect(report.layer).toBe("pct")
    expect(report.severity).toBe("ok")
    expect(report.checks).toHaveLength(1)
    expect(report.checks[0]?.checkId).toBe("pct.registry.snapshot")
    expect(report.checks[0]?.status).toBe("passed")
    expect(report.checks[0]?.findings[0]?.message).toContain("registry revision=")
  })
})
