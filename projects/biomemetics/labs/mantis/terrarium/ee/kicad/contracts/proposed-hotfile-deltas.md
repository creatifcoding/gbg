# Proposed hot-file deltas (not applied)

Issue 23 must not rewrite `BOM.md`, `params.json`, `bus.json`,
`workstreams.json`, `kicad/system`, or CAD assembly.

## `terrarium/bus.json`

Conflict: `cameraPath` lists `MAX96717` / `MAX96724`. Lab `SOURCES.md` and
`KICAD-PLAN.md` list `MAX96717` / `MAX96724`. Leave both UNVERIFIED until
the root picks a family. Do not invent a suffix.

## `terrarium/BOM.md`

No MPN fills for B27, B36, B45, B46, B48, B50. Keep UNVERIFIED.

## `terrarium/params.json`

Rail pitch 2.54 mm and land 1.5 mm remain `target`. Library footprints use
those values as TARGET geometry only.

## Evidence path

Theoretical pin-pad audit lives at
`terrarium/ee/kicad/libs/audit-report.json` because `evidence/runs/` is
outside this write set. Root may copy it after #21/#22 land.
