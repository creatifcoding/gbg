# FRKNK

FRKNK is the SDR foundation package for the GBG/TMNL ecosystem.

It owns the Quisk/Hermes-facing SDR domain work while keeping TMNL as a cockpit/UI
consumer instead of a junk drawer. Python handles RF experiments and protocol
emulation; TypeScript handles contracts, validation, and future TMNL state/UI
integration.

## Shape

```text
packages/frknk/
├── flake.nix                 # package-local Nix entrypoint
├── nix/                      # reproducible dev shells + mission-control commands
├── src/                      # TypeScript contract / TMNL integration surface
├── test/                     # TypeScript tests
└── experiments/
    └── sdr-lab/              # Python SDR proving ground
```

## Language boundaries

| Layer | Language | Job |
| --- | --- | --- |
| SDR lab | Python | IQ fixtures, sketches, emulator, ML prototypes |
| Native DSP | C/C++ later | hot kernels / Quisk extension interop only when earned |
| TMNL integration | TypeScript + Effect Schema | contracts, validation, STX-backed state, UI bridge |
| Hardware gateware | Verilog later | Hermes-Lite FPGA changes |
| Control surface | ESP-IDF C/C++ later | ESP32 knobs/PTT/display/control plane |

## First contract pipeline

```text
SignalSketchFrame → SignalCandidate → QuiskSuggestion
```

These are suggestions, not truth. Clean Quisk/Hermes DSP verifies before any
operator-facing claim becomes trusted.

## Dev shell

```bash
cd packages/frknk
nix develop
frknk info
```

Useful commands inside the shell:

```bash
frknk py-sync
frknk py-test
frknk py-lint
frknk sdr-smoke
frknk hermes-emulator --host 127.0.0.1 --port 1024 --verbose
quisk -c "$FRKNK_QUISK_CONF"
```

TypeScript package checks:

```bash
bun run typecheck
bun run test:run
```

Python SDR lab checks:

```bash
cd experiments/sdr-lab
uv sync
uv run --extra dev pytest
uv run sdr-lab smoke
uv run sdr-lab hermes-emulator --help
```

## Design stance

- Quisk is the cockpit seat.
- FRKNK is the SDR domain package/platform.
- TMNL consumes FRKNK contracts/state when cockpit integration begins.
- Lossy RF sketches expose invariants and emit candidates; they do not replace demodulation.
