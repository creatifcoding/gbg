import { Schema } from "effect"

/**
 * FRKNK contract layer.
 *
 * These are the TypeScript/TMNL-facing contracts for the Python SDR lab.
 * Python emits JSON shaped like these schemas; TMNL consumes, validates, and
 * turns them into cockpit state/suggestions. Clean Quisk/Hermes DSP remains the
 * verifier — these messages are suggestions and artifacts, not truth.
 */

export const SketchKind = Schema.Literals([
  "low_res_waterfall",
  "one_bit_iq",
  "quantized_iq",
  "dropout_projection",
  "random_projection",
  "patch_shuffle",
  "learned_frontend",
] as const)
export type SketchKind = typeof SketchKind.Type

export const SignalClass = Schema.Literals([
  "unknown",
  "carrier",
  "cw",
  "am",
  "fm",
  "ssb",
  "digital",
  "noise_floor_change",
] as const)
export type SignalClass = typeof SignalClass.Type

export const SuggestionAction = Schema.Literals([
  "inspect_window",
  "tune_center",
  "zoom_waterfall",
  "bookmark_candidate",
  "run_clean_verifier",
] as const)
export type SuggestionAction = typeof SuggestionAction.Type

export const FrequencyRangeHz = Schema.Struct({
  lowHz: Schema.Number,
  highHz: Schema.Number,
})
export type FrequencyRangeHz = typeof FrequencyRangeHz.Type

export const TimeRangeSeconds = Schema.Struct({
  startSeconds: Schema.Number,
  endSeconds: Schema.Number,
})
export type TimeRangeSeconds = typeof TimeRangeSeconds.Type

export const SketchLaneSummary = Schema.Struct({
  laneId: Schema.String,
  kind: SketchKind,
  binsTime: Schema.Number,
  binsFrequency: Schema.Number,
  valueScale: Schema.Literals(["linear", "log_power", "db", "binary"] as const),
  artifactUri: Schema.optional(Schema.String),
  byteLength: Schema.optional(Schema.Number),
  stats: Schema.optional(Schema.Record(Schema.String, Schema.Number)),
})
export type SketchLaneSummary = typeof SketchLaneSummary.Type

export class SignalSketchFrame extends Schema.TaggedClass<SignalSketchFrame>()(
  "SignalSketchFrame",
  {
    frameId: Schema.String,
    sourceId: Schema.String,
    centerFrequencyHz: Schema.Number,
    sampleRateHz: Schema.Number,
    startedAtUnixMs: Schema.Number,
    durationSeconds: Schema.Number,
    iqSampleCount: Schema.Number,
    lanes: Schema.Array(SketchLaneSummary),
    metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  },
) {}
export type SignalSketchFrameShape = typeof SignalSketchFrame.Type

export const CandidateEvidence = Schema.Struct({
  laneId: Schema.String,
  kind: SketchKind,
  score: Schema.Number,
  note: Schema.optional(Schema.String),
})
export type CandidateEvidence = typeof CandidateEvidence.Type

export class SignalCandidate extends Schema.TaggedClass<SignalCandidate>()(
  "SignalCandidate",
  {
    candidateId: Schema.String,
    frameId: Schema.String,
    sourceId: Schema.String,
    timeRange: TimeRangeSeconds,
    frequencyRangeHz: FrequencyRangeHz,
    classLabel: SignalClass,
    confidence: Schema.Number,
    evidence: Schema.Array(CandidateEvidence),
    verifierStatus: Schema.Literals(["unverified", "accepted", "rejected", "needs_more_iq"] as const),
    metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  },
) {}
export type SignalCandidateShape = typeof SignalCandidate.Type

export class QuiskSuggestion extends Schema.TaggedClass<QuiskSuggestion>()(
  "QuiskSuggestion",
  {
    suggestionId: Schema.String,
    candidateId: Schema.String,
    sourceId: Schema.String,
    action: SuggestionAction,
    label: Schema.String,
    rationale: Schema.String,
    centerFrequencyHz: Schema.optional(Schema.Number),
    bandwidthHz: Schema.optional(Schema.Number),
    timeRange: Schema.optional(TimeRangeSeconds),
    confidence: Schema.Number,
    requiresVerification: Schema.Boolean,
    metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  },
) {}
export type QuiskSuggestionShape = typeof QuiskSuggestion.Type

export const FrknkMessage = Schema.Union([
  SignalSketchFrame,
  SignalCandidate,
  QuiskSuggestion,
])
export type FrknkMessage = typeof FrknkMessage.Type

export const decodeFrknkMessage = Schema.decodeUnknownSync(FrknkMessage)
export const decodeSignalSketchFrame = Schema.decodeUnknownSync(SignalSketchFrame)
export const decodeSignalCandidate = Schema.decodeUnknownSync(SignalCandidate)
export const decodeQuiskSuggestion = Schema.decodeUnknownSync(QuiskSuggestion)
