# Look notes — Terminal `/intake` and Workbench `/rail`

> Reconstruct from Variant HTML regions. Not a charcoal theme on a shared shell.

## Job

| Route | Page | Job |
|---|---|---|
| `/intake` | Terminal | Console + index: eat a file, list what filed |
| `/rail` | Workbench | IDE/CAD three-pane: find a record, inspect it |

## Regions (built first)

**Terminal**

1. 420px Local Catalog rail (`h-14` kicker, VOL chrome, card stack)
2. `SPECIMEN_DB /` + `SYS_ONLINE`
3. Dashed `Initiate_Intake_Protocol` well (`h-40`, charcoal + 24px tech-grid)
4. Process-log / metric wells (empty until a later bind)

**Workbench**

1. 64px icon rail
2. 420px card list (`SpecimenDB // Core`, query, RAW/FILED/WORKING/DEAD)
3. Top drop `Initiate Intake Sequence // Drop Telemetry Data` + corner-brackets
4. `VIEWPORT_XZ`
5. 340px Properties Log inspector

## Type / density / color (in that order)

- Terminal body: Inter. Kickers: `ui-monospace`, 11px Local Catalog, 9px pills/tags, 13px claim.
- Workbench chrome: IBM Plex Mono. Claim: Inter. Status squares: 6px.
- Rail 420px. Terminal photo well `h-52` (208px). Workbench media well `h-40` (160px). Scrollbars 4px `#000/#333`.
- Color last: void `#000`, charcoal cards `#1a1a1a`, selected border filed-cyan `#22d3ee`. Status paint stays amber/cyan/emerald/rose.

## Binds (unchanged this cut)

Intake / Get / List / Promote. Locality is `unknown` unless EXIF GPS exists. Real `SpecimenId` only. Workbench photo well stays empty (F-036). Terminal owns Media bytes (F-006).

## What still diverges from the Variant board

Do not mistake these screenshots for the HTML. Remaining gaps:

- Live IDs are branded UUIDs. Variant cards used short `SP-` theater. Required.
- Taxon / spectral / GPS / ML% wells stay empty. Variant filled them with invented numbers.
- `VOL` is chrome without the theater `04`.
- Workbench `h-40` well stays empty (F-036). Terminal owns Media bytes.
- Dropped JPEG in the Terminal well is whatever was ingested, not the Variant field-photo stock.
- Phosphor is the testbed webfont. Stroke weight may not match the HTML SVG export.
- Workbench has no `LOCAL_STORAGE // ACTIVE_WORKBENCH` breadcrumb (not in the region list this cut used).
- Assay / Dactyl / Catalog / Accession were not restyled.

## Screenshots

Same viewport (1440×900), after dropping a no-GPS JPEG (`field.jpg`):

- `intake.png` — Terminal `/intake`. Status `raw`, locality `unknown`, Media bytes in the `h-52` well, cyan selection.
- `rail.png` — Workbench `/rail`. Same binds. Media well empty by design (F-036). Cyan selection. Corner-brackets on the drop and `VIEWPORT_XZ`.

