# Floating Panel Decomposition — Quality Gates

> Each phase must pass ALL its gates before closing.
> Gates are executable — every one is a shell command that exits 0 on pass, non-zero on fail.

---

## Root Feature (#F495) — Final Acceptance

These run after ALL 8 phases complete.

| # | Gate | Command |
|---|------|---------|
| 1 | tsc zero errors | `npx tsc --noEmit` |
| 2 | All floating tests pass | `npx vitest run src/lib/floating/ --reporter=verbose` |
| 3 | Provider ≤ 150 lines (from 976) | `lines=$(wc -l < src/lib/floating/providers/FloatingPanelProvider.tsx) && [ "$lines" -le 150 ]` |
| 4 | FloatingPanel ≤ 120 lines (from 389) | `lines=$(wc -l < src/lib/floating/components/FloatingPanel.tsx) && [ "$lines" -le 120 ]` |
| 5 | Barrel ≤ 60 lines (from 181) | `lines=$(wc -l < src/lib/floating/index.ts) && [ "$lines" -le 60 ]` |
| 6 | No hook > 100 lines | `find src/lib/floating/hooks -name '*.ts' ! -name 'index.ts' -exec sh -c '[ $(wc -l < "$1") -le 100 ] || exit 1' _ {} \;` |
| 7 | No modifier > 80 lines | `find src/lib/floating/modifiers -name '*.ts' ! -name 'index.ts' -exec sh -c '[ $(wc -l < "$1") -le 80 ] || exit 1' _ {} \;` |
| 8 | No component > 120 lines | `find src/lib/floating/components -name '*.tsx' ! -name 'index.ts' -exec sh -c '[ $(wc -l < "$1") -le 120 ] || exit 1' _ {} \;` |
| 9 | ≥4 data-slot attributes in components/ | `count=$(grep -r 'data-slot=' src/lib/floating/components/ \| grep -c 'data-slot') && [ "$count" -ge 4 ]` |
| 10 | role=dialog + aria-label on panel | `grep -q 'role.*dialog' src/lib/floating/components/FloatingPanel.tsx && grep -q 'aria-label' src/lib/floating/components/FloatingPanel.tsx` |
| 11 | Zero orphaned root-level files | `[ ! -f src/lib/floating/FloatingPanel.tsx ] && [ ! -f src/lib/floating/ResizeHandles.tsx ] && [ ! -f src/lib/floating/FloatingDragOverlay.tsx ] && [ ! -f src/lib/floating/FloatingDimensionContext.tsx ] && [ ! -f src/lib/floating/FloatingBoundsContext.tsx ] && [ ! -f src/lib/floating/FloatingPanelProvider.tsx ]` |
| 12 | Zero hardcoded hex colors outside tokens | `! grep -rn '#[0-9a-fA-F]\{6\}' src/lib/floating/components/ --include='*.tsx' \| grep -v 'tokens' \| grep -v import` |
| 13 | 11 external consumers compile | `npx tsc --noEmit 2>&1 \| grep -c 'floating' \| xargs test 0 -eq` |

---

## Phase 1 (#F496) — Tokens + Icons + ChromeBtn

| # | Gate | Command |
|---|------|---------|
| 1 | tsc clean | `npx tsc --noEmit` |
| 2 | tokens.ts exports PANEL | `grep -q 'export const PANEL' src/lib/floating/tokens.ts` |
| 3 | PanelIcons.tsx has all 5 icons | `for icon in MinimizeIcon CollapseIcon ExpandIcon MaximizeIcon RestoreIcon; do grep -q "$icon" src/lib/floating/components/PanelIcons.tsx \|\| exit 1; done` |
| 4 | FloatingPanel.tsx zero inline icon defs | `! grep -q 'const MinimizeIcon' src/lib/floating/FloatingPanel.tsx` |
| 5 | FloatingPanel.tsx imports from tokens | `grep -q "from.*tokens" src/lib/floating/FloatingPanel.tsx` |
| 6 | Position tests pass | `npx vitest run src/lib/floating/utils/__tests__/position.test.ts` |

---

## Phase 2 (#F497) — Dock Module

