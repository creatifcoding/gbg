# Page-function synth

The strip journal (`functionalization-journal.md`) walked the glass left to right. That is the floor. This file is the product bag: every theoretical function the six Variant pages plus `/capture/` pretend to do, the subsystem each one needs, what is actually bound, and the next binds that make the catalog work.

Specimen is the only type. AnalogCard is a card template. PGlite is SoT. Intake/Get/List/Promote are the only RPCs. Locality is `unknown` unless EXIF GPS or capture-page geo arrived. No SP- / SEQ- / OD- / PX- / COL- / GEK- ids, no invented GPS, no taxon, no ML%.

Bind state in this file:

| State | Meaning |
|---|---|
| **live** | Reads or writes the store. Real branded id, real Status, real Claim, real Media, locality from EXIF or `unknown`. |
| **empty-unknown** | Well exists. Renders empty or `unknown`. Waiting on a component that is allowed to stay missing. |
| **chrome** | Type only. No store write. Keep the look. |
| **theater** | A fake value was on the Variant HTML (SP-2023-084, 99.8%, oceanography, "14m AGO" as a constant). Killed. Well stays. |
| **missing** | The glass wants it. No well, no RPC, or both. |

Now-rows from the journal stay now. This cut binds three wells the journal left chrome or empty even though the store already has the data: Terminal PROTOCOL ID, Workbench EXPORT DB, Workbench LAST_UPDATED. Plus EXIF lines in the Terminal process log when tags actually arrived.

---

## Terminal `/intake` IntakeDrop

Raw intake bench. Variant Terminal HTML, not a mashed shell. Media bytes live here (F-006). Query and status filters do not. Those belong on Workbench.

### Theoretical functions

| Function | What the glass pretends | Subsystem | Bind | Goal |
|---|---|---|---|---|
| Initiate intake | Drop or pick field media, spawn a raw Specimen | Intake RPC, AssetStore, EXIF, Status=`raw`, Locality | **live** | JPEG/HEIC only. `.raw` / `.tiff` / `.csv` / sequencing archives stay later. |
| Local catalog list | Scroll of filed records | List RPC | **live** | Keep. Empty card chrome when List is empty. |
| SYS_ONLINE | Client can talk to the catalog | List success | **live** | List error → SYS_OFFLINE. No fake heartbeat. |
| Card select / Get | Open one record | Get RPC | **live** | Same Get as every other page. |
| Status pill | Show and advance lab state | Status, Promote | **live** | Click real card → `raw → filed → working → dead`. Empty chrome does not Promote. |
| Claim line | 10-second one-liner | Claim | **live** (empty) | Stays empty until someone attaches Claim. No filename-as-claim. |
| Media well | Field photo in the card | Media bytes, object URL | **live** | Session object URL from the dropped File. Reload loses the preview (no GetMedia RPC). |
| IMG_SRC caption | Filename under the well | Media.filename | **live** as label | Label, not a claim. |
| Locality | Where it was collected | Locality, EXIF GPS | **live** | `unknown` unless EXIF. Never invent coords. |
| Tag chips (3) | Discipline / method labels | Tag | **empty-unknown** | Empty slots until Tag is attached. No LEPIDOPTERA theater. |
| PROTOCOL ID well | Accession / protocol string | SpecimenId | **live** this cut | Selected branded id. F-014 still kills SP-/SEQ- theater. |
| CLASS / ORDER | Taxonomy ranks | Taxon | **theater** well | Empty. No binomial. No ML%. |
| EXTRACTION VECTOR | Prep / extraction method | Structure / Mechanism (none yet) | **empty-unknown** | Keep empty. Needs a real component later. |
| THERMAL BASE | Temperature / thermal metric | later assay | **empty-unknown** | No invented °C. |
| SPECTROSCOPY | Spectral ID / taxon-from-spectra | Taxon, spectral | **theater** well | Empty. No 99.8%. |
| CELLULAR VIABILITY | Live/dead assay readout | later assay | **empty-unknown** | Keep empty. |
| ANALYSIS_ACTIVE | A working analysis is running | chrome | **chrome** | Type only. Does not Promote. |
| `_ LIVE_FEED` | Streaming instrument | live feed | **chrome** | Keep the mark. No fake waveform data. |
| Waveform panel | Chromatophore / spectral trace | later assay, viewer | **empty-unknown** | Empty tech-grid. No R:0.992. |
| Process log | Chronological notes + what arrived | Observation, Exif, Media | **live** for arrived facts | Claim, locality, filename. EXIF Make/Model/DateTimeOriginal when tags exist. Observation notes stay empty-unknown. |
| Last-modified | How stale the record is | Specimen.createdAt, Exif DateTimeOriginal | **missing** on this page | Bound on Workbench LAST_UPDATED. Terminal does not grow a second clock. |
| Owner / UID | Who holds the record | no Owner component | **missing** | Do not invent DR. E. VANCE. No owner RPC. |
| INITIATE_SCAN | Kick a scan / capture from the bench | capture path, later instrument | **missing** | Not on this React page. Capture is `/capture/`. |
| EDIT_RECORD | Mutate claim / tags / meta | Update RPC (does not exist) | **missing** | IntakePayload.claim exists. UI never sends it. |
| Query accession | Search the rail | search | **missing** here | Workbench owns Q QUERY. Do not mash filters onto Terminal. |
| Status filters | ALL / pending / archived | Status filter | **missing** here | Variant HTML showed ACQ_PENDING. We bind the real machine on Workbench (RAW/FILED/WORKING/DEAD). |
| Broader intake types | `.raw` `.tiff` `.csv` telemetry, seq archives | Intake, media kind | **missing** | `isJpegHeic` rejects them with `JPEG/HEIC first`. |
| Crosshair / SPECIMEN_DB mark | Lab chrome | chrome | **chrome** | Keep. |
| Empty card template | Density when the catalog is empty | chrome | **chrome** | Stays. No "NO RECORDS". |

