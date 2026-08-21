# Mantis EE-03 GMSL channel (issue 25)

Theoretical / `UNVERIFIED`. Not a shop release. Simulation screens; it does not
qualify hardware.

Tracks #25 only. Does not implement #18. Does not touch PR 12. Does not rewrite
the #23 library or #24 power-control. #23 is unadmitted: IMX519 SKU, SerDes
suffix/pad map, and B27/B50 series stay UNVERIFIED envelopes. No MPNs are invented.

## Locks

- Untethered carriage. No trailing power or video cable.
- Raw MIPI stays at the camera serializer and at Tachyon CSI1.
- Serialized video on B27 P09–P12 / B50 C09–C12 only (HSGND, GMSL+, GMSL−, HSGND).
- Video-while-rolling is out of v1.
- P08 is diagnostic only.
- This cascade does not mark the physical interface qualified.

## Boards (generated)

| Project | Owns |
| --- | --- |
| `ee/kicad/camera-tx` | IMX519 local CSI, MAX96717, B50 launch |
| `ee/kicad/carriage` | B50↔B27 12-net, GMSL cell, S1/S2/Q1 placement consuming #24 |
| `ee/kicad/rail-rx` | Indexed B27, MAX96724, short CSI to Tachyon CSI1 |

Regenerate:

```text
python3 tools/generate_kicad.py
python3 tools/run_channel.py
python3 tools/check_locks.py
```

`kicad-cli` is absent here. ERC is a listed waiver, same gap as EE-01/EE-02.
Field solver is blocked: no contact series, no vendor Touchstone, #28/#29 STEP
is draft/read-only, Nix path not qualified this run.