| # | Gate | Command |
|---|------|---------|
| 1 | tsc clean | `npx tsc --noEmit` |
| 2 | dock/layout.ts exports 4 functions | `for fn in approx classifyDockZone dockZoneLabel resolveDockLayout; do grep -q "$fn" src/lib/floating/dock/layout.ts \|\| exit 1; done` |
| 3 | Dock layout unit tests pass | `npx vitest run src/lib/floating/dock/__tests__/layout.test.ts` |
| 4 | Dock tests ≥ 8 cases | `[ $(grep -c 'it(' src/lib/floating/dock/__tests__/layout.test.ts) -ge 8 ]` |
| 5 | Provider no longer has inline dock functions | `! grep -q 'function resolveDockLayout\|function classifyDockZone\|function approx' src/lib/floating/FloatingPanelProvider.tsx` |
| 6 | Position tests still pass | `npx vitest run src/lib/floating/utils/__tests__/position.test.ts` |

---

## Phase 3 (#F498) — Context Extraction

| # | Gate | Command |
|---|------|---------|
| 1 | tsc clean | `npx tsc --noEmit` |
| 2 | Context file has interface + hook | `grep -q 'FloatingPanelContextValue' src/lib/floating/context/FloatingPanelContext.ts && grep -q 'useFloatingPanelContext' src/lib/floating/context/FloatingPanelContext.ts` |
| 3 | Old FloatingDimensionContext.tsx deleted | `[ ! -f src/lib/floating/FloatingDimensionContext.tsx ]` |
| 4 | Old FloatingBoundsContext.tsx deleted | `[ ! -f src/lib/floating/FloatingBoundsContext.tsx ]` |
| 5 | No stale import paths | `! rg "from.*floating/FloatingDimensionContext\|from.*floating/FloatingBoundsContext" src/ --glob '!**/docs/**' --glob '!**/context/**' -l` |
| 6 | All floating tests pass | `npx vitest run src/lib/floating/` |

---

## Phase 4 (#F499) — Hook Extraction

| # | Gate | Command |
|---|------|---------|
| 1 | tsc clean | `npx tsc --noEmit` |
| 2 | useWorkspaceBounds exists | `grep -q 'useWorkspaceBounds' src/lib/floating/hooks/useWorkspaceBounds.ts` |
| 3 | useSnapGuides exists | `grep -q 'useSnapGuides' src/lib/floating/hooks/useSnapGuides.ts` |
| 4 | useDockPreview exists | `grep -q 'useDockPreview' src/lib/floating/hooks/useDockPreview.ts` |
| 5 | useKeyboardNudge exists | `grep -q 'useKeyboardNudge' src/lib/floating/hooks/useKeyboardNudge.ts` |
| 6 | Provider has no inline ResizeObserver | `! grep -q 'new ResizeObserver' src/lib/floating/FloatingPanelProvider.tsx` |
| 7 | Provider ≤ 600 lines | `[ $(wc -l < src/lib/floating/FloatingPanelProvider.tsx) -le 600 ]` |
| 8 | All floating tests pass | `npx vitest run src/lib/floating/` |

---

## Phase 5 (#F500) — Modifier Extraction

| # | Gate | Command |
|---|------|---------|
| 1 | tsc clean | `npx tsc --noEmit` |
| 2 | restrictToWorkspace factory exported | `grep -q 'createRestrictToWorkspace' src/lib/floating/modifiers/restrictToWorkspace.ts` |
| 3 | magneticSnap factory exported | `grep -q 'createMagneticSnap' src/lib/floating/modifiers/magneticSnap.ts` |
| 4 | dockPreview factory exported | `grep -q 'createDockPreviewModifier' src/lib/floating/modifiers/dockPreview.ts` |
| 5 | Provider has zero useCallback<Modifier> | `! grep -q 'useCallback<Modifier>' src/lib/floating/FloatingPanelProvider.tsx` |
| 6 | Modifier unit tests pass (≥6 cases) | `npx vitest run src/lib/floating/modifiers/__tests__/` |
| 7 | All floating tests pass | `npx vitest run src/lib/floating/` |

---

## Phase 6 (#F501) — Overlay Extraction

| # | Gate | Command |
|---|------|---------|
| 1 | tsc clean | `npx tsc --noEmit` |
| 2 | SnapGuideOverlay has ≥3 ref props | `[ $(grep -c 'Ref' src/lib/floating/overlays/SnapGuideOverlay.tsx) -ge 3 ]` |
| 3 | Provider has zero inline guide/preview refs in JSX | `! grep -q 'ref={guideVRef}\|ref={guideHRef}\|ref={dockPreviewRef}' src/lib/floating/FloatingPanelProvider.tsx` |
| 4 | Provider ≤ 400 lines | `[ $(wc -l < src/lib/floating/FloatingPanelProvider.tsx) -le 400 ]` |
| 5 | All floating tests pass | `npx vitest run src/lib/floating/` |

---

## Phase 7 (#F502) — FloatingPanel Compound

