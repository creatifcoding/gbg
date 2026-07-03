# GetByShell 30% Wider Bar + StyleX Migration

Status: Draft / planning
Date: 2026-06-28
Research memory: `ms://research/getbyshell-stylex-bar-migration-2026-06-28`

## Intent

Move the GetByShell bar from the fragile 48px rail styling model to a native rail that is roughly 30% wider:

```ts
BAR_BASE_WIDTH = 48
BAR_TARGET_SCALE = 1.3
BAR_EXACT_WIDTH = 48 * 1.3 // 62.4
BAR_WIDTH = 62 // first integer native contract candidate
```

`63px` remains an acceptable visual rounding candidate if 62px proves optically cramped, but the planning baseline is **62px**, not 72px.

The wider rail is a native surface contract, not a visual magnifier. Widgets should be redesigned against the wider rail and migrated to StyleX with shared primitives plus module-local styles.

## Immediate Correction From Prior Draft

The previous 72px / +24px framing was too aggressive. Replace it with:

- native rail target: about 30% wider than 48px
- baseline implementation candidate: 62px
- no assumption that every 48px-era dimension should be blindly multiplied by 1.5
- Clock, calendar popover, and Chronicle sizing are first-class acceptance criteria because they are currently visually too small

## Non-goals

- Do not resurrect `tmnl-panel`.
- Do not use `transform: scale(...)` or a global CSS `zoom` as the primary sizing strategy.
- Do not collapse all styles into a single global `barStyles.ts` file.
- Do not make every widget re-declare identical colors, spacing, radii, labels, dividers, glows, or rail-button idioms.
- Do not combine the native geometry cutover and the full StyleX widget migration in one unreviewable patch.

## Grounded StyleX Learnings

DeepWiki research against `facebook/stylex` was banked in `ms`. Key findings:

1. **Vite integration**
   - Install `@stylexjs/stylex` and `@stylexjs/unplugin`.
   - Put `stylex.vite(...)` before `@vitejs/plugin-react` to preserve Fast Refresh.
   - StyleX emits/aggregates CSS at build time and exposes virtual CSS/HMR modules in dev.
   - `useCSSLayers: true` is useful, but existing unlayered CSS may still override layered StyleX unless the cascade is intentional.

2. **Variables and tokens**
   - `defineVars` belongs in `.stylex.ts` files with named exports.
   - `.stylex.ts` variable files should contain only StyleX variable/const definitions.
   - Variables must be imported directly from the file that defines them.
   - `createTheme` can override variable groups for a subtree and can live outside `.stylex.ts` variable files.

3. **Dynamic styling limits**
   - StyleX prefers statically analyzable styles.
   - Dynamic StyleX style functions become CSS variables plus runtime variable assignments; use sparingly.
   - Motion animation props, SVG path math, and native Tauri/layer-shell geometry remain outside StyleX unless represented as stable CSS variables/tokens.
   - Avoid mixing arbitrary `style={...}` on the same element as `stylex.props(...)` unless the boundary is deliberate and documented.

4. **Migration strategy**
   - Add StyleX infrastructure first.
   - Move one widget/module at a time.
   - Preserve visual/runtime behavior between slices.
   - Validate with typecheck, shell build/smoke checks, and live visual confirmation.

## Architecture Rule: Local Ownership, Shared Primitives

Use three layers:

```txt
src-shell/getbyshell/stylex/
  geometry.ts          # numeric contracts: BAR_BASE_WIDTH, BAR_WIDTH, BAR_TARGET_SCALE, barSize()
  palette.stylex.ts    # shared colors and color variables
  type.stylex.ts       # typography variables; 12px floor
  space.stylex.ts      # shared spacing/radius variables for the wider rail
  recipes.ts           # shared StyleX style objects/patterns, not variable definitions

src-shell/components/<Widget>/styles/
  <widget>.stylex.ts   # widget-owned styles only
```

### Shared primitives

Promote only values/patterns that are truly cross-widget contracts:

- palette colors: phosphor, ink, amber, danger
- typography floors: xs=12px, sm=14px, base=16px
- rail spacing/radius scale
- slot marker style
- rail button style
- section label style
- glow dot style
- divider style
- active ring/glow idioms

### Widget-local ownership

Each widget owns only its unique layout and affordances:

- `BarLayout`: rail shell, zones, slots, dividers
- `WorkspaceIndicators`: workspace cells, focused/urgent/occupied glyphs
- `TMNLStatus`: reticle shell and compositor/palette status styling
- `NetworkStatus`: signal bars and sparkline framing
- `PanelToggle`: disabled/tombstoned panel affordance state, if retained
- `Clock`: time/date stack and calendar popover trigger chrome
- `Chronicle`: overlay entrance, close affordance, calendar content scale, and relationship to the clock origin

### Promotion rule

- First duplicate: acceptable.
- Second duplicate: suspicious; name the pattern.
- Third duplicate: promote to shared token or recipe.

This prevents both churn and the global-style swamp.

## Geometry Contract

The native layer-shell/Tauri side owns physical surface width and exclusive zone:

```txt
bar_width = 62
surface_width = 62 when only the rail is visible
exclusive_zone = 62
```

React consumes the same contract through shared TypeScript geometry constants.

Known current hard-coded sites to reconcile:

