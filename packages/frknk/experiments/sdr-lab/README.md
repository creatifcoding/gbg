# SDR Lab

Python proving ground for FRKNK.

Cycle 1 goals:

1. Generate deterministic synthetic IQ fixtures.
2. Produce lossy sketch frames.
3. Emit candidate boxes and Quisk suggestions.
4. Keep clean Quisk/Hermes DSP as verifier.
5. Extract the OpenHPSDR/Hermes emulator seam after contracts stabilize.

## Quick start

```bash
cd packages/frknk
nix develop .#frknk-sdr
frknk py-sync
frknk sdr-smoke
```

Or directly:

```bash
cd packages/frknk/experiments/sdr-lab
uv sync
uv run --extra dev pytest
uv run sdr-lab smoke
uv run sdr-lab sketch-demo --output-dir reports/sketch-demo
uv run sdr-lab hermes-emulator --help
uv run sdr-lab hermes-emulator --host 127.0.0.1 --port 1024 --verbose
```

A directed-local Quisk config lives at:

```text
quisk/frknk_quisk_conf.py
```

Inside `nix develop .#frknk-sdr`, run packaged Quisk with:

```bash
quisk -c "$FRKNK_QUISK_CONF"
```

## Package layout

```text
src/sdr_lab/
├── contracts.py       # Pydantic mirror of @gbg/frknk Effect Schema contracts
├── cli.py             # smoke/demo/emulator entrypoints
├── locator.py         # pure fixture → lanes → candidate → suggestion pipeline
├── iq/                # deterministic IQ fixtures
├── sketches/          # destructive / invariant-exposure sketch lanes
└── openhpsdr/         # fake Hermes/OpenHPSDR radio seam + emulator
```

## Current smoke lane

The first smoke pipeline is intentionally primitive:

```text
synthetic noise + weak tone
  ├→ low-res waterfall
  └→ one-bit IQ → low-res waterfall
  → strongest median-power bin + lane evidence
  → SignalCandidate
  → QuiskSuggestion(requiresVerification=true)
```

Yes, it is baby SDR. That is the point. First make the seam honest; then make it dangerous.

See also: `../../docs/lossy-sketch-locator-pipeline.md`.
