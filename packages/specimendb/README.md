# @tmnl/specimendb

Experimental. ECS specimen catalog: a branded `SpecimenId` entity plus optional components, persisted in PGlite and exposed as Effect v4 `Rpc.make` / `RpcGroup` procedures.

Understanding is attaching components later. A JPEG or HEIC with no GPS still files as Status `raw`. Locality is attached as `unknown` unless EXIF GPS or capture-page geo actually arrived. Sidecar JSON is always written next to the original. Taxon is never invented.

## RPC

| Tag | What |
|---|---|
| `Intake` | Copy the original file into catalog assets, extract EXIF sidecar tags, attach whatever arrived. Raw is enough. |
| `Get` | Fetch one specimen by `SpecimenId`. |
| `List` | List specimens. No required filters. |

## Components

None are required at birth. Intake attaches Status (`raw`), Media, Exif (sidecar always), and Locality (`unknown` or `fixed`). Locality is `fixed` only when GPS exists in EXIF or an explicit capture-page geo payload is supplied. Otherwise it says unknown. It does not invent a place.

Optional later: Claim, Taxon, Structure / Mechanism / Function, AnalogLink, Tag, Question, Observation.

## Surfaces

`IntakeDrop` and `SpecimenRail` in [`src/ui/`](./src/ui/) are compound React components driven by `@tmnl/stx` (`stx` / autoLens / `useStx` / `useFocus`). They call the existing `SpecimenRpcs`:

| Component | RPC |
|---|---|
| `IntakeDrop` | `Intake` (drop or pick a real file). New records land as Status `raw`. |
| `SpecimenRail` | `List()` on mount, `Get()` on select. |

Locality in the rail is the word `unknown` unless the file actually had EXIF GPS. The UI does not invent coordinates, elevation, temperature, taxon, ML confidence, or accession strings.

Status pills: `raw` amber, `filed` cyan, `working` emerald, `dead` rose. Machine is `raw → filed → working → dead`.

## Testbed

In-memory Intake/Get/List client (same EXIF/locality rules, no PGlite rewrite):

```sh
cd packages/specimendb
bun run testbed
```

Opens Vite at `http://localhost:4177`. Drop a JPEG onto the intake zone. A file without GPS should show `raw` and `unknown`.

## Field capture

Static page in [`capture/`](./capture/): stamp GPS + DateTimeOriginal into a JPEG in the browser and download it. Zip or drag that folder onto [Cloudflare Drop](https://www.cloudflare.com/drop/). It is not wired to PGlite or RPC.

## Versions

Effect pin matches `@tmnl/msh`: `effect@4.0.0-beta.93`. Persistence is `@effect/sql-pglite@4.0.0-beta.93` (peers that pin) plus `@electric-sql/pglite@0.4.5`. Do not take `@effect/sql-pglite@4.0.0-beta.107`; it peers `effect@^4.0.0-beta.107` and would fight msh. The repo talks `SqlClient`. L1 is PGlite. There is no DuckDB driver and no `@effect/sql-duckdb`.
