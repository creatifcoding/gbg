/**
 * Bedside-vitals tracer specs.
 *
 * Uses relative imports to access pct internals. In a downstream
 * package that depends on @tmnl/pct, you'd write:
 *   import * as Procedure from "@tmnl/pct/procedures"
 */
import * as Schema from "effect/Schema"
import * as Procedure from "../../src/procedures/index.js"

export const DeviceId = Schema.String.check(
  Schema.isPattern(/^dev_[a-z0-9_]+$/),
)

export const PatientId = Schema.String.check(
  Schema.isPattern(/^pat_[a-z0-9_]+$/),
)

export const HeartRate = Schema.Struct({
  bpm: Schema.Number,
  observedAt: Schema.String,
  deviceId: DeviceId,
  patientId: PatientId,
})

export const HeartRateInput = Schema.Struct({
  bpm: Schema.Number,
  deviceId: DeviceId,
  patientId: PatientId,
})

export const submitReading = Procedure.mutation("vitals.submitReading", {
  input: HeartRateInput,
  output: HeartRate,
  errors: [],
  version: "1.0.0",
})

export const Vitals = Procedure.makeGroup(
  { name: "vitals", version: "1.0.0" },
  submitReading,
)
