import { Schema } from "effect"

export const SketchLaneId = Schema.Literal(
  "waterfall-lowres",
  "quantized-dropout"
)
export type SketchLaneId = typeof SketchLaneId.Type

export const SignalClass = Schema.Literal(
  "tone",
  "chirp",
  "burst",
  "carrier",
  "unknown"
)
export type SignalClass = typeof SignalClass.Type

export const QuiskSuggestionAction = Schema.Literal(
  "inspect-window",
  "tune-and-verify",
  "annotate-waterfall"
)
export type QuiskSuggestionAction = typeof QuiskSuggestionAction.Type

export const QuiskModeHint = Schema.Literal(
  "USB",
  "LSB",
  "CW",
  "AM",
  "FM",
  "unknown"
)
export type QuiskModeHint = typeof QuiskModeHint.Type

export const IqWindowMeta = Schema.Struct({
  sampleRateHz: Schema.Number,
  centerFrequencyHz: Schema.Number,
  startTimeMs: Schema.Number,
  durationMs: Schema.Number,
  sampleCount: Schema.Number,
  seed: Schema.Number,
})
export type IqWindowMeta = typeof IqWindowMeta.Type

export const SignalTruthBox = Schema.Struct({
  id: Schema.String,
  class: SignalClass,
  timeStartMs: Schema.Number,
  timeEndMs: Schema.Number,
  frequencyStartHz: Schema.Number,
  frequencyEndHz: Schema.Number,
  amplitude: Schema.Number,
})
export type SignalTruthBox = typeof SignalTruthBox.Type

export const SignalSketchCell = Schema.Struct({
  timeBin: Schema.Number,
  frequencyBin: Schema.Number,
  timeStartMs: Schema.Number,
  timeEndMs: Schema.Number,
  frequencyStartHz: Schema.Number,
  frequencyEndHz: Schema.Number,
  magnitude: Schema.Number,
  score: Schema.Number,
})
export type SignalSketchCell = typeof SignalSketchCell.Type

export const SignalSketchSummary = Schema.Struct({
  maxScore: Schema.Number,
  meanScore: Schema.Number,
  threshold: Schema.Number,
  activeCellCount: Schema.Number,
})
export type SignalSketchSummary = typeof SignalSketchSummary.Type

export const SignalSketchFrame = Schema.TaggedStruct("SignalSketchFrame", {
  id: Schema.String,
  laneId: SketchLaneId,
  meta: IqWindowMeta,
  width: Schema.Number,
  height: Schema.Number,
  cells: Schema.Array(SignalSketchCell),
  summary: SignalSketchSummary,
})
export type SignalSketchFrame = typeof SignalSketchFrame.Type

export const SignalCandidate = Schema.TaggedStruct("SignalCandidate", {
  id: Schema.String,
  sourceFrameIds: Schema.Array(Schema.String),
  class: SignalClass,
  confidence: Schema.Number,
  timeStartMs: Schema.Number,
  timeEndMs: Schema.Number,
  frequencyStartHz: Schema.Number,
  frequencyEndHz: Schema.Number,
  verifier: Schema.Literal("energy-stft-baseline", "sketch-ensemble"),
  evidence: Schema.Record({ key: Schema.String, value: Schema.Number }),
})
export type SignalCandidate = typeof SignalCandidate.Type

export const QuiskSuggestion = Schema.TaggedStruct("QuiskSuggestion", {
  id: Schema.String,
  candidateId: Schema.String,
  action: QuiskSuggestionAction,
  modeHint: QuiskModeHint,
  centerFrequencyHz: Schema.Number,
  bandwidthHz: Schema.Number,
  timeStartMs: Schema.Number,
  timeEndMs: Schema.Number,
  confidence: Schema.Number,
  message: Schema.String,
})
export type QuiskSuggestion = typeof QuiskSuggestion.Type

export const SketchArtifactEnvelope = Schema.TaggedStruct("SketchArtifactEnvelope", {
  runId: Schema.String,
  createdAt: Schema.String,
  meta: IqWindowMeta,
  truth: Schema.Array(SignalTruthBox),
  frames: Schema.Array(SignalSketchFrame),
  candidates: Schema.Array(SignalCandidate),
  suggestions: Schema.Array(QuiskSuggestion),
})
export type SketchArtifactEnvelope = typeof SketchArtifactEnvelope.Type

export const decodeSketchArtifactEnvelope = Schema.decodeUnknownSync(SketchArtifactEnvelope)
