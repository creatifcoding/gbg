# LotProphet persona + flow brief

_Sources: `src/App.tsx`, `src/atoms.ts`, `src/domain.ts`, `docs/matchers-mungers-architecture.md`; also checked live ingest helpers for context._

## Personas

1. **Activation desk operator** — primary app user. Triage property candidates, choose call/field/research next steps, record status/notes, and export call sheets or packets.
2. **Field scout / evidence collector** — resolves `field-first` and `distress` blockers with exterior-only observations, photos, owner/listing evidence, and safety-aware notes.
3. **Broker/legal proxy reviewer** — validates active-control evidence, live/work legality, broker boundary, and packet readiness before transaction-facing language.
4. **Service-route strategist** — turns swanky/industrial/property signals into service offers: research enrichment, studio/workshop fit brief, industrial ops fit, or direct service intake.
5. **Data ingest maintainer** — feeds CSV/JSON/GeoJSON/listing/call/field artifacts through matchers/mungers and monitors live candidate updates.

## Jobs-to-be-done

- See all Atlanta activation candidates spatially and by ranked list.
- Segment targets by `call-first`, `field-first`, `distress`, `benchmark` and related candidate kinds.
- Select a target and understand its dossier: address, lead type, price/size, building, signals, caveats, source, next action.
- Detect hard blockers before outreach: parcel-only, live/work claims, broker-proxy boundary, distress/safety.
- Convert blocker state into operator actions and draft statuses.
- Persist lightweight operator enrichment locally.
- Export GeoJSON, CSV call sheet, and per-candidate activation packet markdown.
- Normalize messy artifacts into candidate atoms without treating parcel-only evidence as confirmed leads.

## Primary flows

1. **Map/list triage**
   - App loads decoded candidates, hydrates local edits, and mounts the live WebSocket bridge.
   - Operator filters candidate kind from the top toolbar.
   - Filter updates both map features and activation list.
   - Operator clicks a map marker or candidate card.
   - Selected candidate drives map fly-to, popup, detail pane, gates, actions, routes, and packet preview.

2. **Activation readiness review**
   - Operator reviews dossier fields and broker/legal gate findings.
   - If no `block` findings, action rail suggests broker call and packet staging.
   - If blocked, action rail suggests resolving hard gates and sets draft status such as `field scout` or `owner lookup`.
   - Operator updates status/notes and commits to `localStorage`.

3. **Field/evidence enrichment**
   - `field-first` or blocked candidates route to evidence collection.
   - Field/operator evidence in status/notes can satisfy active-control checks.
   - Distress candidates remain safety constrained: exterior-only, title/code review, no entry.

4. **Service-offer routing**
   - Gate status plus swanky/industrial/service-lead signals produce routes.
   - Routes can be primary, secondary, or hold: broker-proxy activation, research enrichment, distress diligence, studio brief, industrial ops, direct service lead.

5. **Export/handoff**
   - Toolbar exports all-candidate GeoJSON and CSV.
   - Packet generator exports markdown for the selected candidate with readiness, sections, gate findings, routes, and guardrail text.

6. **Ingest/match/munger pipeline**
   - Current/planned sources: `data/inbox` files, HTTP/live events, scraped listings, tax/code records, field notes, call logs.
   - Mungers normalize raw rows into `ActivationCandidate` shape.
   - Matchers are planned to decide known vs new candidates and support user ground-truth overrides.
   - Live bridge can replace/upsert base candidates from snapshot or event stream.

## Logical screens / work areas

| Screen / area | Current? | Responsibilities |
|---|---:|---|
| **Map cockpit shell** | Yes | Full-screen map, brand/status, pipeline metrics, legend, live bridge state. |
| **Filter + export toolbar** | Yes | Candidate-kind filters; download GeoJSON/CSV. |
| **Activation candidate list** | Yes | Ranked filtered list; selection state; quick address/type/price scan. |
| **Activation packet / dossier pane** | Yes | Selected candidate details, evidence source, caveats, next action. |
| **Broker/legal gates panel** | Yes | Derived pass/warn/block findings for coordinates, active control, live/work, broker boundary, distress. |
| **Operator action rail** | Yes | Recommended next actions by lane and priority; can draft status changes. |
| **Service-offer routing panel** | Yes | Derived handoff routes and service positioning. |
| **Packet generator** | Yes | Preview selected packet readiness and export markdown. |
| **Operator enrichment editor** | Yes | Draft status/notes, mark field scout/call today, commit or clear local edits. |
| **Ingest inbox / import UI** | Planned | Drop/import artifacts, parse CSV/JSON/GeoJSON, preview normalized candidates. |
| **Matcher/munger preview** | Planned | Show possible matches, normalized fields, conflicts, and user override before commit. |
| **Evidence stack** | Planned | Show source artifacts/photos/calls/listings attached to selected candidate. |
| **Service intake / CRM handoff** | Logical gap | Turn routes/actions into external CRM/tasks/service workflows. |

## Navigation model

- Current app is a **single-page, map-first cockpit**; no router or URL screen state is visible.
- Navigation is atom state, not routes:
  - `filterAtom` controls list/map subset.
  - `selectedIdAtom` controls selected dossier.
  - Derived atoms compute gates, action rail, service routes, packet preview, exports, and metrics.
  - `selectedDraftAtom` holds draft status/notes until commit.
- Entry points: default first candidate, list card click, map marker click, filter buttons, export buttons.
- Persistence split: base candidates from bundled JSON/live stream; operator edits in browser `localStorage`; planned durable store/event journal for ingest.

## Open questions

- Should blocked packet export be disabled/refused? Docs say broker packet export should refuse unsafe candidates; current UI still exports a `blocked` markdown packet.
- Are toolbar GeoJSON/CSV exports intentionally all candidates, or should they honor the active filter?
- What is the source of truth for operator edits once SQLite/event-journal ingest is live: `localStorage`, server store, or both?
- Who may override gates or reclassify candidates as `excluded` / `service-lead`?
- What exact evidence objects back gate findings: listing URL, parcel, photos, call logs, zoning, CO, lease, broker approval?
- How should matcher conflicts and user ground-truth overrides be presented?
- Is there a dedicated field/mobile mode needed for scout notes, photos, offline capture, and distress safety guardrails?
- What downstream systems receive CRM notes, broker packets, legal approvals, and service-route handoffs?