### Subsystems this page needs

Intake, List, Get, Promote, AssetStore, EXIF extract, Locality, Status machine, Claim, Media bytes, Tag (when), Observation (when), Taxon (never invent). No search. No export. No analog graph.

### Goal

A drop of a no-GPS JPEG files a branded id, Status `raw`, Media bytes, locality `unknown`, PROTOCOL ID equal to that id, process log showing filename. A GPS JPEG shows real coords. Promote from the pill. That path is live. Next on this page is GetMedia so the well survives reload, then a Claim/Observation write so the log is not only EXIF.

---

## Workbench `/rail` SpecimenRail

Catalog workbench. Query + status filter + properties log. Photo well on the rail is chrome (media now is Terminal F-006). Icon strip plus opens intake. Other strip icons are chrome.

### Theoretical functions

| Function | What the glass pretends | Subsystem | Bind | Goal |
|---|---|---|---|---|
| List on mount | Rail of specimens | List RPC | **live** | Empty card chrome when empty. |
| Q QUERY ACCESSION ID | Filter by id | search (client) | **live** | Lowercase `includes` on SpecimenId. Does not match filename or claim. Placeholder is accession id, so that is correct. |
| Status filters | ALL / RAW / FILED / WORKING / DEAD | Status | **live** | Client filter on List. Variant labels (ACQ_PENDING, REQUIRES_QC, ARCHIVED) were theater for this machine. |
| Intake sequence | Drop telemetry, spawn raw | Intake | **live** | Same JPEG/HEIC gate. |
| Card Status + Promote | Advance the machine | Status, Promote | **live** | Empty chrome does not Promote. |
| Card Claim | One-liner | Claim | **live** (empty) | Empty unless attached. |
| Card locality + pin | Collection place | Locality | **live** | `unknown` or EXIF. F-034 was `when`; the well is filled. |
| Tag chips `[ ]` | Three tags | Tag | **empty-unknown** | Empty `[]` slots. |
| Accession id on card | Identity | SpecimenId | **live** | Branded UUID. No SP-. |
| Photo well `h-40` | Field photo on the rail | Media | **chrome** | Empty on purpose. Bytes live on Terminal. |
| Get on select | Fill the detail column | Get | **live** | |
| EXPORT DB | Dump the catalog | export, List | **live** this cut | Downloads `specimendb-catalog.json` of current List items. Empty catalog downloads `[]`. No store write. |
| RUN SIM | Run a physics / FEM sim | sim, later working | **chrome** / **theater** ids | Button stays. No click handler. No SEQ- / sim theater. |
| VIEWPORT_XZ | Spatial / section viewer | viewer, Media | **empty-unknown** | ViewportMark chrome. No fake scan. |
| MAG | Magnification readout | viewer | **chrome** | Label only. |
| ACTIVE_RENDER | Viewer is drawing | chrome | **chrome** | |
| CLASSIFICATION ranks | Phylum Class Order Family | Taxon | **theater** well | Empty ranks. Never fill from ML. |
| STRUCTURAL METRICS | Tensile / density / modulus | Structure | **empty-unknown** | Keep empty. |
| Elev / Temp | Field environment | Locality.altitude, later | **empty-unknown** | Altitude exists on Locality when EXIF had it. Not painted yet. No invented °C. |
| OBSERVATION LOG | Notes | Observation | **empty-unknown** | Empty `<p>`. |
| LAST_UPDATED | Record clock | createdAt, Exif DateTimeOriginal | **live** this cut | `LAST_UPDATED` + ISO createdAt, or DateTimeOriginal when that tag arrived. Never the constant `14m AGO`. |
| ONLINE | Client health | List success | **live** | Hidden text ONLINE/OFFLINE. |
| Icon strip (cube/grid/sliders) | App nav | catalog routing | **chrome** | Plus is intake. Other icons do not route. Testbed routing is the URL. |
| Edit meta | Change claim / tags | Update RPC | **missing** | |
| Capture from workbench | Camera | capture path | **missing** | `/capture/` is a different page. |

