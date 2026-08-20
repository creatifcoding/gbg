# Mantis EE-03 camera-tx (issue 25)

Theoretical / `UNVERIFIED`. Not a shop release.

Tracks #25 only. Does not implement #18. Does not touch PR 12. Does not rewrite
the #23 library or #24 power-control.

## Locks

- Untethered. No trailing cable.
- Raw MIPI is local to IMX519 and MAX96717.
- Serialized GMSL only on B50 C09–C12 (HSGND, GMSL+, GMSL-, HSGND).
- Video-while-rolling is out of v1.
- IMX519 SKU, MAX96717 suffix/pad map, and B50 series remain UNVERIFIED.

Regenerate:

```text
python3 ../../../simulations/electrical/channel/tools/generate_kicad.py
```