- `src-shell-tauri/src/lib.rs`
- `src-shared/src/state.rs`
- `src-shell/main.tsx` sentinel fallback
- `src-shell/components/CommandPalette.tsx`
- `src-shell/components/BarLayout.tsx`
- `src/lib/getbyshell/popover/atoms.ts` and related exports
- `src/lib/getbyshell/popover/Popover.tsx` docs/positioning assumptions
- `src/lib/getbyshell/popover/types.ts` docs/zone assumptions
- `src/lib/getbyshell/modal/*` positioning docs and calculations

## Scaling Policy

Do not scale the old 48px UI with a magnifying glass.

Instead, widen the native rail and choose explicit dimensions for each element. Some values may follow the 1.3 target ratio; others should be optically corrected.

Examples:

```ts
reticle30 -> 38 or 39
icon16 -> 20 or 21
slot24 -> 31 or 32
gap8 -> 10
```

The 62px bar is an actual rail size. Stable dimensions become StyleX tokens or numeric geometry helpers. Runtime-only values stay in TypeScript.

## Clock + Chronicle Sizing Acceptance

The Clock/Chronicle path is currently too small and must be corrected before the StyleX migration is considered useful.

### Clock trigger

- Time digits should be comfortably legible inside a 62px rail.
- Typography must respect the 12px floor, but the primary time digits should be larger than the current 12px.
- Clock hit area should feel like a real control, not a tiny label in a well.
- Date view should remain readable without compressing week/month text into noise.

Suggested initial targets:

```ts
clockDigit = 16px
clockMinor = 12px
clockTriggerMinHeight = 76px
clockTriggerPaddingX = 6px
clockTriggerPaddingY = 8px
calendarPopoverWidth = 280px // current 232 is too narrow
calendarPopoverHeight = 360px // current 300 is too short
```

### Chronicle overlay

- Chronicle should not inherit tiny calendar-popover scale.
- Chronicle entrance origin may come from the clock, but content sizing should be full overlay/modal scale.
- Chronicle controls/headers/body text should use normal app-scale typography, not rail-scale typography.
- The close affordance and major day cells must be finger/mouse-legible.

Suggested first check:

- Audit `src-shell/chronicle-entry.tsx` and `src/lib/getbyshell/calendar/chronicle/ChronicleEntrance.tsx` for small fixed dimensions and 48px-origin assumptions.
- Define Chronicle sizing independently from the bar rail tokens, sharing only palette/type primitives where appropriate.

## Proposed Migration Slices

### Slice 1 — Research + Plan + Documentation

- Bank StyleX research in `ms`.
- Document 30% wider StyleX architecture.
- Import Tasker feature plan.

### Slice 2 — Clock/Chronicle Size Amendment

- Increase current Clock trigger typography and hit area.
- Increase current calendar popover dimensions.
- Audit Chronicle content sizing for obvious tiny fixed values.
- Validate visually before the broader StyleX migration.

### Slice 3 — StyleX Tooling Spike

- Add `@stylexjs/stylex` and `@stylexjs/unplugin` with Bun.
- Add StyleX Vite plugin to `vite.config.shell.ts` before React plugin.
- Confirm dev CSS/HMR and production shell build behavior.
- Do not migrate widgets yet.

### Slice 4 — 62px Native Geometry Contract

- Centralize `BAR_WIDTH=62`, `BAR_BASE_WIDTH=48`, `BAR_TARGET_SCALE=1.3`.
- Update Tauri/layer-shell width, surface width, exclusive zone, sentinel fallback, command palette math, and React bar layout references.
- Validate that `tmnl-shell` maps as a 62px rail and does not resurrect panel.

### Slice 5 — Shared StyleX Primitives

- Add `getbyshell/stylex/*` primitives.
- Encode palette/type/space/radius/glow/slot/rail-button recipes.
- Preserve 12px typography floor.

### Slice 6 — Widget-by-widget Migration

Suggested order:

1. `Clock`: solve the currently-too-small clock/calendar path first.
2. `PanelToggle` / disabled panel affordance: small, low-risk.
3. `WorkspaceIndicators`: repeated cells/glyphs benefit from tokens.
4. `NetworkStatus`: SVG + CSS boundary proof.
5. `TMNLStatus`: reticle/motion boundary proof.
6. `BarLayout`: final owner of rail zones and composition.
7. `Chronicle`: migrate overlay-specific styling separately from rail tokens.

### Slice 7 — Validation + Cleanup

- Typecheck.
- Shell build.
- GetByShell DriftWM smokes.
- Live visual confirmation.
- Remove obsolete inline style helpers and dead 48px references.

## Quality Gates

- `tmnl-panel` remains disabled and absent.
- `tmnl-shell` is the only active GetByShell layer besides wallpaper.
- DriftWM reports `layers=wallpaper,tmnl-shell` when bar is active.
- Native logs report 62px bar width and exclusive zone after geometry cutover.
- No document scroll/bleed artifacts in the bar surface.
- `T/C/B` slot markers remain unless explicitly retired.
- Typography never drops below 12px.
- Clock digits are visibly larger than current 12px treatment.
- Calendar popover is larger than current 232×300 treatment.
- Chronicle content is not rail-scale/tiny.
- No global `zoom` or root `transform: scale(...)` is introduced as the sizing mechanism.

## Open Questions

1. Should the native integer width be 62px or 63px after first visual pass?
2. Should shared StyleX recipes live in `src-shell/getbyshell/stylex/recipes.ts` or be split by domain (`slotRecipes.ts`, `railRecipes.ts`, `statusRecipes.ts`) once usage appears?
3. Should command palette centering derive from the shared `BAR_WIDTH` at runtime through IPC/state, or remain a TS import contract?
