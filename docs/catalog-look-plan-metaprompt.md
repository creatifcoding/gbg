# Catalog look + screens — architect metaprompt

Paste this into the architect. He drafts a **plan**. He does not implement. He does not merge. He does not restyle.

Look SoT is the Variant HTML (and the board PNGs). PR 12 merged and **failed** this lock: the live pages do not look like the HTML.

---

## Prompt

You are the architect. Draft a plan to make `@tmnl/specimendb` **look like the Variant screens** and to sequence the product bag so the catalog actually works. You write a plan (phased Goals, modes, acceptance, risks). You do **not** open an implementer PR. You do **not** invent a token system. You do **not** invent GPS, taxon, or Specimen ids.

The operator will ping you. This issue is the brief.

### 0. What failed

PR 12 landed on `master` (`@tmnl/specimendb`, PGlite, Intake/Get/List, six page files). The human verdict: **the HTML and the pages do not look similar at all.** A leftover density cut (PR 43) does not fix it. Theming a charcoal `sdb-shell` is the failure mode. Density tweaks on that shell are still a fail.

Traditional screen design is the adaptation: a page is a **named job with regions**, not a themed dashboard. Steal CAD / IDE / lab-console craft (fixed chrome, one working surface, type as hierarchy, instrument density). Color last. Do not steal SaaS (hamburger, 8pt marketing scale, shadcn cards, coalesced tokens).

### 1. Assets (already emplaced — use these, do not regenerate)

**Look lock (binaries + HTML) on PR 44** — `cursor/variant-board-screenshots-918d`

| File | Screen |
|---|---|
| `docs/variant/variant-01.png` | Terminal |
| `docs/variant/variant-02.png` | Workbench |
| `docs/variant/variant-03.png` | Assay |
| `docs/variant/variant-04.png` | Dactyl |
| `docs/variant/variant-05.png` | Catalog / Accession (board) |
| `docs/variant/8a21a4b1-d6cc-415e-954b-6288c6a0b0b1.html` | Terminal HTML — token file |
| `docs/variant/9263d787-0811-440f-8822-f31ee93b56a8.html` | Workbench HTML |
| `docs/variant/9b39d6bc-91a3-492e-a9f5-e19f5cfb14b3.html` | Assay HTML |
| `docs/variant/94e9fc0d-164a-400c-a6ef-73ee589e1741.html` | Dactyl HTML (6px scrollbars) |
| `docs/variant/e90f6c74-5f26-4990-9cb8-0f76ff18f3d8.html` | Catalog HTML |
| `docs/variant/run-06.jsx` | Catalog React export (mine, not the app) |

Raw PNGs:

- https://raw.githubusercontent.com/creatifcoding/gbg/cursor/variant-board-screenshots-918d/docs/variant/variant-01.png
- https://raw.githubusercontent.com/creatifcoding/gbg/cursor/variant-board-screenshots-918d/docs/variant/variant-02.png
- https://raw.githubusercontent.com/creatifcoding/gbg/cursor/variant-board-screenshots-918d/docs/variant/variant-03.png
- https://raw.githubusercontent.com/creatifcoding/gbg/cursor/variant-board-screenshots-918d/docs/variant/variant-04.png
- https://raw.githubusercontent.com/creatifcoding/gbg/cursor/variant-board-screenshots-918d/docs/variant/variant-05.png

**Product bag (PR 46)** — `packages/specimendb/docs/page-function-synth.md` on `cursor/specimendb-page-function-synth-f233`

https://github.com/creatifcoding/gbg/blob/cursor/specimendb-page-function-synth-f233/packages/specimendb/docs/page-function-synth.md

**Strip journal (on master, from merged PR 12)** — `packages/specimendb/docs/functionalization-journal.md`

https://github.com/creatifcoding/gbg/blob/master/packages/specimendb/docs/functionalization-journal.md

**Related**

| Thing | URL |
|---|---|
| Epic surfaces | https://github.com/creatifcoding/gbg/issues/13 |
| Merged catalog (look failed) | https://github.com/creatifcoding/gbg/pull/12 |
| Leftover density draft | https://github.com/creatifcoding/gbg/pull/43 |
| Look assets draft | https://github.com/creatifcoding/gbg/pull/44 |
| Page-function synth + four binds | https://github.com/creatifcoding/gbg/pull/46 |