| # | Gate | Command |
|---|------|---------|
| 1 | tsc clean | `npx tsc --noEmit` |
| 2 | TitleBar has data-slot=titlebar | `grep -q 'data-slot.*titlebar' src/lib/floating/components/TitleBar.tsx` |
| 3 | PanelControls has role=toolbar | `grep -q 'role.*toolbar' src/lib/floating/components/PanelControls.tsx` |
| 4 | PanelContent has data-slot=content | `grep -q 'data-slot.*content' src/lib/floating/components/PanelContent.tsx` |
| 5 | FloatingPanel ≤ 120 lines | `[ $(wc -l < src/lib/floating/components/FloatingPanel.tsx) -le 120 ]` |
| 6 | Panel has role=dialog + aria-label | `grep -q 'role.*dialog' src/lib/floating/components/FloatingPanel.tsx && grep -q 'aria-label' src/lib/floating/components/FloatingPanel.tsx` |
| 7 | Panel has data-state attribute | `grep -q 'data-state' src/lib/floating/components/FloatingPanel.tsx` |
| 8 | No sub-component > 120 lines | `for f in TitleBar PanelControls PanelContent ChromeBtn; do [ $(wc -l < "src/lib/floating/components/$f.tsx") -le 120 ] \|\| exit 1; done` |
| 9 | Compound render tests pass (≥8 cases) | `npx vitest run src/lib/floating/components/__tests__/` |
| 10 | All floating tests pass | `npx vitest run src/lib/floating/` |

---

## Phase 8 (#F503) — Dead Code + Barrel Cleanup

| # | Gate | Command |
|---|------|---------|
| 1 | tsc clean | `npx tsc --noEmit` |
| 2 | All floating tests pass | `npx vitest run src/lib/floating/ --reporter=verbose` |
| 3 | useResize.ts deleted | `[ ! -f src/lib/floating/hooks/useResize.ts ]` |
| 4 | Provider ≤ 4 useCallback wrappers | `[ $(grep -c 'useCallback' src/lib/floating/providers/FloatingPanelProvider.tsx) -le 4 ]` |
| 5 | Provider ≤ 150 lines | `[ $(wc -l < src/lib/floating/providers/FloatingPanelProvider.tsx) -le 150 ]` |
| 6 | Barrel ≤ 60 lines | `[ $(wc -l < src/lib/floating/index.ts) -le 60 ]` |
| 7 | No stale root-level files | `[ ! -f src/lib/floating/FloatingPanel.tsx ] && [ ! -f src/lib/floating/ResizeHandles.tsx ] && [ ! -f src/lib/floating/FloatingDragOverlay.tsx ] && [ ! -f src/lib/floating/FloatingDimensionContext.tsx ] && [ ! -f src/lib/floating/FloatingBoundsContext.tsx ]` |
| 8 | No hook > 100 lines | `find src/lib/floating/hooks -name '*.ts' ! -name 'index.ts' -exec sh -c '[ $(wc -l < "$1") -le 100 ] \|\| exit 1' _ {} \;` |
| 9 | No modifier > 80 lines | `find src/lib/floating/modifiers -name '*.ts' ! -name 'index.ts' -exec sh -c '[ $(wc -l < "$1") -le 80 ] \|\| exit 1' _ {} \;` |
| 10 | Zero hardcoded hex in components (outside tokens) | `! grep -rn '#[0-9a-fA-F]\{6\}' src/lib/floating/components/ --include='*.tsx' \| grep -v tokens \| grep -v import` |
| 11 | 11 external consumers compile | `npx tsc --noEmit 2>&1 \| grep -c 'floating' \| xargs test 0 -eq` |

---

## Running Gates

All commands assume CWD is `packages/tmnl`. To run a full phase check:

```bash
# Phase 1 example
cd packages/tmnl
npx tsc --noEmit
grep -q 'export const PANEL' src/lib/floating/tokens.ts
for icon in MinimizeIcon CollapseIcon ExpandIcon MaximizeIcon RestoreIcon; do
  grep -q "$icon" src/lib/floating/components/PanelIcons.tsx || echo "MISSING: $icon"
done
! grep -q 'const MinimizeIcon' src/lib/floating/FloatingPanel.tsx && echo "OK: no inline icons"
grep -q "from.*tokens" src/lib/floating/FloatingPanel.tsx && echo "OK: imports from tokens"
npx vitest run src/lib/floating/utils/__tests__/position.test.ts
```

To run ALL final acceptance gates:

```bash
cd packages/tmnl
npx tsc --noEmit
npx vitest run src/lib/floating/ --reporter=verbose
# ... (run each gate from Root Feature table)
```
