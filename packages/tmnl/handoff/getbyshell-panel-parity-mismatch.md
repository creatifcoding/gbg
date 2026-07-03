# GetByShell `tmnl-panel` Parity Mismatch Matrix

> Date: 2026-06-26
> Scope: discovery artifact for Tasker #F1347 / #4831
> Constraint: no live restarts, reloads, relogin, Nix switch, or further signals without explicit approval.

## Executive Summary

The `tmnl-panel` trigger path is recovered: a live approved `pkill -USR1 -f 'tmnl-panel$'` toggled the panel and the journal logged `Panel toggle: hidden → visible` and `Panel surface: shown (Overlay, keyboard on-demand)`.

The remaining problem is not signal delivery. It is panel parity: the standalone panel process mounts the same broad `PanelWorkspace` machinery, but it does not yet recreate the canonical TMNL panel experience. The largest evidenced gaps are:

1. **CSS/design-system boot gap:** `src-panel/panel-entry.tsx` / `src-panel/panel.html` do not import `src/index.css`, while MorphChat and canonical TMNL surfaces rely heavily on Tailwind classes and `--tmnl-*` CSS variables.
2. **Wrong shell context:** `PanelWorkspaceOverlay` was designed as an AppShell grid-cell sibling; standalone `tmnl-panel` mounts it fullscreen outside AppShell, so layout/chrome assumptions leak.
3. **Registry divergence:** the main app registers additional panel providers by side-effect (`egui`, code editor), while standalone panel only calls `registerAllVisitors()` from `src/lib/floating/visitors` (MorphChat, GEOINT, Muse).
4. **First-open experience is too bare:** workspace initializes with only `WORKSPACE_SENTINEL`, showing an empty state instead of a canonical “ready TMNL panel cockpit” or a strongly guided MorphChat/harness default.
5. **Regression harness is app-overlay oriented:** `scripts/panel-regression` assumes an already connected browser/AppShell default session and `__PANEL_TEST__`; it is not clearly validating the separate `tmnl-panel` process. Also `snapshot().overlayOpen` checks DOM presence, not actual open atom state.

Prime, the villain is not one bug. It is a surface that escaped its native habitat without bringing its wardrobe, passport, and tools.

## Evidence Sources

| Category | Source |
|---|---|
| Standalone entry | `src-panel/panel.html`, `src-panel/panel-entry.tsx`, `vite.config.panel.ts` |
| Runtime | `src-panel-tauri/src/lib.rs`, observed journal from `tmnl-panel.service` |
| Canonical panel shell | `src/lib/floating/overlay/PanelWorkspace.tsx`, `src/lib/floating/overlay/index.tsx` |
| Canonical panel chrome | `src/lib/floating/FloatingPanel.tsx`, `src/lib/floating/layout/TiledPanel.tsx`, `src/lib/floating/components/*` |
| STX authority | `src/lib/floating/stx/instance.ts`, `src/lib/floating/stx/initial.ts`, `src/lib/floating/stx/actions.ts`, `src/lib/floating/stx/spawn.ts` |
| MorphChat/harness | `src/lib/floating/visitors/morphchat-visitor.tsx`, `src/lib/morphchat/components/surface-root.tsx`, `src/lib/morphchat/skins/tmnl.tsx` |
| Design tokens | `src/lib/floating/tokens.ts`, `src/lib/tmnl-ui/tokens.ts`, `src/index.css` |
| Canonical docs | `docs/contracts/floating.md`, `docs/contracts/stx.md`, `docs/research/SOFT-MACHINE-PANEL-SYSTEM.md`, `docs/muse/panel-suite-contracts.md` |
| Regression | `scripts/panel-regression/runner.ts`, `scripts/panel-regression/assertions.ts`, `scripts/panel-regression/scenarios.ts` |

## Observed Baseline

| Fact | Evidence | Confidence |
|---|---|---|
| Trigger path works | Approved live command found exactly one `tmnl-panel`; journal logged hidden→visible and surface shown. | High |
| Panel frontend is a thin bridge | `src-panel/panel-entry.tsx` mounts `PanelWorkspaceOverlay` and `PanelWorkspace`; listens to `tmnl:panel-state`. | High |
| Panel surface starts hidden, layer-shell overlay | `src-panel-tauri/src/lib.rs` and service journal. | High |
| Canonical panel system is STX-backed | `getFloatingStx()` singleton, `initialData`, STX action barrel, docs/contracts/stx.md. | High |
| MorphChat/harness is registered as a panel visitor | `registerMorphChatVisitors()` registers `morphchat` and `morphchat:harness`. | High |

## Mismatch Matrix