### Subsystems this page needs

List, Get, Intake, Promote, search (id), status filter, export, Locality, Claim, Tag, Taxon (empty), Structure (empty), Observation (empty), viewer (later), sim (later), Update (missing).

### Goal

Query + filter + intake + Promote + export is the operational core. Next is painting Locality.altitude into Elev when `fixed`, then an Observation write into the log, then VIEWPORT showing Media bytes (that fights the "photo well is Terminal" split; do it only when GetMedia exists).

---

## Assay `/assay` WorkingPanel

Working biology. 440px rail, dashed intake, focus record, viewport, four channels, instrument / environment / log. Variant also showed EXECUTE ASSAY, EDIT META, instrument feedout, SEQ-882.C. Those last ones are not in the React page.

### Theoretical functions

| Function | What the glass pretends | Subsystem | Bind | Goal |
|---|---|---|---|---|
| INITIATE_INTAKE_PROTOCOL | Drop media, spawn raw | Intake | **live** | Same JPEG/HEIC. |
| Working-set rail | 440px list | List | **live** | Empty chrome when empty. |
| Get on rail select | Focus one Specimen | Get | **live** | |
| CURRENT_FOCUS_RECORD | The active working id | SpecimenId | **live** after select | Empty string until Get. No SEQ-. |
| Focus Status + Promote | Advance while working | Status, Promote | **live** | |
| Focus Claim | One-liner | Claim | **live** (empty) | |
| Focus locality | Place | Locality | **live** | `unknown` unless EXIF. |
| Focus coords theater | GPS numbers next to focus | Locality numbers | **theater** | Killed. |
| VIEWPORT | Live stage / media | Media, viewer | **empty-unknown** | Empty stage. |
| CH-01..CH-04 | Media / instrument channels | media layers | **empty-unknown** | Empty wells. Attach-layer is missing. |
| INSTRUMENT GAIN/OFFSET/WINDOW | Scope controls | later assay | **empty-unknown** | Keep empty. |
| ENVIRONMENT SALINITY/PRESSURE/CURRENT | Oceanography | never | **theater** well | Empty. Do not invent a reef. |
| LOG | Assay notes + errors | Observation, intakeError | **live** for errors | Intake errors only. Observation empty. |
| EXECUTE ASSAY | Run the working protocol | assay execute, working status | **missing** | Not in the React tree. Needs Status `working` plus a real runner. No fake spectra. |
| EDIT META | Patch claim / tags | Update RPC | **missing** | |
| Instrument feedout | Live stream | live feed | **missing** | |
| Channel kickers | CH-01 labels | chrome | **chrome** | |

