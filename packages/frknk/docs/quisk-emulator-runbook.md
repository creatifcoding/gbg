# Quisk → FRKNK Fake Hermes Runbook

This runbook starts the first receive-only fake Hermes-Lite/OpenHPSDR radio and points
Quisk at it.

## Status

The emulator implements enough protocol for cycle 1:

- Metis discovery request/reply;
- start/stop commands;
- PC→Hermes control packet parsing for sample rate, receiver count, RX/TX frequency, LNA;
- endpoint `0x06` RX IQ frames with deterministic synthetic tone;
- no TX RF, no QSK, no PA behavior.

## Start emulator

From the package-local Nix shell:

```bash
cd packages/frknk
nix develop .#frknk-sdr
frknk hermes-emulator --host 127.0.0.1 --port 1024 --sample-rate-hz 48000 \
  --center-frequency-hz 7100000 --tone-offset-hz 1200 --amplitude 0.2 --verbose
```

Direct Python equivalent:

```bash
cd packages/frknk/experiments/sdr-lab
uv run sdr-lab hermes-emulator --host 127.0.0.1 --port 1024 --verbose
```

On NixOS, run inside the `frknk-sdr`/`frknk-python` shell so NumPy can find native
C-extension libraries.

## Quisk config target

Use the checked-in local config:

```text
packages/frknk/experiments/sdr-lab/quisk/frknk_quisk_conf.py
```

Launch Quisk from the FRKNK SDR shell:

```bash
cd packages/frknk
nix develop .#frknk-sdr
quisk -c "$FRKNK_QUISK_CONF"
```

If you are using an external Quisk checkout/install, pass the same config path with `-c`.

The important current-Quisk local settings are:

```python
hardware_file_type = "Hermes"
use_rx_udp = 10
rx_udp_port = 1024
udp_rx_ip = "127.0.0.1"
rx_udp_ip = ""           # do not request hardware IP reprogramming
hermes_board_id = 0x06
```

Current Quisk uses `udp_rx_ip` as a known Hermes address and sends discovery directly there.
Older Quisk used `rx_udp_ip` plus a netmask-derived broadcast address; that path is kept out of
the default config because the packaged Python-3 Quisk is the execution target.

## Expected behavior

1. Quisk sends discovery: `EF FE 02 ...`.
2. Emulator replies as board `0x06` with a deterministic MAC.
3. Quisk opens UDP capture and sends stop/start/control packets.
4. Emulator streams 1032-byte endpoint-6 frames.
5. Quisk waterfall should show a carrier at `center + toneOffset`.

## Safety boundaries

- Receive-only.
- TX/control packets are parsed and logged in state, not transmitted as RF.
- PTT/MOX does not create RF output.
- This is a fake radio for software integration, not hardware control.

## Grounding evidence

- DeepWiki was attempted first for `df8oe/quisk` and `softerhardware/Hermes-Lite2`; both were not indexed.
- Quisk primary/source references:
  - Nixpkgs package: `quisk-4.2.x` for actual local execution.
  - `/tmp/quisk-research/quisk/hermes/quisk_hardware.py`
  - `/tmp/quisk-research/quisk/quisk.c`
  - `/tmp/quisk-research/quisk/microphone.c`
- Observed caveat: the `/tmp/quisk-research` checkout includes an old bundled `_quisk.so`
  that fails on Python 3 with `undefined symbol: PyString_AsString`; use current packaged
  Quisk for execution, and treat the checkout as protocol/source reference unless rebuilt.
- Hermes-Lite2 protocol wiki:
  - `https://github.com/softerhardware/Hermes-Lite2/wiki/Protocol`
- Reference emulator:
  - `https://gist.github.com/hotpaw2/5e75e19ecd1fb2d43d6f8f6f44bd2611`
