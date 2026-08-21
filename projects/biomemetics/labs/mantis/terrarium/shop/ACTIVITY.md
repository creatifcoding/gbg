# DRAFT shop pack — activity and blockers

Recorded 2026-08-21. Maturity **DRAFT**. SHOP-RELEASE is not claimed.
QUALIFIED is not claimed. No order. No energize.

## Stack

| Step | Ref | Result |
| --- | --- | --- |
| CAD-01 STEP | PR 34 / #28 @ `fe8f875a` | Already merged to `feat/mantis-biomemetics-lab` (#34 → #20). Honesty: **draft-measured**. |
| CAD-02 carriage | PR 36 / #29 | Already merged to lab. Python/CSG only on merge; **theoretical/UNVERIFIED**. B27/B50 proxies. Does **not** admit PR 34 STEP as a released parent. |
| Theoretical sheets | PR 45 / #41 | Closed on deleted CAD-02 base. Branch `cursor/mantis-schematics-s00-s11-0b50` still present. |
| Projected sheets | PR 58 | Already merged into PR 45 (`ce04b6a1`). S00–S06/S10 projected; S08/S09 diagrams. |
| This pack | stacked onto lab @ `6feb3a4a` | Merge of 45/58 into `feat/mantis-biomemetics-lab` was clean, then restacked after lab absorbed master. CAD-01 STEP blobs unchanged. Carriage/binder STEP taken from existing PR 58 OCCT exports. |

PR 57 (Nix runtime) stays unmerged: nested-lab CI is red. No DuckDB. No second
catalog. SpecimenDB look was not restyled.

## Tooling

| Tool | This environment |
| --- | --- |
| FreeCADCmd | **Absent** (blocker). Did not fake solids. Did not re-export STEP. |
| cadquery-ocp / OCP | Absent here. Not required to hash existing files. PR 58 already wrote carriage STEP with OCP HLRBRep when FreeCADCmd was missing. |
| Inkscape | Not invoked. HITL PNGs and the PDF were not regenerated. |

## UNVERIFIED / still missing

- B27/B50 contact series and pinout
- Camera module SKU
- S1/S2/Q1 manufacturer parts (#24 unmet)
- Carriage/binder binary STL (STEP exists; STL was not emitted)
- Complete DXF/kerf cut set (only B05/B06 CAD-01 profiles)
- Native KiCad boards / ERC/DRC/DFM
- First-article fabricate → measure → redline loop
- Husbandry/wet/escape/channel qualification evidence
- Independent admission of a new `terrarium/MANIFEST.sha256` baseline

`terrarium/MANIFEST.sha256` remains the immutable draft-B baseline. Stacked
sheet hashes do not match it. This pack does not rewrite that file.

## Forbidden actions not taken

No pinout invented. No SKU invented. No GPS invented. No SHOP-RELEASE label.
No QUALIFIED label. No order. No energize.
