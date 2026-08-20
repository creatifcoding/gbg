# Mantis EE-04 characterization fixture (issue 26)

Theoretical / `PROTO-FAB DRAFT` / **UNQUALIFIED**. Not a shop release.

`LAB COUPON — CONCEPT VALIDATION — NOT FOR ANIMAL USE`

Tracks #26 only. Does not implement #18. Does not touch PR 12. Does not rewrite
the #23 library, #24 power-control, or #25 camera-tx / carriage / rail-rx.
Those leaves are unadmitted and consumed read-only.

## Locks

- Untethered. No trailing cable.
- Raw MIPI is local to SerDes courtyard envelopes. It is not on B50/B27/B19.
- Serialized GMSL only on C09–C12 / P09–P12 (HSGND, GMSL+, GMSL−, HSGND).
- Video-while-rolling is out of v1.
- P08 is diagnostic only.
- No invented MPNs. Missing parts stay `UNVERIFIED` and DNP.
- This coupon does not claim measured SI or PI.
- Human approval is required before ordering, assembly, energization, fault
  injection, or ESD testing.

## Complete coupon (not a decorative subset)

| Sheet | Structure |
| --- | --- |
| `01-cal-2xthru-osl` | 2x-thru B50, 2x-thru B27, open/short/load |
| `02-ser-launch-refplane` | MAX96717 courtyard refplane + B50 launch |
| `03-b50-only` | keyed B50 plug/receptacle, full 12-net |
| `04-carriage-route` | B50 → B27 carriage route, adjacent P01–P08 |
| `05-b27-b19` | B27 + B19 lands, compression note, P09/P12 returns |
| `06-rx-launch-refplane` | MAX96724 courtyard refplane + indexed B27 |
| `07-full-channel` | ser → B50 → carriage → B27 → B19 → rx |
| `08-power-s1s2q1-fault` | AON, S1/S2, Q1A/Q1B, discharge, ISO, probes, faults |

Active-device channel pins are replaced by courtyard reference planes because
the #23 pad maps are UNVERIFIED. Intervening 12-net geometry is not simplified.

## Regenerate

```text
python3 tools/generate_project.py
python3 tools/check_locks.py
```

`kicad-cli` is absent in this runtime. ERC/DRC/Gerber are listed waivers, same
gap as EE-01/EE-02/EE-03. Jobsets live under `ee/fab/prototype/jobsets/` and
are planning-only until a pinned KiCad/fabricator path exists.