Do not treat PR 12 as a visual pass. Do not regenerate Variant. Do not “Export as React” again. HTML + these PNGs are SoT.

### 2. Screens to plan (classic pattern → regions)

Build **regions → type → density → color last**.

| Route | Page | Classic screen | Regions that must survive |
|---|---|---|---|
| `/intake` | Terminal / IntakeDrop | Console + index | 420px rail, `h-14` Local Catalog kicker, card stack, dashed `Initiate_Intake_Protocol` drop, process-log well |
| `/rail` | Workbench / SpecimenRail | IDE / CAD three-pane | icon rail, card list, top drop, XZ viewport, 340px Properties Log |
| `/assay` | Assay / WorkingPanel | Instrument panel | focus record, channel wells, readout, observation log |
| `/dactyl` | Dactyl / AnalogCard | Object card | queue chrome, one analog card (template, not a type) |
| `/catalog` | Catalog / AppShell | App shell | crumbs, outlet, intake chrome — thin |
| `/accession` | Accession / DossierView | Fat dossier | rail + record; empty ranks; no ML wizard |
| `/capture/` | Phone capture | Static instrument | HTML + WASM ExifTool + device geo. Photo never uploads. |

v1 look is Terminal + Workbench. The others stay in the plan as later Goals. `unknown` is a real empty state. Kickers (`SYS_ONLINE`, `VOL: 04`, corner brackets) are chrome.

### 3. Modes (one mode per Goal)

| Mode | Writes? | Job |
|---|---|---|
| **audit** | no | Side-by-side mismatch list. Regions first. |
| **lift** | yes | Reconstruct the screen from the HTML. Strip theater *values* only. |
| **prove** | shots only | Same viewport as the source PNG. |
| **bind** | yes | After look passes. Wire now-rows only. Not mixed into a lift Goal. |

### 4. Adversarial (when needed, advisor only)

GPT-5.6 Sol. Advisor stance. Never writes. Invoke only when:

1. An implementer claims the page matches the source, or
2. A human already failed the look (attack that artifact), or
3. A visual PR wants merge.

No claim, no Sol. Human Look gate still wins. Look does not prove RPC, power, or animals.

Implementer model for lifts: Grok 4.6. Sol does not share that branch as a writer.

### 5. Locks (do not reopen)

- Specimen is the only type. AnalogCard is a card template.
- PGlite SoT. `@effect/sql-pglite@4.0.0-beta.93` + `effect@4.0.0-beta.93`. Not DuckDB. Not sql-pglite 107.
- Locality `unknown` unless EXIF or capture-page geo. Never invent GPS, taxon, or `SP-` / `SEQ-` / `OD-` ids.
- HTML is the token file. No VANTA_* port. No new token religion.
- One issue / one owner / one draft per Goal. Never merge own PR. Never merge without an explicit human go.
- Do not touch mantis / terrarium / KiCad / CAD / #15–#41 in this plan’s implementer Goals.
- Capture stays the static zip. Distinguished from package UI.
- Impeccable stays out of git. Emil may stay.

### 6. What the plan must contain

Write a plan the operator can dispatch as Goals. Include:

1. **Verdict** on current `/intake` and `/rail` vs Terminal / Workbench HTML (regions, type, density, chrome). Assume fail until proven.
2. **Phased Goals** — one mode each. First: lift Terminal, lift Workbench, prove both. Then later pages. Bind Goals only after look.
3. **Acceptance** — side-by-side with the HTML/PNG. “Dark and scientific” is not acceptance.
4. **Product-bag order** — use the synth. Next useful binds after look (GetMedia so wells survive reload, Claim/Observation write, etc.). Do not grow theater.
5. **When Sol fires** — name the prove/claim beats.
6. **What not to do** — no second ontology, no shell rewrite, no Variant restyle, no invented geo/taxon.

Deliver the plan as a comment on this issue (and a `docs/` file on a **new** draft if you must write). Do not implement the lift. Do not merge 43 / 44 / 46.

### 7. Stop

You are done when the operator has a dispatchable plan. Not when the pages look right. That is a later lift Goal.
