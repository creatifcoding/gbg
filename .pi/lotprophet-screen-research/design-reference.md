# LotProphet Screen Architecture — Design Reference Brief

_Date: 2026-06-21_  
_Model brief: openai-codex/gpt-5.5_  
_Status: design/reference only; no app implementation changes._

## 1. Product stance

LotProphet should feel like an **editorial field-glass for property activation**, not a generic CRM dashboard. The primary object is the `ActivationCandidate`: a mapped target with evidence, caveats, broker/legal gates, operator notes, and a next action. The screen architecture should keep three surfaces synchronized:

1. **Map** — geographic context, clusters, field priority, false-positive calibration.
2. **Table** — sortable operational truth, bulk triage, queue management, evidence density.
3. **Dossier** — selected candidate narrative, broker/legal gates, action rail, packet preview.

The winning mental model: **select anywhere, understand everywhere, act from the dossier**.

## 2. Visual north star: serif Swiss grid

Use Swiss discipline with an editorial serif layer: structured, quiet, exact, and legible under pressure.

- **Grid:** 12-column desktop grid, 8px baseline, generous gutters, left-aligned text, strong vertical rhythm.
- **Typography:**
  - Display/editorial: high-quality serif for screen title, selected address, dossier headings.
  - Workhorse UI: neutral sans for controls, table cells, labels.
  - Data/coordinates/export: tabular mono only where it adds precision.
- **Composition:** large map plane as the canvas; table and dossier are modular instruments placed on top or beside it, not floating clutter.
- **Color:** warm black / graphite base, bone paper panels, restrained signal colors.
  - Call-first: green.
  - Field-first: amber.
  - Distress/blocker: red-orange.
  - Benchmark: blue.
  - Service lead: violet.
  - Excluded: neutral gray.
- **Texture:** subtle paper/grain is acceptable, but never at the cost of table or popup readability.
- **Motion:** BEUI-style motion should clarify state changes, not decorate. Use short, damped transitions for sheet open, action expansion, row selection, and command palette reveal.

## 3. Design principles

1. **Evidence over ambience.** Every visual emphasis should point to source quality, active-control evidence, gate status, or next action.
2. **Readable before cinematic.** Pitched maps and glass panels are secondary to text contrast, hit targets, row density, and popup legibility.
3. **One selected candidate.** Map marker, table row, dossier header, and action rail all reflect the same selected ID.
4. **Broker/legal gates are first-class UI.** Never bury live/work, negotiation, distress, or proxy constraints below decorative cards.
5. **Operator actions are staged, not magical.** Buttons should draft or queue actions, show resulting status, and expose audit/export paths.
6. **Progressive disclosure.** Overview shows rank, address, class, gate state, next action. Dossier reveals full evidence and packet content.
7. **Keyboard and pointer parity.** Table navigation, command palette, popovers, sheets, and action cards must be usable without mouse-only map gestures.
8. **Components should be headless-compatible.** Favor shadcn-shaped APIs backed by Base UI/headless primitives; use BEUI for motion wrappers where useful.

## 4. Screen-level visual hierarchy

### A. App shell / command header

Purpose: orient the operator and expose global controls without stealing from the map/table.

- Left: product mark, current workspace label, live bridge status.
- Center: global search / command palette trigger.
- Right: exports, sync status, saved view selector.
- Visual treatment: compact, bone-on-charcoal, strict 8px rhythm.

Recommended components:

- `AppShell`
- `CommandTrigger`
- `LiveStatusBadge`
- `SavedViewSelect`
- `ExportMenu`

### B. Recon overview: map + table split

Desktop default should be a **map/table command board**:

- Map occupies the large visual field.
- Table is the authoritative queue, either bottom-docked or left/right split depending on operator mode.
- Dossier opens as a right sheet/panel when a candidate is selected.

Suggested desktop grid:

- Columns 1–8: `MapCanvas`.
- Columns 1–8 bottom or columns 1–5 side: `CandidateTable` depending on mode.
- Columns 9–12: `CandidateDossier` sticky panel.
- Top rail spans all columns but remains visually light.

### C. Candidate table

The table is not a secondary list; it is the operator’s queue.

Core columns:

| Column | Purpose |
| --- | --- |
| Rank | Stable triage order. |
| Gate | Pass/warn/block summary. |
| Kind | `call-first`, `field-first`, `distress`, `benchmark`, `service-lead`, `excluded`. |
| Address | Primary row label; opens dossier. |
| Price / size | Commercial viability scan. |
| Source | Evidence provenance. |
| Status | Operator status. |
| Next action | The row’s immediate job. |
| Updated | Local/live edit recency. |

