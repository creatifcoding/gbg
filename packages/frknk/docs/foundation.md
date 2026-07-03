# FRKNK Foundation Decision

## Decision

FRKNK is a polyglot package rooted at `packages/frknk`.

- **Python** is the primary SDR lab/runtime language.
- **TypeScript + Effect Schema** is the contract and TMNL integration surface.
- **Nix** owns reproducible shells and mission-control commands.

## Why Python first

The first practical work is IQ handling, synthetic fixture generation, UDP protocol
experiments, waterfall/sketch transforms, and eventual RFML. That world is Python-first:
NumPy, SciPy, PyTorch, TorchSig, GNU Radio bindings, and Quisk's own Python cockpit all
make Python the lowest-friction proving ground.

## Why TypeScript still matters

TMNL integration needs stable contracts, reactive state, and UI-facing streams. FRKNK's
TypeScript package exports the canonical message schemas:

```text
SignalSketchFrame → SignalCandidate → QuiskSuggestion
```

Future TMNL panels should consume these through `@gbg/frknk`, with STX as the canonical
state pattern for reactive candidate/suggestion streams.

## Boundary table

| Concern | Runtime | Notes |
| --- | --- | --- |
| IQ fixtures/sketches | Python | `experiments/sdr-lab` |
| Fake Hermes/OpenHPSDR radio | Python | UDP/server work after Quisk packet extraction |
| Contract validation | TypeScript Effect Schema + Python Pydantic | Both mirror the same JSON envelope |
| TMNL state/UI | TypeScript + STX | Consumer of `@gbg/frknk`, not owner of SDR domain |
| Hot DSP | C/C++ later | Only after a measured bottleneck |
| FPGA | Verilog later | Hermes-Lite gateware, not cycle 1 |
| ESP32 | ESP-IDF C/C++ later | Control-plane first, no raw RF burden |

## Non-goals for cycle 1

- No TX/QSK.
- No raw ESP32 IQ.
- No hardware hot path.
- No ML authority over tuning/transmit.
- No replacing Quisk demodulation with sketch output.

The sketch sidecar says: **look here**. Quisk/Hermes clean DSP decides whether the signal
is real.