| Front | Current `tmnl-panel` behavior / implementation | Canonical TMNL expectation | Mechanism / likely root cause | Evidence | Confidence | First remediation direction |
|---|---|---|---|---|---|---|
| CSS + design-system boot | `src-panel/panel.html` has only inline reset/font CSS; `panel-entry.tsx` imports no CSS. | MorphChat, TMNL skins, and many panel/testbed components rely on Tailwind utilities and `--tmnl-*` vars from `src/index.css`. | Standalone Vite entry bypasses `src/main.tsx`, the only app entry observed importing `./index.css`. Without Tailwind/CSS vars, classes like `flex`, `h-full`, `bg-black`, `text-neutral-*`, and `var(--tmnl-text-xs)` fail or fall back. | `src-panel/panel.html`; `src-panel/panel-entry.tsx`; `src/main.tsx` imports `./index.css`; `src/lib/morphchat/skins/tmnl.tsx` uses Tailwind classes and CSS vars. | High | Import `../src/index.css` (or a panel-specific canonical CSS entry) from `src-panel/panel-entry.tsx`; enforce 12px floor while reconciling current `src/index.css` 10px vars. |
| AppShell context leakage | Standalone root is fullscreen fixed div; `PanelWorkspaceOverlayInner` still styles `gridRow: 2`, `gridColumn: 2`, and describes itself as AppShell grid-cell overlay. | Standalone panel should have its own deliberate shell frame/viewport contract, not an AppShell sibling assumption. | Overlay component is reused outside the layout it was designed for. Grid fields become inert; z-index assumptions relative to AppShell header/sidebar no longer apply. | `src/lib/floating/overlay/index.tsx` comments + styles; `src-panel/panel-entry.tsx` root. | High | Introduce a standalone panel host wrapper or prop variant (`context='standalone'`) with explicit fullscreen overlay semantics. |
| First-open cockpit | `useInitializeWorkspace()` only sets `panelTree = leaf(WORKSPACE_SENTINEL)`. Empty state shows `No Panels Open` and click-to-spawn. | Canonical TMNL panel should open into a useful cockpit/ready state or a polished visitor palette, especially for GetByShell. | The standalone panel opens to the generic empty state, not a GetByShell-oriented default. | `PanelWorkspace.tsx` `useInitializeWorkspace()` and `EmptyState`; `spawnPanel('morphchat:harness')` only after click. | High | Decide first-open policy: auto-spawn `morphchat:harness`, open visitor palette, or render a proper GetByShell cockpit empty state. Avoid breaking STX sentinel/persistence. |
| Visitor registry divergence | `PanelWorkspace.tsx` calls `registerAllVisitors()` → MorphChat, GEOINT, Muse. | Main TMNL panel ecology includes additional side-effect panel registrations such as egui and code-editor panels. | Standalone entry does not import the same registration side effects as `src/main.tsx`. | `src/lib/floating/visitors/index.ts`; `src/main.tsx` imports `@/lib/egui/panels` and `@/lib/code-editor/panels/CodeEditorPanel`; `src-panel/panel-entry.tsx` imports neither. | High | Create a shared `registerTmnlPanelVisitors()` module used by both main app and standalone panel. |
| MorphChat/harness visual parity | `morphchat:harness` can be spawned via `WorkspaceActionBar`, but its UI depends on Tailwind and CSS vars. | MorphChat panel should render the canonical TMNL skin, status bar, sessions drawer, and full-height chat surface. | CSS boot gap likely degrades all Tailwind-based MorphChat visuals. Harness server availability also needs separate validation. | `morphchat-visitor.tsx`; `surface-root.tsx`; `skins/tmnl.tsx`; CSS import evidence above. | High for CSS; Medium for harness runtime until tested. | Fix CSS first; then validate `morphchat:harness` spawn, connection status, `stateTier: 'full'`, session drawer. |
| STX state authority | Current workspace uses STX singleton and spawn actions correctly. | STX remains canonical authority; no local React truth for shared panel state. | So far good, but remediation must not add local state around panel lifecycle/layout. | `stx/instance.ts`, `stx/initial.ts`, `stx/spawn.ts`, `docs/contracts/stx.md`. | High | Preserve STX boundaries. Add panel defaults through STX actions/initialization, not component-local setter soup. |
| Strip/tree mode | `layoutMode$` defaults to `strip` and is a module-local Legend observable; toggle is local. | Canonical system should have deliberate strip/tree persistence/UX and parity with Soft-Machine migration docs. | Mode selection is ephemeral and hidden in overlay module. | `PanelWorkspace.tsx` `layoutMode$ = observable('strip')`; `SOFT-MACHINE-PANEL-SYSTEM.md` panel modes and migration map. | Medium | Decide standalone default and persistence. Validate strip/tree with regression harness. |
| Panel shell/chrome hierarchy | Workspace action/status bars are minimal and generic; empty state uses single + tile. | Canonical panels have MorphCard/MorphChat DNA: hairline borders, reticle focus, tab bar, floating/tiled chrome, context menus, resize handles. | Components exist, but first-open and shell wrapper do not showcase them until content is spawned; missing CSS further hides styling. | `FloatingPanel.tsx`, `TiledPanel.tsx`, `tokens.ts`, `SOFT-MACHINE-PANEL-SYSTEM.md` §3. | Medium-High | After CSS, tune shell/backdrop/action/status/empty state to make canonical chrome visible immediately. |
| Runtime geometry/input | Runtime shows overlay surface; no current evidence of wrong monitor/geometry after trigger. | Fullscreen transparent layer-shell overlay with keyboard on-demand, ESC close, pointer focus. | Trigger works, but visual complaint could include monitor/geometry; not yet directly measured in DOM/screenshot. | journal logs; `src-panel-tauri/src/lib.rs`; no screenshot evidence yet. | Medium | Add non-mutating DOM report / `__PANEL_TEST__` geometry capture for standalone panel. Approved live visual smoke later if needed. |
| Cross-process panel state | Panel-local `tmnl:panel-state` opens overlay. Bar `usePanelOpen()` was previously identified as likely stale across process boundary. | Bar affordance should reflect true panel visibility. | Tauri events are local, not cross-process bus. | GetByShell skill notes; `panel-entry.tsx`; `PanelToggle.tsx` uses signal only. | High | Add explicit bridge or optimistic/reconciled bar state as separate task; not first visual parity fix. |
| Regression harness coverage | `scripts/panel-regression` drives default agent-browser AppShell session and says named sessions cannot init full app. `__PANEL_TEST__` is exposed in overlay module in dev. | Goal needs coverage for standalone `tmnl-panel`, not only in-app overlay. | Harness may validate main app overlay but miss separate process/CSS/runtime divergences. `snapshot().overlayOpen` is currently DOM-presence-based (`!!querySelector`) and may not reflect actual atom open state. | `scripts/panel-regression/runner.ts`; `overlay/index.tsx` dev `snapshot()`. | High | Add/adjust panel regression lane for standalone panel, or add a dev test API that reports actual `panelOverlayOpenAtom`. |
| Typography floor | `src/lib/tmnl-ui/tokens.ts` says xs=12; `src/index.css` currently sets `--tmnl-text-xs: 10px`. | Project instruction says 12px floor. | Global CSS may violate current design discipline; standalone panel falls back to 12px only if CSS var missing. Importing `index.css` could regress text size unless corrected. | `src/lib/tmnl-ui/tokens.ts`; `src/index.css`. | High | Before/while importing CSS, fix `--tmnl-text-xs` floor or scope panel CSS override to 12px minimum. |

