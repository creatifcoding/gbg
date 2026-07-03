# Lossy RF Sketch Locator — Artifact Index

Working prototype slice for `#F1132 Lossy RF Sketch Locator — Quisk Sidecar Prototype`.

## Source artifacts

| Path | Purpose |
|---|---|
| `experiments/sdr-lab/src/sdr_lab/iq/synthetic.py` | deterministic synthetic IQ fixture generator |
| `experiments/sdr-lab/src/sdr_lab/sketches/waterfall.py` | low-resolution waterfall/STFT sketch lane |
| `experiments/sdr-lab/src/sdr_lab/sketches/destructive.py` | one-bit IQ destructive sketch lane |
| `experiments/sdr-lab/src/sdr_lab/locator.py` | pure fixture → lanes → candidate → suggestion pipeline |
| `experiments/sdr-lab/src/sdr_lab/cli.py` | CLI entrypoints: `smoke`, `sketch-demo`, `hermes-emulator` |
| `experiments/sdr-lab/tests/test_sketch_locator.py` | deterministic locator and artifact writer tests |
| `src/contracts.ts` | TypeScript/Effect Schema sketch contracts consumed by TMNL |

## Documentation artifacts

| Path | Purpose |
|---|---|
| `docs/lossy-sketch-locator-pipeline.md` | pipeline map and runbook |
| `docs/iq-corpus-protocol.md` | IQ corpus sidecar format |
| `docs/foundation.md` | FRKNK foundation and language/runtime boundary |
| `thoughts/shared/research/2026-05-24-lossy-rf-sketch-ml-locator-corpus.md` | research framing and checkpoint log |

## Runtime artifacts produced by `sketch-demo`

Run:

```bash
cd packages/frknk/experiments/sdr-lab
uv run sdr-lab sketch-demo --output-dir reports/sketch-demo
```

Outputs:

| File | Meaning |
|---|---|
| `frame.json` | `SignalSketchFrame` with low-res waterfall + one-bit lane summaries |
| `candidate.json` | `SignalCandidate` with time/frequency box and lane evidence |
| `suggestion.json` | `QuiskSuggestion` requesting clean verifier inspection |
| `summary.json` | combined frame/candidate/suggestion envelope |
| `waterfall-power-db.npy` | low-res waterfall tile |
| `one-bit-waterfall-power-db.npy` | one-bit destructive lane waterfall tile |
| `one-bit-iq.c64` | complex64 one-bit quantized IQ payload |

## Validation evidence

Captured 2026-05-26:

```bash
cd packages/frknk/experiments/sdr-lab
LD_LIBRARY_PATH="$(nix eval --raw nixpkgs#stdenv.cc.cc.lib.outPath)/lib:$(nix eval --raw nixpkgs#zlib.outPath)/lib" uv run --extra dev pytest
# 12 passed

LD_LIBRARY_PATH="$(nix eval --raw nixpkgs#stdenv.cc.cc.lib.outPath)/lib:$(nix eval --raw nixpkgs#zlib.outPath)/lib" uv run --extra dev ruff check .
# All checks passed!

LD_LIBRARY_PATH="$(nix eval --raw nixpkgs#stdenv.cc.cc.lib.outPath)/lib:$(nix eval --raw nixpkgs#zlib.outPath)/lib" uv run --extra dev mypy src tests
# Success: no issues found in 18 source files

cd packages/frknk
bun run typecheck
bun run test:run
bun run build
```

## Interpretation

The sidecar is now functional but deliberately primitive. It proves the seam:

```text
IQ → lossy sketch lanes → candidate → Quisk suggestion → clean verifier required
```

It does not prove ML quality, broad RF generality, or live Quisk integration yet. Those are the next bounded feature-plan choices.
