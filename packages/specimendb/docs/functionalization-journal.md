# Functionalization journal

Specimen is the only type. AnalogCard is a card template, not a second type. Active Queue is chrome.

Verdicts:

| Verdict | Meaning |
|---|---|
| **now** | Live Intake / List / Get / Promote / Status / Claim / Media bytes / locality `unknown` (or EXIF if present) |
| **when** | Slot exists. Render empty or `unknown`. Never a sample. |
| **later** | Needs `working`. Keep the well. No fake assay / spectra / sim. |
| **chrome** | Type only. No store write. |
| **never** | Kill the value. Keep the well. No SP- / SEQ- / OD- / COL- / GEK- / GPS / taxon / ML% |

Now-bind this cut:

- Terminal: F-001, F-002, F-003, F-004, F-005, F-006, F-009
- Workbench: F-027, F-028, F-030, F-032, F-035
- Assay: F-047, F-048, F-051, F-052
- Dactyl: F-062, F-063, F-068, F-069, F-074
- Catalog: F-076, F-078, F-079, F-089
- Accession: F-098, F-100, F-101, F-102, F-105
- Capture: F-106, F-107, F-108, F-109

Get on select is live on every page that lists cards (same RPC as List). Status chrome on a real card calls Promote (`raw → filed → working → dead`). Empty card chrome does not. A no-GPS drop must produce a branded `SpecimenId`, Status `raw`, Claim if attached, Media bytes, locality `unknown`. Every other strip stays empty / unknown / chrome.

Visual lock this cut: `/intake` is the Variant Terminal HTML and `/rail` is the Variant Workbench HTML. Density, type, kickers, and 4px scrollbars stay. Do not mash them into one shell. Assay / Dactyl / Catalog / Accession stay full pages. `/capture/` stays the static phone page.

Do not fill F-017 / F-040 / F-085 / F-093 taxon, F-008 / F-033 / F-050 / F-071 / F-081 / F-094 / F-104 coords, F-014 / F-029 / F-046 / F-067 / F-077 / F-092 / F-099 fake ids, F-091 seed rows.

---

## Terminal `/intake` — IntakeDrop

| ID | Strip | Component | Verdict | Bind |
|---|---|---|---|---|
| F-001 | `Initiate_Intake_Protocol` well | Media, Exif, Status=`raw` | now | Intake |
| F-002 | Local Catalog cards | Specimen list | now | List |
| F-003 | `SYS_ONLINE` | client health | now | List success |
| F-004 | card Status pill | Status | now | Status; Promote on click |
| F-005 | card Claim line | Claim | now | Claim or empty |
| F-006 | card `h-52` well | Media bytes | now | object URL; `IMG_SRC` filename |
| F-007 | 3 tag chips | Tag | when | empty unless attached |
| F-008 | GPS / coordinate theater | Locality numbers | never | no invented coords |
| F-009 | locality copy | Locality | now | `unknown` unless EXIF GPS |
| F-010 | `SPECIMEN_DB` mark | — | chrome | |
| F-011 | `ANALYSIS_ACTIVE` | — | chrome | |
| F-012 | `_ LIVE_FEED` | — | chrome | |
| F-013 | `CLASS / ORDER` cell | Taxon | later | empty well |
| F-014 | `PROTOCOL ID` fake ids | SpecimenId theater | never | real branded id only |
| F-015 | `EXTRACTION VECTOR` | — | later | empty |
| F-016 | `THERMAL BASE` | — | later | empty |
| F-017 | `SPECTROSCOPY` / taxon | Taxon | never | empty; no binomial; no ML% |
| F-018 | `CELLULAR VIABILITY` | — | later | empty |
| F-019 | waveform panel | — | later | empty grid |
| F-020 | process log | Observation | when | empty unless real notes |
| F-021 | `IMG_SRC` caption | Media filename | chrome | label only, not a claim |
| F-022 | crosshair mark | — | chrome | |
| F-023 | empty card template | — | chrome | stays when List is empty |
| F-024 | Get on card select | Specimen | now | Get (select) |
| F-025 | detail `>>` id | SpecimenId | chrome | real id or empty `>>` |
| F-026 | database mark | — | chrome | |

## Workbench `/rail` — SpecimenRail

| ID | Strip | Component | Verdict | Bind |
|---|---|---|---|---|
| F-027 | `Q QUERY ACCESSION ID` | SpecimenId | now | List query |
| F-028 | RAW/FILED/WORKING/DEAD | Status | now | List filter |
| F-029 | fake accession strings | SpecimenId theater | never | no SP- / SEQ- |
| F-030 | card Status | Status | now | Status; Promote on click |
| F-031 | `[tag][tag][tag]` | Tag | when | empty unless attached |
| F-032 | card Claim | Claim | now | Claim or empty |
| F-033 | coordinate line | Locality numbers | never | no invented GPS |
| F-034 | pin locality | Locality | when | `unknown` or EXIF; not invented |
| F-035 | `Initiate Intake Sequence` | Media, Status=`raw` | now | Intake |
| F-036 | `h-40` photo well | Media | chrome | empty on Workbench (Media now is Terminal F-006) |
| F-037 | `VIEWPORT_XZ` | — | later | empty |
| F-038 | `MAG` | — | chrome | |
| F-039 | `ACTIVE_RENDER` | — | chrome | |
| F-040 | CLASSIFICATION ranks | Taxon | never | empty ranks |
| F-041 | STRUCTURAL METRICS | — | later | empty |
| F-042 | Elev / Temp | — | later | empty; no invented °C |
| F-043 | OBSERVATION LOG | Observation | when | empty |
| F-044 | `LAST_UPDATED` | — | chrome | |
| F-045 | `EXPORT DB` | — | chrome | |
| F-046 | `RUN SIM` / fake ids | — | never | keep the button; no SEQ- / sim theater |