Table behavior:

- Sticky header.
- Row selection syncs map fly-to and dossier.
- Sort by rank, gate severity, kind, status, updated.
- Filter chips match map marker colors.
- Row density toggle: `compact` for queue work, `comfortable` for review.
- Bulk actions are limited to safe states: export, mark field-scout, clear selection, assign review lane.

### D. Candidate dossier

The dossier is the narrative and decision surface. It should read like a tight investment memo, not a random detail sidebar.

Hierarchy:

1. Serif address heading.
2. Status/kind/gate chips.
3. Lead summary: price, size, neighborhood, source.
4. Evidence fields: building, swanky signal, industrial signal, legal live/work posture, caveats.
5. Broker/legal gates.
6. Operator action rail.
7. Service-offer routing.
8. Packet preview/export.
9. Operator notes/status editor.

Use a sticky internal header so address + gate posture remain visible while scrolling.

### E. Operator action surfaces

Operator actions should appear in three places:

1. **Dossier action rail:** contextual actions for the selected candidate.
2. **Table row quick actions:** only safe, reversible status changes.
3. **Command palette:** fast keyboard path for global actions and selected-candidate actions.

Action priority model:

- `now` — green/solid, one primary action only.
- `next` — amber/outline, supportive steps.
- `hold` — red/neutral, blocked until evidence/legal gate clears.

Actions must show the consequence: “sets status to field scout”, “exports packet”, “requires broker/legal review”.

## 5. Map + table + dossier workflows

### Workflow 1: Triage from overview

1. Operator chooses a filter chip: all / call-first / field-first / distress / benchmark.
2. Table rows and map markers update together.
3. Operator sorts by gate severity or rank.
4. Selecting a row centers marker and opens dossier.
5. Dossier presents one primary next action.

### Workflow 2: Spatial scouting

1. Operator pans/zooms the map.
2. Hover marker shows compact tooltip.
3. Click marker pins a richer popover and selects table row.
4. “Open dossier” or keyboard Enter moves focus to the dossier.
5. Field-scout action drafts status and notes template.

### Workflow 3: Broker packet readiness

1. Candidate selected.
2. Gate cards show pass/warn/block.
3. Blocked findings explain missing evidence.
4. If unblocked, packet preview becomes ready.
5. Export button creates activation packet with guardrail language.

### Workflow 4: Service-offer routing

1. Candidate has blocked transaction-facing gates or service-lead classification.
2. Dossier promotes research, zoning, packet prep, field ops, or studio/industrial fit service route.
3. Operator can stage CRM note without implying brokerage/occupancy claims.

## 6. Legible map tooltip / popover specification

Current map popovers should evolve from tiny HTML snippets into a deliberate component surface.

### Tooltip on hover

Use for preview only.

- Width: 260–320px.
- Content:
  - Rank + kind chip.
  - Address.
  - Price / size.
  - Gate summary icon.
- No action buttons.
- Dismisses on pointer leave or Escape.
- High contrast: opaque warm-black or bone panel; avoid heavy blur over map text.

### Popover on click / selection

Use for decision support.

- Width: 340–400px desktop; full-width bottom sheet on mobile.
- Content order:
  1. Rank, kind, gate status.
  2. Serif address headline.
  3. Lead type + price + available size.
  4. One-line caveat or blocker.
  5. Next action.
  6. Buttons: `Open dossier`, `Mark field scout`, optional `Copy address`.
- Must be keyboard focusable and Escape-dismissable.
- Use a real React/Base UI popover where possible; if MapLibre requires HTML, sanitize content and keep it presentation-only.
- Do not rely on color alone; include labels like `blocked`, `warn`, `ready`.

### Marker language

- Marker halo = urgency/category.
- Marker core = exact location.
- Selected marker = larger ring + label.
- Excluded candidates should be visible only in calibration views, with subdued gray styling.

## 7. Component vocabulary

### Foundation primitives

These should be shadcn/Base UI compatible: composable, accessible, slot-friendly, and style-token driven.

- `Button` — variants: primary, secondary, ghost, danger, broker, field.
- `Badge` / `StatusPill` — kind, gate, operator status.
- `Card` — low-elevation information block.
- `Tabs` — map/table/dossier mode switching on constrained layouts.
- `Popover` / `HoverCard` / `Tooltip` — candidate preview and field explanations.
- `Sheet` / `Dialog` — dossier on tablet/mobile; packet preview.
- `Select` — operator status, saved views.
- `Textarea` — enrichment notes.
- `Table` / `DataGrid` — candidate queue with sorting/filtering.
- `Command` — keyboard operator surface.
- `Separator`, `ScrollArea`, `Toast`, `Skeleton`, `Kbd`.

