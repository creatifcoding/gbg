# Mantis EE-02 power-control (issue 24)

Theoretical / `UNVERIFIED`. Not a shop release. ngspice screens; it does not
qualify hardware.

Tracks #24 only. Does not implement #18. Does not touch PR 12. Does not rewrite
the #23 library, contracts, or requirements. #23 is unadmitted: S1, S2, Q1,
B27, and B50 stay UNVERIFIED envelopes. No MPNs are invented.

## Hardware locks

- Q1 turns on only when S1 and S2 are both closed, remate is not pending, the
  OC latch is clear, and VIN is above the UVLO sweep.
- P08 / UID / I2C / firmware cannot force Q1 on.
- S1 opening forces Q1 off, discharge, and low-speed isolation before B27
  contacts lift (break-before-move).
- S2 opening does the same before B50 contacts move (break-before-binder-release).
- Raw MIPI is not on P01–P12 or C01–C12. P10/P11 are GMSL and belong to #25.

## Layout

- `power-control.kicad_pro` / `.kicad_sch` — root
- `sheets/01-source-b27-b50.kicad_sch` — F1, P01/P02 share, P03/P04 return, B27/B50
- `sheets/02-s1-s2-q1.kicad_sch` — S1 series S2, Q1A/Q1B, discharge
- `sheets/03-lowspeed-iso-p08.kicad_sch` — SDA/SCL/UID/P08 isolation; P08 diagnostic
- `sheets/04-esd-sense-tp.kicad_sch` — TVS envelopes, sense, test points
- `net-map.json` — bus.json states to circuit nodes
- `erc-waivers.md`, `fuse-coordination.md`, `bench-protocol.md`
- `tools/generate_project.py` — regenerates this project from the #23 library

Companion screening: `terrarium/simulations/electrical/power-control/`.

Regenerate:

```text
python3 tools/generate_project.py
```
