# @tmnl/specimendb

DuckDB plus Effect v4 RPC for filed specimens. The entity is a branded `SpecimenId`. Components attach over time. This is not a Card row and not tmnl's Effect v3 IIoT plant graph.

The ask was `@gbg/specimendb`. Effect v4 libs in this repo are `@tmnl/*` (`@tmnl/msh`, `@tmnl/lnk`, `@tmnl/pct`). The nx generator scaffolds the same. So this package is `@tmnl/specimendb`.

`packages/tmnl` stays on Effect 3.21.2. This package does not depend on it. RPC shape is mined from iiot (`Rpc.make`, `RpcGroup`, branded ids, tagged errors, schemas → repos) and implemented with `effect/unstable/rpc` on `effect@4.0.0-beta.93`, same pin as msh. House imports are bare `effect/*`. The nx `effect-v4-lib` generator still pins beta.23 and the retired `effect-v4` alias; ignore that.

V.A.L. owns a real DuckDB binding. Sheldon owns the RPC contract. Neither has landed in this repo yet, so the driver sits behind `DuckDbBinding`. Tests use the memory driver. `@duckdb/node-api` is optional and swaps in when it installs.

## ECS

- Entity: `SpecimenId`
- Required at birth: Status(`raw`)
- Optional: Claim, Media, Exif, Locality, Taxon, Structure, Mechanism, Function, AnalogLink, Tag, Question, Observation
- Systems: Intake, Capture, File, Identify (later), Relate

Intake eats a file. Pictures need the bytes. `exiftool -j -n -a` writes the sidecar, `exifr` is the fallback. Locality attaches only when `GPSLatitude` and `GPSLongitude` exist. Missing GPS is not stored as `{ _tag: 'unknown' }`. No IP geo, no `cf-ipcountry`, no geocoding.

## RPC

```
Intake.File
Specimen.Get
Specimen.List
Specimen.Promote
```

Errors: `IntakeError`, `AssetExistsError`, `SpecimenNotFound`, `DuckDbError`, `SpecimenTransitionError`.

## Run

```bash
cd packages/specimendb
bun install
bun run typecheck
bun run test:run
```

Capture page (static Cloudflare Drop folder):

```bash
bun run capture:zip
```

Then drop `capture/` or `specimendb-capture.zip` on https://www.cloudflare.com/drop/.

## Seeds

`20260819-001` field catch JPEG, EXIF already stripped, original not in this clone.
`20260819-002` Apple TextKit emoji HEIC, no GPS, original not in this clone.

The TanStack Start UI still lives in `@gbg/catalog`. Domain, DuckDB, and RPC live here.