### BEUI-compatible motion accents

Use BEUI as a motion/copy-paste reference, not as the behavioral accessibility layer.

- `button-stateful` for commit/export feedback.
- `expandable-action-bar` for selected-candidate actions.
- `command-palette` for keyboard operations.
- `bottom-sheet` for mobile dossier.
- `animated-badge` or `number-ticker` for summary metrics, sparingly.
- `tooltip` only if it preserves accessibility and map readability.

### LotProphet domain components

- `ActivationCandidateRow`
- `CandidateKindBadge`
- `OperatorStatusSelect`
- `GateSummaryPill`
- `GateFindingCard`
- `BrokerBoundaryBanner`
- `MapCanvas`
- `CandidateMarkerLayer`
- `CandidateMapTooltip`
- `CandidateMapPopover`
- `CandidateTable`
- `CandidateDossier`
- `EvidenceField`
- `OperatorActionRail`
- `OperatorActionCard`
- `ServiceRouteCard`
- `ActivationPacketPreview`
- `ExportMenu`
- `GuardrailFooter`

## 8. Operator action surface details

The operator should always know: **what can I do now, what is blocked, and what evidence will unblock it?**

Recommended action card anatomy:

- Lane label: broker / field / legal / packet / service / CRM.
- Verb-first title: “Call listing broker”, “Resolve hard gates”, “Stage packet”.
- Consequence line: status change, export, or queue effect.
- Guardrail line when relevant.
- Priority color and text label.

Recommended persistent surfaces:

- **Selected action bar:** sticky at bottom of dossier or viewport; contains one primary action plus overflow menu.
- **Audit toast:** confirms localStorage/live update/export.
- **Blocked banner:** red/amber gate explanation above unsafe actions.
- **Command palette actions:** `Open selected dossier`, `Export selected packet`, `Mark field scout`, `Copy address`, `Filter distress`.

Unsafe actions should never appear as primary when gates are blocked. Prefer disabled-with-reason or route to research/service action.

## 9. Screen modes

### Mode: Command board

Default desktop view. Map + table + dossier visible together. Built for triage and comparison.

### Mode: Dossier focus

Dossier expands to 8–10 columns. Map becomes mini-context card; table collapses to related candidates. Built for packet prep and legal review.

### Mode: Field scout

Mobile/tablet bottom-sheet interface. Large address, map directions/copy, notes, status buttons. No dense table.

### Mode: Packet review

Document-like layout with serif headings, gate findings, source evidence, route recommendations, and export controls.

## 10. Token guidance

Suggested token names rather than hard-coded one-off styles:

- `--lp-bg-canvas`
- `--lp-bg-panel`
- `--lp-bg-paper`
- `--lp-border-subtle`
- `--lp-border-strong`
- `--lp-text-primary`
- `--lp-text-muted`
- `--lp-signal-call`
- `--lp-signal-field`
- `--lp-signal-distress`
- `--lp-signal-benchmark`
- `--lp-signal-service`
- `--lp-signal-excluded`
- `--lp-font-display-serif`
- `--lp-font-ui-sans`
- `--lp-font-data-mono`
- `--lp-radius-card`
- `--lp-shadow-panel`

Typography scale:

- Display: 48–72px serif, tight tracking, used sparingly.
- Dossier H1: 28–36px serif.
- Section label: 11–12px uppercase sans, wide tracking.
- Table body: 12–14px sans with tabular numeric alignment.
- Map popover body: minimum 13px; no ultra-small 10px critical text.

## 11. Acceptance checklist

- [ ] A candidate selected in map, table, or command palette updates all surfaces.
- [ ] Table can perform real queue work without opening every dossier.
- [ ] Map tooltip is readable over the basemap at normal zoom and brightness.
- [ ] Click popover includes next action and gate state, not just address/price.
- [ ] Dossier exposes broker/legal gates before packet/export actions.
- [ ] Operator actions are priority-labeled and consequence-explicit.
- [ ] Blocked candidates route to evidence/service workflows, not transaction-facing CTAs.
- [ ] Components can be implemented with shadcn-shaped APIs, Base UI/headless behavior, and optional BEUI motion.
- [ ] Serif Swiss grid is visible in hierarchy and spacing, while dense data remains practical.
