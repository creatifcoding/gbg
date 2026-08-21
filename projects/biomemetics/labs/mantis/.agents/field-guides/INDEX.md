# Field-guide index (generated; keep ≤200 lines)

| Issue | Workstream | Guide |
| ---: | --- | --- |
| 15 | mantis-00-workspace | [issue-15.md](issue-15.md) |
| 16 | mantis-01-specimendb-bridge | [issue-16.md](issue-16.md) |
| 19 | mantis-04-observation-pipeline | [issue-19.md](issue-19.md) |
| 21 | mantis-00a-runtime | [issue-21.md](issue-21.md) |
| 22 | mantis-00b-control-plane | [issue-22.md](issue-22.md) |
| 23 | mantis-ee-01 | [issue-23.md](issue-23.md) |
| 24 | mantis-ee-02 | [issue-24.md](issue-24.md) |
| 25 | mantis-ee-03 | [issue-25.md](issue-25.md) |
| 26 | mantis-ee-04 | [issue-26.md](issue-26.md) |
| 27 | mantis-ee-05 | [issue-27.md](issue-27.md) |
| 28 | mantis-cad-01 | [issue-28.md](issue-28.md) |
| 29 | mantis-cad-02 | [issue-29.md](issue-29.md) |
| 30 | mantis-05-integration | [issue-30.md](issue-30.md) |
| 31 | mantis-06-release | [issue-31.md](issue-31.md) |

Surprising facts shared by leaves:

- `terrarium/MANIFEST.sha256` is an immutable baseline; verifiers never regenerate it.
- Hot files (`BOM.md`, `params.json`, `bus.json`, `workstreams.json`, system KiCad, CAD assembly) are integration-owned; emit proposed deltas only.
- SpecimenDB attach is blocked until gbg#16 after PR 12; records stay local under `evidence/runs/...`.
- Raw MIPI stays binder/compute-local; complete hop order lives in `contracts/interfaces.json`.
- Grok-only Cursor policy: no Sol/Auto/Fast.
