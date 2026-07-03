# Lossy RF Sketch Locator — Offline Sidecar Pipeline

This is the mainline prototype path for `#F1132 Lossy RF Sketch Locator — Quisk Sidecar Prototype`.

The sidecar is deliberately modest: it does not demodulate and does not replace Quisk. It produces cheap, lossy, invariant-exposing sketches that emit candidate time/frequency boxes and Quisk-style suggestions. Clean Quisk/Hermes DSP remains the verifier.

---

## Pipeline map

```text
Synthetic / recorded IQ
  │
  ▼
IQ fixture metadata
  │
  ├─ full-fidelity path retained for verifier / corpus
  │
  ▼
Sketch lanes
  ├─ low_res_waterfall
  │    IQ → coarse STFT tile → median-power peak detector
  │
  └─ one_bit_iq
       IQ → quadrant-only sign quantization → coarse STFT tile

  │
  ▼
Candidate builder
  ├─ peak bin → frequency range
  ├─ duration → time range
  ├─ sketch lane scores → evidence[]
  └─ verifierStatus = unverified

  │
  ▼
Suggestion mapper
  └─ QuiskSuggestion(action = run_clean_verifier)

  │
  ▼
Artifacts
  ├─ frame.json
  ├─ candidate.json
  ├─ suggestion.json
  ├─ summary.json
  ├─ waterfall-power-db.npy
  ├─ one-bit-waterfall-power-db.npy
  └─ one-bit-iq.c64
```

---

## Module ownership

| Module | Role |
|---|---|
| `sdr_lab.iq.synthetic` | deterministic synthetic noise + tone IQ source |
| `sdr_lab.iq.corpus` | full-fidelity IQ payload + metadata sidecar protocol |
| `sdr_lab.sketches.waterfall` | low-resolution waterfall/STFT sketch lane |
| `sdr_lab.sketches.destructive` | destructive invariant-exposure lanes; first lane is one-bit IQ |
| `sdr_lab.locator` | pure fixture → lanes → candidate → suggestion pipeline |
| `sdr_lab.cli` | runnable demos: `smoke`, `sketch-demo`, `hermes-emulator` |
| `sdr_lab.contracts` | Python Pydantic mirror of TypeScript/Effect Schema contracts |
| `@gbg/frknk/src/contracts.ts` | TypeScript/Effect Schema contract source for TMNL |

---

## Current lanes

### `low_res_waterfall`

Purpose: fastest locator baseline.

Shape:

```text
complex64 IQ → [bins_time, bins_frequency] power_db tile
```

Detection strategy:

```text
median power per frequency bin → strongest bin → candidate frequency range
```

### `one_bit_iq`

Purpose: destructive invariant exposure.

Shape:

```text
complex64 IQ → sign(real) + j sign(imag) → low_res_waterfall
```

This lane discards amplitude entirely. If a narrowband tone still appears, it is a useful sign that the candidate is not only an amplitude artifact.

---

## Runbook

From `packages/frknk/experiments/sdr-lab`:

```bash
uv run --extra dev pytest
uv run sdr-lab smoke
uv run sdr-lab sketch-demo --output-dir reports/sketch-demo
```

The smoke command prints a compact JSON envelope:

```json
{
  "frame": { "_tag": "SignalSketchFrame" },
  "candidate": { "_tag": "SignalCandidate" },
  "suggestion": { "_tag": "QuiskSuggestion" }
}
```

The demo command writes JSON + NumPy artifacts suitable for inspection and later TMNL visualization.

---

## Boundary rules

- Sketch output is **not truth**.
- Candidate confidence is a routing score, not demodulation certainty.
- `verifierStatus` starts as `unverified`.
- Quisk/Hermes clean DSP decides whether a candidate is accepted.
- Hardware/TX concerns stay out of this cycle.