## Debug Plan from Matrix

1. **CSS bootstrap check**
   - Add/verify panel imports canonical CSS or panel-scoped CSS.
   - Confirm Tailwind utilities and `--tmnl-*` variables exist in `tmnl-panel` DOM.
2. **Standalone shell host check**
   - Split AppShell overlay assumptions from standalone layer-shell host.
   - Ensure z-index, layout, backdrop, and pointer events are intentional for standalone.
3. **Visitor parity check**
   - Create shared visitor registration for main app + standalone panel.
   - Validate registry list includes MorphChat/harness plus expected canonical panel visitors.
4. **First-open policy check**
   - Decide if first open auto-spawns `morphchat:harness`, opens a visitor palette, or shows a stronger cockpit empty state.
   - Implement through STX actions, not local React state.
5. **MorphChat/harness check**
   - After CSS, validate harness status, session drawer, new/resume/reconnect, panel-scoped node/session identity.
6. **Regression check**
   - Run TypeScript and focused STX tests.
   - Adapt `panel:smoke`/`panel:regression` to report actual open state and standalone coverage.

## Initial Remediation Slice Recommendation

Smallest coherent first slice:

1. Import/apply canonical CSS in `src-panel/panel-entry.tsx` or create `src-panel/panel.css` that includes Tailwind output + TMNL vars.
2. Fix typography floor to 12px in any panel-applied CSS path.
3. Add a `StandalonePanelHost` wrapper so `PanelWorkspaceOverlay` is not responsible for both AppShell grid and standalone surface semantics.
4. Add actual `isOpen` to `__PANEL_TEST__.snapshot()`.
5. Run `bun run --silent tsc --noEmit --pretty false` and focused floating/STX tests.

This should move the panel from “alien/unstyled” to “recognizably TMNL,” before deeper product decisions like auto-spawning MorphChat or broad visitor registry consolidation.

## Open Questions for Prime / Later Discovery

- Should standalone `tmnl-panel` first-open auto-spawn `morphchat:harness`, or should it open a palette/cockpit?
- Which canonical panel set must ship in standalone: MorphChat only, MorphChat+Muse+GEOINT, or all main app visitor registrations?
- Should bar `PanelToggle` show optimistic state, or should we build an explicit process bridge now?
- Is the actual desired panel more “Soft-Machine workspace” or more “MorphChat/Conductor cockpit” on first open?