### Subsystems this page needs

Intake, List, Get, Promote, Status, Claim, Locality, Media/viewer, media layers, Observation, assay runner (missing), Update (missing), live feed (later). Environment metrics are never.

### Goal

Rail + focus + Promote is live. Do not fill channels or instrument until there is a working runner that writes real Observation or Media. EXECUTE ASSAY is the next glass bind, and it is blocked on that runner plus Status already `working`.

---

## Dactyl `/dactyl` AnalogCard

One-specimen analog cards in a grid. AnalogCard is not a second entity. Active Queue is chrome. Scrollbars are 6px on `dactyl.css`.

### Theoretical functions

| Function | What the glass pretends | Subsystem | Bind | Goal |
|---|---|---|---|---|
| DROP_FIELD_MEDIA | Intake | Intake | **live** | |
| AnalogCard grid | List as analog cards | List | **live** | Template chrome when empty. |
| Get on card select | Select one Specimen | Get | **live** | |
| Card Status + Promote | Machine | Status, Promote | **live** | |
| Card Claim | One-liner | Claim | **live** (empty) | |
| Locality | Place | Locality | **live** | `unknown` unless EXIF. |
| Analog coords theater | GPS on the analog | Locality numbers | **theater** | Killed. |
| Fake analog ids | GEK- / OD- | SpecimenId theater | **theater** | Killed. Real branded id on the card. |
| Analog tags | Tags on the analog | Tag | **empty-unknown** | Not painted (Assay-like card has no tag row). |
| Card media well | Photo | Media | **empty-unknown** | Empty chrome. Bytes live on Terminal. |
| ACTIVE QUEUE | Working set of analogs | chrome, not a type | **chrome** | Three empty slots. Do not promote Queue to an entity. |
| Analog graph / edges | This specimen is like that one | AnalogLink | **empty-unknown** | Component exists. No UI, no write RPC. |
| Stomatopod seed | Demo rows | seed | **theater** | Do not seed. |
| Analog as a type | Second catalog type |  | **never** | Same Specimen. |

### Subsystems this page needs

Intake, List, Get, Promote, Status, Claim, Locality, AnalogLink (later), Tag (when), Media (when). No seed.

### Goal

Grid of real Specimens is live. Next is rendering AnalogLink targets as other SpecimenIds (Get the target, do not invent OD-). Writing an AnalogLink needs Update or AttachComponent, which does not exist.

---

## Catalog `/catalog` AppShell

Hosted catalog page. Named AppShell. It is not the SPA router. Testbed `main.tsx` pathname switch is the router. Breadcrumb `SPECIMEN_DB / CATALOG` is chrome.

### Theoretical functions

