import { describe, expect, it } from "vitest"
import {
  SignalCandidate,
  SignalSketchFrame,
  QuiskSuggestion,
  decodeFrknkMessage,
} from "../src/index.js"

describe("FRKNK contracts", () => {
  it("decodes the first sketch → candidate → suggestion messages", () => {
    const frame = new SignalSketchFrame({
      frameId: "frame-0001",
      sourceId: "synthetic/noise-plus-cw",
      centerFrequencyHz: 7_100_000,
      sampleRateHz: 48_000,
      startedAtUnixMs: 1_764_000_000_000,
      durationSeconds: 1,
      iqSampleCount: 48_000,
      lanes: [
        {
          laneId: "waterfall-32x64",
          kind: "low_res_waterfall",
          binsTime: 32,
          binsFrequency: 64,
          valueScale: "db",
          stats: { maxDb: -12, medianDb: -72 },
        },
      ],
    })

    const candidate = new SignalCandidate({
      candidateId: "cand-0001",
      frameId: frame.frameId,
      sourceId: frame.sourceId,
      timeRange: { startSeconds: 0.25, endSeconds: 0.75 },
      frequencyRangeHz: { lowHz: 7_101_000, highHz: 7_101_250 },
      classLabel: "cw",
      confidence: 0.78,
      evidence: [
        {
          laneId: "waterfall-32x64",
          kind: "low_res_waterfall",
          score: 0.78,
          note: "needle survives low-resolution waterfall projection",
        },
      ],
      verifierStatus: "unverified",
    })

    const suggestion = new QuiskSuggestion({
      suggestionId: "sugg-0001",
      candidateId: candidate.candidateId,
      sourceId: candidate.sourceId,
      action: "run_clean_verifier",
      label: "Inspect candidate near 7.101125 MHz",
      rationale: "Sketch evidence found a narrowband invariant; clean DSP must verify it.",
      centerFrequencyHz: 7_101_125,
      bandwidthHz: 250,
      timeRange: candidate.timeRange,
      confidence: candidate.confidence,
      requiresVerification: true,
    })

    expect(decodeFrknkMessage(frame)._tag).toBe("SignalSketchFrame")
    expect(decodeFrknkMessage(candidate)._tag).toBe("SignalCandidate")
    expect(decodeFrknkMessage(suggestion)._tag).toBe("QuiskSuggestion")
  })
})
