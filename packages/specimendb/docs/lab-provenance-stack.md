# Lab provenance stack — build vs buy

Research only. No viewer, no minted ids, no UI restyle, no merge.

This note answers issue [#59](https://github.com/creatifcoding/gbg/issues/59) section 9. Requirements stay in that issue; this file picks libraries and hosts. An implementer may mint refs and show W7 **after** these calls land.

Host for this note: `packages/specimendb/docs/` because the recommended viewer host is the specimendb testbed, and because PGlite / Effect `4.0.0-beta.93` already live in this package. Do not file the terrarium as a Specimen.

---

## Locks

- Specimen is a bundle (Status+Claim+Media+…); sheets/solids/activities/views are entities too; views are projections; do not file the terrarium as a Specimen. ([#69](https://github.com/creatifcoding/gbg/issues/69); supersedes “Specimen is the only catalog type” in `README.md` / `docs/functionalization-journal.md`.)
- Lab artifacts (sheet, solid, run, PR, doctor report, export/HLR/`generate.py`/doctor/Goal) are entities. They are not filed as Specimens.
- No invented GPS, taxon, SKU, or pinout. Unknown is a value.
- No `VANTA_*`. specimendb does not import tmnl (`test/strict-v4.test.ts`).
- Do not merge PRs 34 / 36 / 45 / 57 / 58 from this work.
- Do not replace OCCT `HLRBRep`. SVG already in-tree on PR 58.
- Doctor does not certify itself. Independent verifier does not generate the report it checks (PR 57 `verify_report.py`).
- Effect pin stays `4.0.0-beta.93`. Catalog SoT is Postgres (`@effect/sql-pg`); PGlite is off the path ([#91](https://github.com/creatifcoding/gbg/issues/91)). Do not take `@effect/sql-pglite`. Do not add DuckDB.

---

## Calls at a glance

| Seam | Call | One-sentence why |
|---|---|---|
| 1. Stable ref | **BUILD** compact `gbg:<kind>:<local>@<rev>` | Issue 59 already named the language; IANA URN registration and OpenLineage naming are the wrong grain. |
| 2. W7 metadata | **ADOPT** PROV-DM vocabulary, **BUILD** one Effect Schema record | PROV gives entity/activity/agent; kind and honesty class stay fields, not tables. |
| 3. Log store | **BUILD** append-only tables in the existing PGlite runtime | Same `SqlClient`, not a second catalog; Marquez / EventLog evidence is thin or a second product. |
| 4. Sheet render | **ADOPT** in-tree SVG/PNG; **BUILD** click overlay later | PR 58 already projects HLR; balloons have labels, not `data-ref`. |
| 5. Viewer host | **ADOPT** specimendb testbed (`bun run testbed`) | Lab app already exists at `https://localhost:4177`; tmnl carries VANTA/testbed chrome this brief forbids restyling. |
| 6. Doctor bridge | **ADOPT** PR 57 `doctor-report.v1.json` | Reuse the report schema; wrap it as a `report` entity. Do not fork. |

Implementer work (not this PR): mint refs, append activities for the PR 58 sheet set, add a `/shop` or `/lab` route that does not restyle Terminal/Workbench.

---

## Overlay — ECS / EVA (#69, #74, #76)

Canon that landed after this Goal started. Does not undo the table above. This PR still does not mint ids, implement a viewer, or write adapters.

ECS is canon ([#69](https://github.com/creatifcoding/gbg/issues/69)). Entity is a branded stable ref. Kind is a component. Views are projections, never SoT. AnalogCard stays a view.

Operations that produce artifacts are themselves entities (`Kind=activity`) ([#74](https://github.com/creatifcoding/gbg/issues/74)). W7 lives on the activity. Edges are `used` / `generated`. A STEP without a Get-able export activity is incomplete. Seed operations (not entities yet): PR 34 `fe8f875a` export; PR 58 `export_carriage_step.py` / `project_step.py`; PR 45 `generate.py`; PR 57 `mantis doctor`.

`packages/tmnl/src-ava` is the view runtime ([#76](https://github.com/creatifcoding/gbg/issues/76)). AVA = Asset View Agent. For the lab it is **EVA = Entity View Agent** (Asset → Entity). It compiles a declared view to a DataFusion plan. Do not build a second DataFusion compiler or a homemade EAV next to PGlite.

Already in-repo (opened): `ava-domain` (`SourceKind::Sql | Stream | Api | Graph | Lake | Cache | Custom` in `ava-domain/src/channels.rs`); `ava-compiler` DataFusion **44** / Arrow **53** (`src-ava/Cargo.toml` workspace pin); `ava-adapters` Memory, SQLite (`sqlx`), NATS, durable-streams; `ava-wasm`; `ava-runtime` hydrates `SourceKind::Graph` as `QueryRows` with no graph engine (`ava-runtime/src/v2/hydration.rs`). NATS subjects remain `tmnl.ava.*`. No `src-eva` tree. No `pggraph` string. `packages/getbygraph` is an Nx stub (`getbygraph()` returns `'getbygraph'`).

| Overlay seam | Call | One-sentence why |
|---|---|---|
| View runtime | **ADOPT** `ava-*` as EVA at the catalog seam | Bind `ava-*` and call it EVA; do not fork `src-eva`. Mechanical rename of `tmnl.ava.*` / Elixir / crates is consider-only. |
| Store cut | **BUILD** a PGlite `SourceAdapter` (`SourceKind::Sql`) on `4.0.0-beta.93` | Next cut is an adapter against the existing pin, not a new compiler and not a second catalog. |
| Graph | **DEFER** graph adapter | `SourceKind::Graph` exists; no pggraph in-repo. Call CTE vs PGlite AGE (`@electric-sql/pglite-age`) vs Evokoa pgGraph (pgrx, not WASM) later. `packages/getbygraph` is empty. |

---

## 1. Stable ref language

**Invariant.** Every entity has one durable id. Same bytes/path/SHA can be cited later. No anonymous blobs in the log.

### Options

1. **Compact `gbg:` refs** (issue 59 examples): `gbg:sheet:S01@pr58`, `gbg:step:B01@fe8f875a`, `gbg:specimen:<id>`, `gbg:run:doctor:<run-id>`.
2. **IANA URN** per [RFC 8141](https://www.rfc-editor.org/rfc/rfc8141.html): `urn:<NID>:<NSS>`. NIDs are registered; experimental `X-` namespaces were removed. Informal NIDs still go through IANA.
3. **OpenLineage namespace + name** ([naming spec](https://openlineage.io/docs/spec/naming/)): jobs from schedulers, datasets from datasources (`file` + path, `postgres://host:port` + `db.schema.table`). Runs are client UUIDs.
4. **Wrap existing branded `SpecimenId`** (`packages/specimendb/src/schemas/identifiers.ts`) and use git SHA + path as the locator for lab bytes (PR 58 already cites `fe8f875a…` and `cdd523c…`).

PR 57 already published a schema id `urn:specimendb:biomemetics:mantis:environment-doctor-report:v1` on `doctor-report.v1.json`. That is a **schema** identity, not an entity ref and not a second catalog type.

### Own vs inherit

| Own | Inherit |
|---|---|
| Grammar `gbg:<kind>:<local>@<rev>`, kind vocabulary, never-reuse of a local id | `SpecimenId` brand; git SHAs; PR / issue numbers; doctor schema `$id` |

`@<rev>` is a citation (PR number or git SHA), not a second identity. The durable name is the triple kind + local + rev. A later correction is a new entity (PROV generation), not an in-place rewrite of the old ref.

### Failure mode

Two agents mint the same `gbg:sheet:S01@pr58` for different bytes, or a view cites a path without a SHA and the file moves. OpenLineage `file` + path fails the same way: path is not content-addressed.

### Call: **BUILD**

Build the compact language from issue 59. Map `gbg:specimen:<id>` onto the existing brand; do not fork SpecimenId. Defer IANA NID registration (process, not a v1 blocker). Defer OpenLineage naming: its namespaces assume warehouses and schedulers, not sheets and STEP solids.

This PR does not mint any refs.

---

## 2. Generic W7 metadata schema

**Invariant.** One record shape for every kind. Kind is data. Honesty class travels on the entity. Views are projections over metadata + bytes.

Issue 59 W7 slots: who, what, when, where, why, how, plus **class**.

### Options

1. **W3C PROV-DM / PROV-O** ([PROV-DM](https://www.w3.org/TR/prov-dm/), [PROV-O](https://www.w3.org/TR/prov-o/), [PROV-N](https://www.w3.org/TR/prov-n/), [primer](https://www.w3.org/TR/prov-primer/), [constraints](https://www.w3.org/TR/prov-constraints/)). Core types: Entity, Activity, Agent. Relations: `used`, `wasGeneratedBy`, `wasAssociatedWith`, `wasDerivedFrom`, `wasInvalidatedBy`, optional Plan on the association. PROV-JSON note at the 2013 URL returned 404 on 2026-08-20; do not adopt that serialization.
2. **OpenLineage RunEvent** ([object model](https://openlineage.io/docs/spec/object-model/), [spec](https://raw.githubusercontent.com/OpenLineage/OpenLineage/main/spec/OpenLineage.md)): Job / Dataset / Run + facets. Additive START/COMPLETE events. Run ids are UUIDs. Facets replace prior facets of the same name.
3. **Dublin Core / DCMI terms** ([DCMI Metadata Terms](https://www.dublincore.org/specifications/dublin-core/dcmi-terms/)): creator, date, coverage, source, provenance. Generic resource description. No honesty class, weak **how**.
4. **Custom Effect Schema** in `@tmnl/specimendb`, one `TaggedStruct` with `kind` as `Schema.Literal(...)` plus an open string for later kinds. Matches existing catalog style (`src/schemas/specimen.ts`, `src/schemas/components.ts`).

### W7 → PROV mapping (conceptual, not a table per kind)

| W7 | PROV | Notes |
|---|---|---|
| who | Agent + `wasAssociatedWith` | Human login, `bc-…`, tool (`cadquery-ocp`, `HLRBRep`, Inkscape, `generate.py`) |
| what | `used` / `wasGeneratedBy` / `wasInvalidatedBy` | Entity refs in and out |
| when | Activity start/end time | UTC; optional git SHA of the tree as an attribute |
| where | Attribute on the activity | Path, host, worktree, flake shell; else `unknown` |
| why | Attribute, or `wasInformedBy` toward an issue/Goal entity | e.g. `#41` |
| how | Plan on `wasAssociatedWith`, or activity type | Command, kernel, pin |
| class | Attribute on the generated Entity | `projected` \| `diagram` \| `theoretical` \| `draft-measured` \| `unverified` \| `live` |

PROV-DM component 4 (bundles) is provenance-of-provenance. Useful later for “this W7 record was ingested from SHEETS.md”. Not v1.

### Own vs inherit

| Own | Inherit |
|---|---|
| Honesty class vocabulary; `unknown` as a real value; kind list for v1 | PROV entity/activity/agent and used/generated/associated; Effect Schema as the runtime type |

### Failure mode

A sheet index row that cannot resolve to one activity in one hop is theater (issue 59 §4). OpenLineage facet replacement (`emitting a new facet with the same name replaces the previous`) fights append-only corrections. Dublin Core cannot carry class.

### Call: **ADOPT** PROV-DM as vocabulary, **BUILD** one Effect Schema record

Do not stand up RDF/OWL. Do not emit OpenLineage events as the system of record. Kind stays a field. Class stays a field on the entity, never promoted by a Look PNG.

tmnl `src/lib/ecs/schemas/provenance.ts` is GEOINT ingest audit (`RawAuditRef`, DurableStreams). Wrong domain. Do not reuse it for lab W7.

---

## 3. Append-only log store

**Invariant.** Provenance is append-only. Corrections are new activities that supersede. Query by entity ref (subject or product), agent, issue, SHA, time. PGlite is already specimen SoT. Do not casually add a second catalog.

### What is already pinned

- `@effect/sql-pglite@4.0.0-beta.93`, `effect@4.0.0-beta.93`, `@electric-sql/pglite@0.4.5` (`packages/specimendb/package.json`, `README.md`, `test/strict-v4.test.ts`).
- L1: `PgliteClient` + `PgliteMigrator` (`src/repos/pglite.ts`). Tables today: `specimens`, `components`. Migrator table: `specimendb_migrations`.
- Repo talks `SqlClient`. SpecimenRepo is the only catalog writer. Testbed SPA is **in-memory** (`testbed/memory-client.ts`); PGlite is the persistence pin, not the Vite process.

### Options

1. **Same PGlite, new tables** (`lab_entities`, `lab_activities`, junction for used/generated). Not rows in `specimens`. Optional `derived-from` / `depicts` link to a `SpecimenId` when a sheet is actually about a filed specimen (issue 59 C6).
2. **Marquez** ([marquezproject.ai](https://marquezproject.ai/)): OpenLineage HTTP backend, jobs/datasets/runs, its own UI. A second catalog product.
3. **Git-committed JSON** already on disk: PR 57 `doctor-report.json` under the isolation root; PR 58 `projections/manifest.json` + `SHEETS.md` + `CAD01-STEP-PROVENANCE.md`. Good **seed**, not a query API.
4. **Effect EventLog** (`@effect/experimental/EventLog`) as used in tmnl IIoT schemas. Not a dependency of specimendb. No evidence it speaks `@effect/sql-pglite@4.0.0-beta.93`.

### Own vs inherit

| Own | Inherit |
|---|---|
| Activity append API; indexes on ref / agent / issue / SHA; never UPDATE who/when | PGlite `SqlClient` + migrator; PR 57/58 JSON as ingest seeds |

Promote on specimens today **updates** the Status component in place (`SpecimenRepo.promote`). That is catalog status, not provenance. Do not copy that pattern into the activity log.

### Failure mode

Putting sheets into `specimens` creates a second ontology. Standing up Marquez creates a second catalog. EventLog without a pin fight or a dual-write story.

### Call: **BUILD** append-only tables in the existing PGlite runtime

Same process, different tables, different repo. Ingest seeds from git JSON; do not make git the query SoT. **DEFER** Marquez (second catalog). **DEFER** EventLog until someone proves it on this Effect pin.

The testbed may keep serving shop W7 from a fixture until the migrator lands. That is an implementer sequencing choice, not a second catalog.

---

## 4. Sheet render / interactive layer

**Invariant.** SVG/PNG already in-tree. Interactive layer must not replace HLR. A click must not invent geometry. Honesty class is not promoted by a Look PNG.

### What is already in PR 58 (read-only; head `b64d101e805e7f3ab760d15ad38d13d359c7dce1`)

Pipeline from `SHEETS.md`:

```text
export_carriage_step.py
project_step.py
generate.py
build_pdf.py
export_hitl.py
```

- `project_step.py` writes `schematics/projections/manifest.json` for `generate.py`. Frame/rail/B20 STEP copied read-only from PR 34 SHA `fe8f875a80b37a1003f05f3a0190fbe2f0417842`, labeled DRAFT-MEASURED.
- `occt_hlr.py` uses `OCP.HLRBRep` (`HLRBRep_Algo`, `HLRBRep_HLRToShape`). Comment on that file: FreeCADCmd not on PATH; `cadquery-ocp` exposes the same kernel family.
- `manifest.json`: `authority: "occt-hlrbrep"`, `tool: "cadquery-ocp HLRBRep (FreeCADCmd not on PATH)"`, `viewCount: 47`, `failedCount: 0`.
- `generate.py` balloons are circle + part label (`B01`, `B18`, …). No `data-ref` / SVG `id` on the balloon. Visible text is the local solid name, not a `gbg:` ref.
- HITL PNGs are Look. `SHEETS.md`: a PNG does not prove geometry or safety.

Sheet classes recorded in `SHEETS.md`: S00–S06, S10 projected; S08–S09 diagram; S04 / S07 / S11 mixed.

### Options

1. **Serve the in-tree SVG/PNG** as the render product. CSS overflow for pan. Overlay hit-targets later by balloon label → solid ref.
2. **[svg-pan-zoom](https://github.com/bumbu/svg-pan-zoom)** (npm `svg-pan-zoom`). Pan/zoom for inline SVG. Last npm update 2024-10-20; GitHub release 3.6.1 is 2019. Does not recompute HLR.
3. **Deep-zoom raster** (OpenSeadragon-class). Would treat HITL PNG as the geometry. Forbidden by the brief.
4. **Replace HLR** with a 3D/FreeCAD viewer. Forbidden.

### Own vs inherit

| Own | Inherit |
|---|---|
| Click map balloon label → `gbg:step:…`; toggle projected vs diagram overlays without regenerating polylines | HLR polylines, SVG, PNG, PDF, `manifest.json` authority/tool/cad01Sha |

### Failure mode

Click invents a solid that has no STEP. Overlay restyles the sheet into a dashboard. Pan/zoom library bit-rots (svg-pan-zoom release cadence is weak).

### Call: **ADOPT** in-tree SVG/PNG; **DEFER** pan/zoom library

**BUILD** (implementer, not this PR) a hit-target overlay that uses existing balloon labels. Do not retouch `project_step.py` / `occt_hlr.py` as a writer. Do not treat HITL as a geometry pass.

---

## 5. Viewer host

**Invariant.** Lives in the lab app (specimendb / tmnl testbed), not a separate product. New route e.g. `/shop` or `/lab` **after** this note. Instrument density, not a generic dashboard. Does not restyle Terminal/Workbench. No `VANTA_*`.

### Options

1. **specimendb testbed** — `packages/specimendb`, `bun run testbed`, Vite `https://localhost:4177` (`testbed/vite.config.ts`). Routes today (`testbed/main.tsx`): `/intake`, `/rail`, `/assay`, `/dactyl`, `/catalog`, `/accession`. Capture is a static page at `/capture/`, not Intake. In-memory RPC client. Package does not import tmnl.
2. **tmnl testbed** — `packages/tmnl/src/components/testbed/*`, including `VantaCardTestbed.tsx` and a large `/testbed/*` portal. Restyle and VANTA risk. specimendb explicitly bans importing tmnl.
3. **Static page next to schematics** — `SHEETS.md` + SVG already browsable in git. No query of the activity log. Fine as a file listing, not the lab app.
4. **New mantis lab Vite app** under `projects/biomemetics/labs/mantis`. A separate product. Brief forbids that.

### Own vs inherit

| Own | Inherit |
|---|---|
| One new route and a provenance pane that deep-links W7; card one-liner who/how/SHA/class | Existing testbed HTTPS, compound UI, memory client, PGlite pin, sheet SVG bytes from PR 58 |

### Failure mode

Putting shop on `/intake` or `/rail` restyles Terminal/Workbench. Hosting in tmnl pulls VANTA. Static-only cannot resolve a doctor run in one hop.

### Call: **ADOPT** specimendb testbed

This PR does not add the route. Serving SVG from the PR 58 tree (or a copied fixture) is an implementer detail. Do not merge PR 58 to get pixels.

---

## 6. Doctor bridge

**Invariant.** Reuse PR 57 report schema. Do not fork. Independent verifier does not generate the report it checks. Doctor is workflow-based, not `--version`. Live only if the tool is present and the workflow passed.

### What is already in PR 57 (read-only; head `0f07f02ec587c8d8f3228cff3b6d193ec311363f`)

Schema: `projects/biomemetics/labs/mantis/scripts/environment/schema/doctor-report.v1.json`

- `$id`: `urn:specimendb:biomemetics:mantis:environment-doctor-report:v1`
- `kind` const: `MantisEnvironmentDoctorReport`
- Required: `schemaVersion`, `kind`, `command`, `startedAt`, `completedAt`, `runner`, `lab`, `tools`, `shells`, `checks`, `fixtures`, `blockers`, `ok`, `failed`
- `runner.identityClass`: `github-actions` | `cursor-cloud` | `local`
- `checks[].status`: `pass` | `fail` | `blocked` | `unsupported`
- `checks[]` may carry `blocker_type`, `owning_issue`, `fixture_sha256`, `output_sha256`, `tool`, `tool_version`
- Optional `independentVerification`: `{ command, exitStatus, ok, … }`

Producer: `doctor.py` `build_report` / `run_doctor`. Writes JSON, then `verify_with_independent_process` → `python -m mantis_environment.verify_cli`. If the verifier fails, `ok` becomes false and `failed` gains `independent-report-verification`. A second pass re-checks the on-disk document after embedding that field. The verifier does not require `independentVerification`.

Verifier: `verify_report.py` — “Does not generate reports, does not run tool workflows, and does not repair digests. It re-reads declared files and compares them to the report.” Validates against the schema, `flake.lock` sha256, fixture sha256s.

### Options

1. **Reuse `doctor-report.v1.json` as the report entity payload.** Activity `how` points at `mantis doctor` + nested flake workflows. Viewer deep-links the JSON, does not restate ok.
2. **Fork a slimmer W7-only doctor schema.** Second doctor. Forbidden.
3. **SARIF.** Code-scanning grain. No lab workflow/fixture/blocker types.
4. **OpenTelemetry traces.** Issue 59 non-goal: “Full OpenTelemetry product.” Activities are the telemetry.

### Own vs inherit

| Own | Inherit |
|---|---|
| `gbg:run:doctor:<run-id>` and `gbg:report:…` wrappers; one-hop link from the shop card to the JSON | Entire PR 57 schema, producer, independent verifier, blocker types (`BLOCKED_MISSING_FIXTURE`, `UNSUPPORTED_TOOL`) |

### Failure mode

A dashboard that paints `ok: true` without linking the report. A forked schema that drops `independentVerification`. Treating `BLOCKED_MISSING_FIXTURE` as a pass.

### Call: **ADOPT** PR 57 report schema

Do not edit the CAD/doctor implementer PRs except to read. Class `live` only when the tool was present and the workflow passed; otherwise keep the typed blocker.

---

## Seed facts (ingest later; do not regenerate)

From issue 59 §4, checked against PR 58 `SHEETS.md` / `CAD01-STEP-PROVENANCE.md` / `manifest.json` and PR 57 schema. Implementer appends activities; this note does not.

| Entity | who | how | class | SHA / citation |
|---|---|---|---|---|
| Frame/rail/B20 STEP | PR 34 / #28 | `freecad-part-occt` (CAD-01); PR 58 copies read-only | `draft-measured` | `fe8f875a80b37a1003f05f3a0190fbe2f0417842` |
| Carriage STEP | PR 58 export | `cadquery-ocp` from CAD-02 CSG | `theoretical` / `unverified` | model `cdd523c55a630962c399a812c9347be6f7fb9334` + PR 58 tree |
| PR 45 sheets | #41 theoretical Goal | `generate.py` boxes | `theoretical` | PR 45 |
| PR 58 sheets | projected Goal | `project_step.py` → HLRBRep → `generate.py` → Inkscape | projected S00–S06,S10; diagram S08–S09; mixed S04,S07,S11 | PR 58 head `b64d101e…` |
| Doctor | `mantis doctor` | nested-flake workflows | `live` only if tool present and workflow passed | PR 57 head `0f07f02e…` |

FreeCADCmd was not on PATH in the PR 58 environment. That absence is a first-class activity, not a silent fallback.

---

## Out of scope (this PR and v1)

- Viewer implementation, route, or restyle
- Minting refs
- AVA/EVA adapters (no PGlite `SourceAdapter`, no graph adapter, no `src-eva` fork)
- Shop-release (#31), ordering, energize
- OpenTelemetry product
- Second specimen ontology
- Re-running Variant export
- Merging PRs 34 / 36 / 45 / 57 / 58
- Writing to mantis KiCad/CAD implementer branches

---

## Sources actually opened

| Source | URL or path |
|---|---|
| Brief | https://github.com/creatifcoding/gbg/issues/59 |
| ECS canon | https://github.com/creatifcoding/gbg/issues/69 |
| Operations are entities | https://github.com/creatifcoding/gbg/issues/74 |
| AVA is EVA | https://github.com/creatifcoding/gbg/issues/76 |
| AVA workspace / DataFusion 44 | `packages/tmnl/src-ava/Cargo.toml` |
| SourceKind | `packages/tmnl/src-ava/ava-domain/src/channels.rs` |
| Graph hydration (QueryRows) | `packages/tmnl/src-ava/ava-runtime/src/v2/hydration.rs` |
| SQLite Sql adapter | `packages/tmnl/src-ava/ava-adapters/src/sqlite.rs` |
| getbygraph stub | `packages/getbygraph/src/lib/getbygraph.ts` |
| W3C PROV-DM | https://www.w3.org/TR/prov-dm/ |
| W3C PROV-O | https://www.w3.org/TR/prov-o/ |
| W3C PROV-N | https://www.w3.org/TR/prov-n/ |
| W3C PROV primer | https://www.w3.org/TR/prov-primer/ |
| W3C PROV constraints | https://www.w3.org/TR/prov-constraints/ |
| W3C PROV-JSON (404) | https://www.w3.org/TR/prov-json/ and https://www.w3.org/TR/2013/NOTE-prov-json-20130430/ |
| RFC 8141 URN | https://www.rfc-editor.org/rfc/rfc8141.html |
| DCMI Metadata Terms | https://www.dublincore.org/specifications/dublin-core/dcmi-terms/ |
| OpenLineage object model | https://openlineage.io/docs/spec/object-model/ |
| OpenLineage naming | https://openlineage.io/docs/spec/naming/ |
| OpenLineage spec (raw) | https://raw.githubusercontent.com/OpenLineage/OpenLineage/main/spec/OpenLineage.md |
| Marquez | https://marquezproject.ai/ |
| svg-pan-zoom | https://github.com/bumbu/svg-pan-zoom , https://www.npmjs.com/package/svg-pan-zoom |
| PR 57 | https://github.com/creatifcoding/gbg/pull/57 (`0f07f02ec587c8d8f3228cff3b6d193ec311363f`) |
| PR 57 schema | `scripts/environment/schema/doctor-report.v1.json` |
| PR 57 producer / verifier | `doctor.py`, `verify_report.py` |
| PR 58 | https://github.com/creatifcoding/gbg/pull/58 (`b64d101e805e7f3ab760d15ad38d13d359c7dce1`) |
| PR 58 pipeline | `project_step.py`, `occt_hlr.py`, `generate.py`, `projections/manifest.json`, `SHEETS.md`, `CAD01-STEP-PROVENANCE.md` |
| PGlite / Effect pin | `packages/specimendb/package.json`, `README.md`, `src/repos/pglite.ts`, `test/strict-v4.test.ts` |
| specimendb testbed | `packages/specimendb/testbed/main.tsx`, `testbed/vite.config.ts` |
| SpecimenId | `packages/specimendb/src/schemas/identifiers.ts` |
| tmnl GEOINT provenance (rejected) | `packages/tmnl/src/lib/ecs/schemas/provenance.ts` |