| Function | What the glass pretends | Subsystem | Bind | Goal |
|---|---|---|---|---|
| Routed chrome | App frame around pages | catalog routing | **chrome** | This component is one page. Other routes are sibling pages. |
| Breadcrumbs | Where you are | chrome | **chrome** | |
| Intake drop | File media into the hosted catalog | Intake | **live** | Copy says JPEG/HEIC and GPS only if the file has it. Honest. |
| Hosted cards | Grid of records | List | **live** | Empty chrome when empty. |
| Select card | Get | Get | **live** | |
| Card Status + Promote | Machine | Status, Promote | **live** | |
| Card locality | Place | Locality | **live** | `unknown` unless EXIF. |
| Card Claim | One-liner | Claim | **live** (empty) | |
| Card id | Identity | SpecimenId | **live** | No OD-. |
| Card Media filename | Attached file | Media.filename | **live** as label | No bytes well on this page. |
| Catalog filters | Status / type chips | Status filter | **chrome** | F-084 type only. Workbench already has live filters. Copying StatusFilters here is cheap later. |
| Taxon on cards | Rank / binomial | Taxon | **theater** | Empty. |
| Catalog coords | GPS | Locality numbers | **theater** | Killed. |
| Seed rows | Demo catalog | seed | **theater** | Do not seed. |
| Left nav rail | Jump Terminal / Workbench / Assay / … | catalog routing | **missing** | Variant board has the rail. Testbed is typed URLs. |

### Subsystems this page needs

Intake, List, Get, Promote, Status, Claim, Locality, Media label, search/filter (chrome here), routing (testbed).

### Goal

Hosted intake + list is live. Next cheap bind is the same StatusFilters as Workbench. Routing between the six pages is a testbed concern until a real nav rail exists. Do not restyle this into a generic charcoal shell.

---

## Accession `/accession` DossierView

Fat dossier. Photo rail + taxonomy table + field metrics + spectral grid + observer log. Variant also showed INITIATE_SCAN, EDIT_RECORD, OWNER, LAST_MODIFIED, ML confidence, a reflectance table with peak rows. Those extra controls are not in the React tree.

### Theoretical functions

| Function | What the glass pretends | Subsystem | Bind | Goal |
|---|---|---|---|---|
| FILE TO DOSSIER | Intake into this record set | Intake | **live** | Spawns a new Specimen. Does not attach a layer onto the selected one. |
| Photo rail | List as thumbs | List, Media bytes | **live** | Object URL when this session dropped the file. |
| Get on rail select | Fill the dossier | Get | **live** | |
| Dossier Status + Promote | Machine | Status, Promote | **live** | |
| Dossier Claim | One-liner | Claim | **live** (empty) | |
| Lead photo | Large media | Media bytes | **live** | Same session object URL. |
| IMG_SRC | Filename | Media.filename | **live** as label | |
| Taxonomy table | Kingdom → Species | Taxon | **empty-unknown** | Rank rows exist. Cells empty. No binomial. No 99.8% (ML-GEN). |
| Field-metrics locality | Place | Locality | **live** | `unknown` unless EXIF. |
| Field-metrics Elev | Altitude | Locality.altitudeMeters | **empty-unknown** | Value exists on `fixed` Locality. Not painted. |
| Field-metrics Temp | Ambient °C | later / never invent | **empty-unknown** | No invented 24.2°C. |
| Spectral grid | UV…NIR reflectance | later assay | **empty-unknown** | Band kickers, empty wells. No peak theater. |
| Observer log | Chronological notes | Observation | **empty-unknown** | Empty div. |
| INITIATE_SCAN | Start a scan | capture / instrument | **missing** | |
| EDIT_RECORD | Patch the dossier | Update RPC | **missing** | |
| OWNER / UID | Custody | no Owner component | **missing** / **theater** | Do not invent DR. E. VANCE. |
| LAST_MODIFIED | Clock | createdAt, Exif | **missing** here | Same data as Workbench LAST_UPDATED. Cheap to copy that line. |
| Fake dossier ids | SP- / SEQ- / COL- | SpecimenId theater | **theater** | Killed. |
| Attach layer | Another Media on the same Specimen | media layers, Attach | **missing** | Intake always creates a new Specimen. |

