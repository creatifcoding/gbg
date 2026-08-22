# @tmnl/specimendb

Postgres is the source of truth. Driver is `@effect/sql-pg@4.0.0-beta.93` on `effect@4.0.0-beta.93`. The repo talks `SqlClient`. Default `SPECIMENDB_PG_*` is `127.0.0.1:5434`.

v1 is two tables: `entities`, and `components` keyed by `entity_id`. S in ECS is systems. Kind lives on the entity row and as a Kind component. `type` is a second-order discriminator, a column plus a Type component.

A cheap entity is kind + type. Gated components attach when a system actually ran: Honesty, Used, Generated, Claim, Status past `raw`. Minting a STEP does not invent Honesty. Relationships are components a system walks (`Used`, `Generated`, `Supersedes`), each holding a target `EntityRef`. There is no `edges` table.

Intake still files a JPEG as Status `raw`. Locality is `unknown` unless EXIF or capture-page geo arrived. Sidecar JSON is always written next to the original. Taxon is never invented.

## Seed

CAD-01 and HLR are minted from in-tree files on this ref. Not an invented specimen.

The assembly STEP is `kind=solid` `type=assembly`. Part STEPs are `type=part`. Sheets S00-S11 are `type=projected` or `type=diagram` (S08/S09 diagram). The HLR activity (`type=hlr`) Uses the STEP and Generates S00-S06. A separate export activity (`type=export`) Generates the CAD-01 assembly STEP. who/how on HLR is `generate_schematics.py`, on export is `freecad-part-occt`. where is `unknown`. why is `#58` (HLR) and `#20` (export). Bytes cites path + sha256 + git SHA. Seed does not copy STEP or SVG into the specimen AssetStore.

## Empty wells

Empty wells are drawn regions with a missing component. The chrome is on the page. The component is not. Do not invent one to look complete.

## RPC

| Tag | What |
|---|---|
| `Intake` | Mint a specimen entity, copy the original file into catalog assets, extract EXIF sidecar tags, attach whatever arrived. Raw is enough. |
| `Get` | Fetch one specimen by `SpecimenId`. |
| `List` | List specimen entities. No required filters. |
| `Promote` | Write Status one step: `raw → filed → working → dead`. Dead stays dead. |
| `Export` | Mint `kind=activity` and attach Used / Generated components. |
| `Project` | HLR: Used(step) Generated(svgs/sheets). |
| `Doctor` | Mint an activity for a run; Generated defaults to the run. |
| `AppendActivity` | Append-only activity: refuse to rewrite a ref; corrections append a new one with Supersedes. |
| `GetByRef` | Activities whose id, Used, Generated, or Supersedes target matches `{ ref }`. Walk Who / Why / When by `{ who }`, `{ why }`, `{ gitSha }`, or `{ startedAt }`. |
| `GetEntity` / `ListEntities` / `GetComponents` | Read an entity and the components keyed by `entity_id`. |
| `Attach` | Attach one component to an existing entity. |
| `MintEntity` | Mint a catalog entity and attach the components the caller walked. Seed uses this. |
| `MintActivity` | Mint an entity with `Kind=activity` and Used / Generated components. |

## Surfaces

Compound React in [`src/ui/`](./src/ui/), driven by `@tmnl/stx`. Journal: [`docs/functionalization-journal.md`](./docs/functionalization-journal.md).

| Route | Component | Page |
|---|---|---|
| `/intake` | `IntakeDrop` | Terminal |
| `/rail` | `SpecimenRail` | Workbench |
| `/assay` | `WorkingPanel` | Assay |
| `/dactyl` | `AnalogCard` | Dactyl card grid (template, not a type) |
| `/catalog` | `AppShell` | Catalog |
| `/accession` | `DossierView` | Accession dossier |

Now-rows on a page that owns them: Intake, List, Get on select, Status, Claim, Media bytes. Empty card and dossier chrome stays. Status pills: `raw` amber, `filed` cyan, `working` emerald, `dead` rose. Assay uses `#f59e0b` / `#06b6d4` / `#10b981` / `#f43f5e`. Clicking a real card's status chrome calls Promote. Empty card chrome does not.

## Testbed

In-memory Intake/Get/List/Promote client (same EXIF/locality rules, no Postgres in the Vite process):

```sh
cd packages/specimendb
bun run testbed
```

Opens Vite at `https://localhost:4177` (self-signed). Routes: `/intake`, `/rail`, `/assay`, `/dactyl`, `/catalog`, `/accession`. Phone capture is static at `/capture/`. It is not the React SPA and does not call Intake.

## Field capture

Static page in [`capture/`](./capture/), also served at `/capture/` on the testbed (HTTPS). Stamp DateTimeOriginal and geo into a JPEG in the browser and download `specimen-YYYYMMDD-HHmmss.jpg`. The photo never uploads. Zip or drag that folder onto [Cloudflare Drop](https://www.cloudflare.com/drop/). Capture is not wired to Postgres or RPC.

## Pins

Effect pin matches `@tmnl/msh`: `effect@4.0.0-beta.93`. Persistence is `@effect/sql-pg@4.0.0-beta.93`. Do not take `@effect/sql-pglite`. There is no DuckDB driver. Intake/Get/List tests need Postgres. Memory RPC testbed stays in-memory. Capture stays off the DB.
