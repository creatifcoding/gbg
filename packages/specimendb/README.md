# @tmnl/specimendb

Experimental. ECS specimen catalog: a branded `SpecimenId` entity plus optional components, persisted in PGlite and exposed as Effect v4 `Rpc.make` / `RpcGroup` procedures.

Understanding is attaching components later. A JPEG or HEIC with no GPS still files as Status `raw`. Locality and taxon are never invented.

## RPC

| Tag | What |
|---|---|
| `Intake` | Copy the original file into catalog assets, extract EXIF sidecar tags, attach whatever arrived. Raw is enough. |
| `Get` | Fetch one specimen by `SpecimenId`. |
| `List` | List specimens. No required filters. |

## Components

None are required at birth. Intake attaches Status (`raw`), Media, and Exif tags that arrived. Locality is attached only when GPS exists in EXIF or an explicit capture-page geo payload is supplied.

Optional later: Claim, Taxon, Structure / Mechanism / Function, AnalogLink, Tag, Question, Observation.

## Field capture

Static page in [`capture/`](./capture/): stamp GPS + DateTimeOriginal into a JPEG in the browser and download it. Zip or drag that folder onto [Cloudflare Drop](https://www.cloudflare.com/drop/). It is not wired to PGlite or RPC.

## Versions

Effect pin matches `@tmnl/msh`: `effect@4.0.0-beta.93`. Persistence is `@effect/sql-pglite@4.0.0-beta.93` (peers that pin) plus `@electric-sql/pglite@0.4.5`. The repo talks `SqlClient`. L1 is PGlite. There is no DuckDB driver and no `@effect/sql-duckdb`.