## Assay `/assay` — WorkingPanel

| ID | Strip | Component | Verdict | Bind |
|---|---|---|---|---|
| F-047 | `INITIATE_INTAKE_PROTOCOL` `h-28` | Media, Status=`raw` | now | Intake |
| F-048 | 440px rail cards | Specimen list | now | List |
| F-049 | `CURRENT_FOCUS_RECORD` | Specimen | chrome | real id after Get/select |
| F-050 | focus coords | Locality numbers | never | no GPS theater |
| F-051 | focus Status | Status | now | Status; Promote on click |
| F-052 | focus Claim | Claim | now | Claim or empty |
| F-053 | locality | Locality | when | `unknown` unless EXIF |
| F-054 | viewport stage | Media | later | empty unless later working view |
| F-055 | 4 channels | — | later | empty wells |
| F-056 | instrument panel | — | later | empty |
| F-057 | environment / oceanography | — | never | empty; no invented oceanography |
| F-058 | assay log | Observation | when | empty |
| F-059 | Get on rail select | Specimen | now | Get |
| F-060 | empty rail card | — | chrome | stays when List is empty |
| F-061 | channel kickers | — | chrome | |

## Dactyl `/dactyl` — AnalogCard grid

| ID | Strip | Component | Verdict | Bind |
|---|---|---|---|---|
| F-062 | `w-80` intake well | Media, Status=`raw` | now | Intake |
| F-063 | AnalogCard grid | Specimen list | now | List |
| F-064 | Active Queue | — | chrome | not a type; empty slots |
| F-065 | Get on card select | Specimen | now | Get |
| F-066 | AnalogCard template | — | chrome | card chrome when empty |
| F-067 | fake analog ids | SpecimenId theater | never | no GEK- / OD- |
| F-068 | card Status | Status | now | Status; Promote on click |
| F-069 | card Claim | Claim | now | Claim or empty |
| F-070 | analog tags | Tag | when | empty |
| F-071 | analog coords | Locality numbers | never | no GPS |
| F-072 | analog graph | AnalogLink | later | empty |
| F-073 | stomatopod seed | — | never | do not seed |
| F-074 | locality | Locality | now | `unknown` unless EXIF |
| F-075 | card media well | Media | when | empty chrome on Dactyl (bytes live on Terminal) |

## Catalog `/catalog` — AppShell

| ID | Strip | Component | Verdict | Bind |
|---|---|---|---|---|
| F-076 | catalog intake drop | Media, Status=`raw` | now | Intake |
| F-077 | `OD-*` / fake catalog ids | SpecimenId theater | never | real branded id |
| F-078 | hosted catalog cards | Specimen list | now | List |
| F-079 | select card | Specimen | now | Get |
| F-080 | breadcrumbs | — | chrome | `SPECIMEN_DB / CATALOG` |
| F-081 | catalog coords | Locality numbers | never | no GPS |
| F-082 | AppShell frame | — | chrome | |
| F-083 | empty catalog card | — | chrome | stays when List is empty |
| F-084 | catalog filters | — | chrome | type only this cut |
| F-085 | taxon on cards | Taxon | never | empty |
| F-086 | hosted intake copy | — | chrome | |
| F-087 | card Media | Media | when | filename label if attached |
| F-088 | card Claim | Claim | when | empty unless Claim |
| F-089 | card Status | Status | now | Status; Promote on click |
| F-090 | card locality | Locality | when | `unknown` unless EXIF |
| F-091 | seed rows | — | never | no invented catalog rows |

## Accession `/accession` — DossierView

| ID | Strip | Component | Verdict | Bind |
|---|---|---|---|---|
| F-092 | fake dossier ids | SpecimenId theater | never | no SP- / SEQ- / COL- |
| F-093 | taxonomy binomials | Taxon | never | empty ranks |
| F-094 | dossier GPS numbers | Locality numbers | never | no invented coords |
| F-095 | taxonomy TABLE | Taxon ranks | when | empty rank rows |
| F-096 | spectral grid | — | later | empty |
| F-097 | observer log | Observation | when | empty |
| F-098 | photo rail | Specimen list | now | List |
| F-099 | `COL-*` / GEK-* ids | SpecimenId theater | never | keep the well |
| F-100 | dossier Status | Status | now | Status; Promote on click |
| F-101 | dossier Claim | Claim | now | Claim or empty |
| F-102 | photo / Media bytes | Media | now | object URL when attached |
| F-103 | Get on rail select | Specimen | now | Get |
| F-104 | field-metric coords | Locality numbers | never | elev/temp empty; no GPS fill |
| F-105 | field-metrics locality | Locality | now | `unknown` unless EXIF |

## Capture `/capture` — static phone page

Static HTML + vendored ExifTool WASM. Not a React surface. Does not call PGlite, RPC, or Intake. The photo never uploads.

| ID | Strip | Component | Verdict | Bind |
|---|---|---|---|---|
| F-106 | download name | — | now | `specimen-YYYYMMDD-HHmmss.jpg` |
| F-107 | denied / missing geo | Locality | now | `unknown`; GPS tags omitted; never invent coordinates |
| F-108 | stamp + download | — | now | on-device `writeMetadata`; no upload; no Intake |
| F-109 | ExifTool WASM | — | now | `vendor/`; no CDN at shot time |

