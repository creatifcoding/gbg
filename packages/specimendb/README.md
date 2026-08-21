# @tmnl/specimendb

Experimental. ECS specimen catalog: a branded `SpecimenId` entity plus optional components, persisted in Postgres (`@effect/sql-pg`) and exposed as Effect v4 `Rpc.make` / `RpcGroup` procedures. Intake / Promote keep the eat-file loop. Extra systems (Export / Project / Doctor / AppendActivity) live in the same RpcGroup.

Understanding is attaching components later. A JPEG or HEIC with no GPS still files as Status `raw`. Locality is attached as `unknown` unless EXIF GPS or capture-page geo actually arrived. Sidecar JSON is always written next to the original. Taxon is never invented.

## RPC

| Tag | What |
|---|---|
| `Intake` | Mint a specimen entity, copy the original file into catalog assets, extract EXIF sidecar tags, attach whatever arrived. Raw is enough. |
| `Get` | Fetch one specimen by `SpecimenId`. |
| `List` | List specimen entities. No required filters. |
| `Promote` | Write Status one step: `raw → filed → working → dead`. Dead stays dead. Same Specimen type. |
| `Export` | Mint `kind=activity` and attach Used / Generated components. |
| `Project` | Same system for HLR: Used(step) Generated(svgs/sheets). |
| `Doctor` | Mint an activity for a run; Generated defaults to the run. |
| `AppendActivity` | Append-only activity: refuse to rewrite a ref; corrections append a new one with Supersedes. |
| `GetByRef` | Activities whose id, Used, Generated, or Supersedes target matches. |
| `GetEntity` / `ListEntities` / `GetComponents` | Read an entity and the components keyed by `entity_id`. |
| `Attach` | Attach one component to an existing entity. |
| `MintEntity` | Mint a catalog entity and attach the components the caller walked. Seed uses this. |
| `MintActivity` | Mint an entity with `Kind=activity` and Used / Generated components. |

## Components

None are required at birth. Intake attaches Kind (`specimen`), Status (`raw`), Media, Exif (sidecar always), and Locality (`unknown` or `fixed`). Locality is `fixed` only when GPS exists in EXIF or an explicit capture-page geo payload is supplied. Otherwise it says unknown. It does not invent a place.

Optional later: Type (kind-local discriminator, also a column), Claim, Honesty, Bytes, Taxon, Structure / Mechanism / Function, AnalogLink, Tag, Question, Observation. Kind + Type are declaration. Honesty / Used / Generated attach when a system actually ran. Bytes cites path + sha256 + git SHA; lab seed does not copy STEP/SVG into specimen AssetStore.

Relationships are components a system walks (`Used`, `Generated`, `Supersedes`, …), each holding a target `EntityRef`. There is no edges table.

Lab seed (not a specimen): mint in-tree solids, sheets, reports, contracts, and catalogs as kind + type. Assembly STEP is `type=assembly`; part STEPs are `type=part`. Sheets are `type=projected` or `type=diagram` (S08/S09 diagram; honesty is not attached). The HLR activity (`type=hlr`) Uses the CAD-01 STEP and Generates S00–S11. who/how is `generate_schematics.py`, where is `unknown`, why is `#58`. No GPS, taxon, or SKU.

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

## Versions

Effect pin matches `@tmnl/msh`: `effect@4.0.0-beta.93`. Persistence is `@effect/sql-pg@4.0.0-beta.93` (peers that pin). Do not take `@effect/sql-pglite@4.0.0-beta.107`. The repo talks `SqlClient`. L1 is Postgres (`entities` + `components`). There is no DuckDB driver and no `@effect/sql-duckdb`. Intake/Get/List tests need a Postgres connection (`SPECIMENDB_PG_*`, default `127.0.0.1:5434`). Memory RPC testbed stays in-memory. Capture does not talk to PG.
