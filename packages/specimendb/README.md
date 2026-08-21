# @tmnl/specimendb

Experimental. ECS catalog: branded `EntityRef` rows in `entities` (specimen is a common `kind`, not the only type) plus optional TaggedClass components. Persisted in Postgres and exposed as Effect v4 `Rpc.make` / `RpcGroup` procedures. Intake mints a specimen entity, attaches what arrived in the JPEG/EXIF, and returns `SpecimenId`.

Understanding is attaching components later. A JPEG or HEIC with no GPS still files as Status `raw`. Locality is attached as `unknown` unless EXIF GPS or capture-page geo actually arrived. Sidecar JSON is always written next to the original. Taxon is never invented.

## RPC

| Tag | What |
|---|---|
| `Intake` | Copy the original file into catalog assets, extract EXIF sidecar tags, attach whatever arrived. Raw is enough. |
| `Get` | Fetch one specimen by `SpecimenId`. |
| `List` | List specimens. No required filters. |
| `Promote` | Write Status one step: `raw → filed → working → dead`. Dead stays dead. Works on any entity that has a Status component. |

## Components

None are required at birth. Intake attaches Status (`raw`), Media, Exif (sidecar always), and Locality (`unknown` or `fixed`). Locality is `fixed` only when GPS exists in EXIF or an explicit capture-page geo payload is supplied. Otherwise it says unknown. It does not invent a place.

Optional later: Claim, Taxon, Structure / Mechanism / Function, AnalogLink, Tag, Question, Observation, Kind, Class, Provenance, W7, Used, Generated.

## Surfaces

Compound React components in [`src/ui/`](./src/ui/), driven by `@tmnl/stx`. Journal: [`docs/functionalization-journal.md`](./docs/functionalization-journal.md). Specimen is the only type.

| Route | Component | Page |
|---|---|---|
| `/intake` | `IntakeDrop` | Terminal |
| `/rail` | `SpecimenRail` | Workbench |
| `/assay` | `WorkingPanel` | Assay |
| `/dactyl` | `AnalogCard` | Dactyl card grid (template, not a type) |
| `/catalog` | `AppShell` | Catalog |
| `/accession` | `DossierView` | Accession dossier |

Now-rows on every page: Intake, List, Get on select, Status, Claim, Media bytes where that page owns the well, locality `unknown` unless EXIF GPS. Empty card/dossier chrome stays.

Locality is the word `unknown` unless the file actually had EXIF GPS. The UI does not invent coordinates, elevation, temperature, taxon, ML confidence, or accession strings.

Status pills: `raw` amber, `filed` cyan, `working` emerald, `dead` rose. Assay uses `#f59e0b` / `#06b6d4` / `#10b981` / `#f43f5e`. Machine is `raw → filed → working → dead`. Clicking a real card's status chrome calls Promote. Empty card chrome does not.

## Testbed

In-memory Intake/Get/List/Promote client (same EXIF/locality rules, no Postgres in the Vite process):

```sh
cd packages/specimendb
bun run testbed
```

Opens Vite at `https://localhost:4177` (self-signed). Routes: `/intake`, `/rail`, `/assay`, `/dactyl`, `/catalog`, `/accession`. Phone capture is static at `/capture/` — it is not the React SPA and does not call Intake. Drop a JPEG onto an intake zone. A file without GPS should show `raw` and `unknown`.

## Field capture

Static page in [`capture/`](./capture/), also served at `/capture/` on the testbed (HTTPS). Stamp GPS + DateTimeOriginal into a JPEG in the browser and download `specimen-YYYYMMDD-HHmmss.jpg`. Denied geo → locality unknown; GPS is not invented. The photo never uploads. Zip or drag that folder onto [Cloudflare Drop](https://www.cloudflare.com/drop/). It is not wired to Postgres or RPC.

## Persistence

Effect models (`EntityModel`, `ComponentModel`) plus co-located `.ddl.ts`, aggregated with `Migrator.fromRecord`. Tables:

| Table | Identity | Notes |
|---|---|---|
| `entities` | `id` = `EntityRef` (`gbg:<kind>:<local>@<rev>?`) | `kind` is a column (and a Kind component later). Specimen and activity are both rows here. No `lab_activities`. |
| `components` | `entity_id` → `entities.id` | TaggedClass payload jsonb. Intake writes Status / Media / Exif / Locality (and Claim if present). Kind / Class / Provenance / W7 / Used / Generated attach later. No `edges` table — Used/Generated are components. |

## Versions

Effect pin matches `@tmnl/msh`: `effect@4.0.0-beta.93`. Persistence is `@effect/sql-pg@4.0.0-beta.93` (peers that pin). Do not take `@effect/sql-pglite@4.0.0-beta.107`. The repo talks `SqlClient`. L1 is Postgres. There is no DuckDB driver and no `@effect/sql-duckdb`. Intake/Get/List tests need a Postgres connection (`SPECIMENDB_PG_*`, default `127.0.0.1:5434`). Memory RPC testbed stays in-memory. Capture does not talk to PG.
