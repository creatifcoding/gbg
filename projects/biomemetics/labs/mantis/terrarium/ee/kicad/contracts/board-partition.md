# Board partition (EE-01 proposal)

Issue 23 does not own native board projects. This is the partition later
leaves should follow. Native KiCad, not the SVG sheet, is electrical authority.

## Proposed boards

| Board | Owns | Does not own |
| --- | --- | --- |
| camera-tx | IMX519 local CSI, MAX96717, B50 camera-side launch | rail, Tachyon |
| carriage | B27 springs, B50 receptacle, S1, S2, Q1, local supervisor | animal-side metal |
| rail-rx | B19 dock, MAX96724, short CSI to Tachyon CSI1 | binder mechanics |
| power-control | S1/S2/Q1 truth table (issue 24) | SerDes channel (issue 25) |

## Interface pins that must match `ee-interface-v1.json`

P01-P12 and C01-C12. A checker belongs in a later leaf; this library only
defines the nets.

## Source conflict (do not resolve here)

`bus.json` cameraPath still says MAX96717/MAX96724. `SOURCES.md` and
`KICAD-PLAN.md` on this SHA say MAX96717/MAX96724. EE-01 does not pick.
See `proposed-hotfile-deltas.md`.
