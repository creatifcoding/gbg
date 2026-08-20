# Mantis EE-01 native KiCad library

Issue 23. Theoretical. Not a shop release.

Native KiCad in this directory is electrical authority for the sourced
interfaces. The SVG sheet is not.

## Layout

- `symbols/mantis-ee.kicad_sym`
- `footprints/mantis-ee.pretty/`
- `models/` empty on purpose (no vendor STEP retrieved)
- `sources.lock.json`
- `pin-pad-audit.json`
- `tools/generate_library.py` regenerates symbols and footprints
- `tools/audit_library.py` checks pin number == pad

## What is sourced

TCA9548A PW and RGE pin maps from TI SCPS207H. Tachyon CSI1 and DSI/CSI2
pinouts from Particle V1.2 photographs. B27/B50 net names from `bus.json`.
Qwiic net order from SparkFun; cable housing SHR-04V-S.

## What is UNVERIFIED

Camera module SKU, SerDes suffix and pad map, B27/B50 series, S1/S2/Q1,
Qwiic header MPN, CSI connector MPN, 3D models.

Regenerate:

```text
python3 tools/generate_library.py
python3 tools/audit_library.py
```