### Subsystems this page needs

Intake, List, Get, Promote, Media bytes, Status, Claim, Locality, Taxon (empty), Observation (empty), spectral (later), Update (missing), Owner (does not exist), media layers (missing).

### Goal

Dossier of a real selected Specimen is live for id, status, claim, locality, photo. Next cheap binds: LAST_UPDATED line from createdAt, Elev from Locality.altitudeMeters when `fixed`. Taxonomy stays empty until a human attaches Taxon. Spectral stays empty until a working assay writes numbers.

---

## Capture `/capture/` static phone page

Seventh surface. Not a Variant run. Static HTML + vendored ExifTool WASM. Does not call PGlite, RPC, or Intake. The photo never uploads.

### Theoretical functions

| Function | What the glass pretends | Subsystem | Bind | Goal |
|---|---|---|---|---|
| Take or choose JPEG | Device camera / picker | capture | **live** | `accept="image/jpeg,image/*"` + `capture="environment"`. |
| Locality acquiring | Ask the device | navigator.geolocation | **live** | enableHighAccuracy. No IP geo. |
| Locality fixed | Stamp GPS tags | capture-page geo | **live** | Written into EXIF on download. |
| Locality unknown | Denied / timeout / missing | Locality | **live** | GPS tags omitted. Never invented. |
| Stamp + download | Bake DateTimeOriginal ± GPS | ExifTool WASM | **live** | On-device `writeMetadata`. |
| Download name | Predictable filename | chrome naming | **live** | `specimen-YYYYMMDD-HHmmss.jpg`. Not a SpecimenId. |
| Preview | Show the chosen file | Media preview | **live** | Object URL. |
| Upload to catalog | capture→store | Intake | **missing** | Locked: the photo never uploads. Handoff is download, then drop onto `/intake` or `/rail`. |
| CDN ExifTool | Fetch WASM from the net |  | **never** | Vendored under `capture/vendor/`. |

### Subsystems this page needs

Device geo, ExifTool WASM, download. Intake is a later handoff, not a call from this page.

### Goal

Keep capture offline. The operational path is stamp → download → drop on a catalog page. Wiring fetch(Intake) from the phone would break the "never uploads" lock. Do not.

---

## Cross-page subsystem map

| Subsystem | Pages | RPC / code | Bind |
|---|---|---|---|
| Intake (spawn raw Specimen + Media + Exif + Locality) | all six Variant pages | `SpecimenRpcs.Intake` → `SpecimenRepo.intake` | live. JPEG/HEIC. Optional `claim` / `geo` unused by UI. |
| List | all six | `List` | live |
| Get on select | all six | `Get` | live |
| Promote status machine `raw → filed → working → dead` | all six (real cards only) | `Promote` | live. Dead stays dead. |
| PGlite SoT | repo, not UI | `@effect/sql-pglite@4.0.0-beta.93` | live in tests/repo. Testbed uses memory client with the same EXIF rules. |
| AssetStore | Intake | `media/store.ts` | live on repo. UI never reads bytes back (no GetMedia). |
| EXIF extract | Intake, capture stamp | `media/exif.ts`, capture ExifTool | live. Sidecar always written. |
| Locality unknown / fixed | all pages that print locality | Locality component, `localityView` | live |
| Search (accession id) | Workbench | client `visibleSpecimens` query | live. List RPC has no filter. |
| Status filters | Workbench live; Catalog chrome; Terminal absent | client `statusFilter` | live on `/rail` only |
| Export DB | Workbench | client dump of List | live this cut. No new RPC. |
| Media bytes / viewer | Terminal + Accession live; Workbench/Dactyl chrome empty | object URL at drop | live in-session. Missing across reload. |
| Media layers / attach layer | Assay channels, Accession intake | no Attach RPC | missing. Intake always inserts a new Specimen. |
| Capture path | `/capture/` then drop | static page, then Intake | live as two steps. Not one RPC. |
| Tag | Terminal / Workbench wells | Tag component | empty-unknown. No attach UI. |
| Taxon | Terminal CLASS/ORDER, Workbench CLASSIFICATION, Accession table, Catalog cards | Taxon component | empty-unknown / theater killed. Never invent. |
| Claim write | every claim line | Claim component, IntakePayload.claim | read live, write missing from UI. |
| Observation / observer log / process log | Terminal, Workbench, Assay, Accession | Observation component | empty-unknown except Terminal EXIF/filename facts and Assay intakeError. |
| Analog graph | Dactyl | AnalogLink | component only. No UI. |
| Structure / Mechanism / Function | Workbench metrics, Terminal EXTRACTION VECTOR | those components | empty-unknown |
| Question | none on glass | Question component | missing from every page |
| Update / edit meta / EDIT_RECORD | Workbench, Assay, Accession | **no RPC** | missing. Biggest hole after GetMedia. |
| Assay execute / RUN SIM / FEM / spectral numbers | Workbench RUN SIM, Assay EXECUTE, Accession spectral, Terminal waveform | none | chrome wells. later. No fake traces. |
| Live feed / instrument | Terminal LIVE_FEED, Assay feedout | none | chrome |
| Owner / UID | Accession, Variant header | no component | missing. Do not invent. |
| Catalog routing | Variant left rail, testbed URLs | `testbed/main.tsx` | chrome. Six sibling pages. |
| Seed / demo rows | Catalog, Dactyl |  | never |

