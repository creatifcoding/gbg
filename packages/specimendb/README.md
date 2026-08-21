# @tmnl/specimendb

Experimental. ECS specimen catalog: a branded `SpecimenId` entity plus optional components, persisted in Postgres and exposed as Effect v4 `Rpc.make` / `RpcGroup` procedures.

Understanding is attaching components later. A JPEG or HEIC with no GPS still files as Status `raw`. Locality is attached as `unknown` unless EXIF GPS or capture-page geo actually arrived. Sidecar JSON is always written next to the original. Taxon is never invented.

## RPC

| Tag | What |
|---|---|
| `Intake` | Copy the original file into catalog assets, extract EXIF sidecar tags, attach whatever arrived. Raw is enough. |
| `Get` | Fetch one specimen by `SpecimenId`. |
| `List` | List specimens. No required filters. |
| `Promote` | Write Status one step: `raw → filed → working → dead`. Dead stays dead. Same Specimen type. |
| `AppendActivity` | Append a `kind=activity` LabEntity (W7 required). Same Postgres. No UPDATE of who/when. Corrections are a new ref that `supersedes`. |
| `GetByRef` | Activities where the ref is the activity, a used entity, a generated entity, or the row being superseded. Empty list if none. |

## Components

None are required at birth. Intake attaches Status (`raw`), Media, Exif (sidecar always), and Locality (`unknown` or `fixed`). Locality is `fixed` only when GPS exists in EXIF or an explicit capture-page geo payload is supplied. Otherwise it says unknown. It does not invent a place.

Optional later: Claim, Taxon, Structure / Mechanism / Function, AnalogLink, Tag, Question, Observation.

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

In-memory Intake/Get/List/Promote client (same EXIF/locality rules, no PGlite rewrite):

```sh
cd packages/specimendb
bun run testbed
```

Opens Vite at `https://localhost:4177` (self-signed). Routes: `/intake`, `/rail`, `/assay`, `/dactyl`, `/catalog`, `/accession`. Phone capture is static at `/capture/` — it is not the React SPA and does not call Intake. Drop a JPEG onto an intake zone. A file without GPS should show `raw` and `unknown`.

## Field capture

Static page in [`capture/`](./capture/), also served at `/capture/` on the testbed (HTTPS). Stamp GPS + DateTimeOriginal into a JPEG in the browser and download `specimen-YYYYMMDD-HHmmss.jpg`. Denied geo → locality unknown; GPS is not invented. The photo never uploads. Zip or drag that folder onto [Cloudflare Drop](https://www.cloudflare.com/drop/). It is not wired to PGlite or RPC.

## Versions

Effect pin matches `@tmnl/msh`: `effect@4.0.0-beta.93`. Persistence is `@effect/sql-pg@4.0.0-beta.93` (peers that pin). Do not take `@effect/sql-pglite`. Do not add DuckDB. The repo talks `SqlClient`. L1 is Postgres. There is no second catalog.

Activity log tables (`lab_activities`, `lab_used`, `lab_generated`) live in that same catalog. They are append-only.

Catalog tests talk to Postgres (`SPECIMENDB_PG_URL`, default `postgres://specimendb:specimendb@127.0.0.1:5433/specimendb`). Compose is a copy of the tmnl iiot lite rig at [`docker/docker-compose.yml`](./docker/docker-compose.yml) (Timescale HA + AGE, host port 5433, data dir `/home/postgres/pgdata/data`). The Vite testbed stays in-memory. Capture still does not talk to the database.
