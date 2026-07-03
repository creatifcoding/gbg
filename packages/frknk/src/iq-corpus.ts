import { Schema } from "effect"
import { FrequencyRangeHz, SignalClass, TimeRangeSeconds } from "./contracts.js"

export const SampleFormat = Schema.Literals(["complex64-le"] as const)
export type SampleFormat = typeof SampleFormat.Type

export const LabelSource = Schema.Literals(["synthetic", "manual", "imported", "verifier"] as const)
export type LabelSource = typeof LabelSource.Type

export const IQGeneratorMetadata = Schema.Struct({
  kind: Schema.String,
  seed: Schema.optional(Schema.Number),
  parameters: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
})
export type IQGeneratorMetadata = typeof IQGeneratorMetadata.Type

export const IQCaptureLabel = Schema.Struct({
  labelId: Schema.String,
  classLabel: SignalClass,
  timeRange: TimeRangeSeconds,
  frequencyRangeHz: FrequencyRangeHz,
  confidence: Schema.Number,
  source: LabelSource,
  notes: Schema.optional(Schema.Array(Schema.String)),
})
export type IQCaptureLabel = typeof IQCaptureLabel.Type

export class IQCaptureMetadata extends Schema.TaggedClass<IQCaptureMetadata>()(
  "IQCaptureMetadata",
  {
    captureId: Schema.String,
    sourceId: Schema.String,
    sampleFormat: SampleFormat,
    sampleRateHz: Schema.Number,
    centerFrequencyHz: Schema.Number,
    sampleCount: Schema.Number,
    durationSeconds: Schema.Number,
    createdAtUnixMs: Schema.Number,
    iqPath: Schema.String,
    generator: Schema.optional(IQGeneratorMetadata),
    labels: Schema.Array(IQCaptureLabel),
    notes: Schema.optional(Schema.Array(Schema.String)),
  },
) {}
export type IQCaptureMetadataShape = typeof IQCaptureMetadata.Type

export const decodeIQCaptureMetadata = Schema.decodeUnknownSync(IQCaptureMetadata as never)
