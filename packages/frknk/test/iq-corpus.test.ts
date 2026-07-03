import { describe, expect, it } from "vitest"
import { IQCaptureMetadata, decodeIQCaptureMetadata } from "../src/index.js"

describe("IQ corpus contracts", () => {
  it("decodes capture metadata sidecars", () => {
    const metadata = new IQCaptureMetadata({
      captureId: "synthetic-cw-0001",
      sourceId: "synthetic/noise-plus-tone",
      sampleFormat: "complex64-le",
      sampleRateHz: 48_000,
      centerFrequencyHz: 7_100_000,
      sampleCount: 48_000,
      durationSeconds: 1,
      createdAtUnixMs: 1_764_000_000_000,
      iqPath: "synthetic-cw-0001.c64",
      generator: {
        kind: "synthetic.noise_plus_tone",
        seed: 7,
        parameters: { toneOffsetHz: 1_200, snrDb: -6 },
      },
      labels: [
        {
          labelId: "label-cw-0001",
          classLabel: "carrier",
          timeRange: { startSeconds: 0, endSeconds: 1 },
          frequencyRangeHz: { lowHz: 7_100_825, highHz: 7_101_575 },
          confidence: 1,
          source: "synthetic",
        },
      ],
    })

    expect(decodeIQCaptureMetadata(metadata)._tag).toBe("IQCaptureMetadata")
    expect(metadata.labels[0]?.classLabel).toBe("carrier")
  })
})