There is no DuckDB path. Do not retarget the store.

---

## Iteration order

Bind next so the catalog actually works, not so the journal gets longer.

1. **This cut (done).** Terminal PROTOCOL ID = selected branded id. Workbench EXPORT DB = List JSON. Workbench LAST_UPDATED = createdAt or DateTimeOriginal. Terminal process log prints EXIF Make/Model/DateTimeOriginal when those tags arrived.
2. **GetMedia (or read AssetStore from the client).** Terminal and Accession wells go blank after reload. That is the first thing a lab will call a bug.
3. **AttachComponent / Update RPC.** Claim, Tag, Observation, AnalogLink, Taxon (human), Structure cannot be written from the glass. IntakePayload.claim is a back door that the UI does not use. Pick one write (`Observation` or `Claim`) and bind it on Terminal process log + Workbench OBSERVATION LOG.
4. **Paint Locality.altitudeMeters into Elev** on Workbench and Accession when state is `fixed`. Still no invented Temp.
5. **Copy Workbench StatusFilters onto Catalog** (F-084). Same store field. Cheap.
6. **Copy LAST_UPDATED onto Accession.** Same helper.
7. **AnalogLink read.** Dactyl cards list `target` SpecimenIds that already exist. No seed. No OD-.
8. **Broader Intake kinds** (tiff/csv/raw) only after JPEG/HEIC + GetMedia are boring.
9. **EXECUTE ASSAY / RUN SIM / waveform / spectral / channels.** Needs a working runner that writes real Observation or Media. Until then the wells stay empty.
10. **capture→Intake in one hop.** Blocked on purpose. Keep download-then-drop.
11. **Owner, ML taxon, GPS theater, SEQ- ids.** Never.

Do not mash Terminal and Workbench into one shell to "finish" search. Query stays on `/rail`.

---

## This cut vs deferred

**Walked.** Terminal, Workbench, Assay, Dactyl, Catalog, Accession, Capture.

**Bound.** PROTOCOL ID, EXPORT DB, LAST_UPDATED, EXIF process-log lines. Existing now-rows (Intake/List/Get/Promote/Status/Claim/Media/locality) were already live; this does not relitigate them.

**Deferred.** GetMedia, Update/Attach, Elev from altitude, Catalog filters, Accession clock, AnalogLink UI, assay runner, capture upload, taxon, owner, sim.
