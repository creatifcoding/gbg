# GetByShell `tmnl-panel` STX workspace initialization and persistence debug

Date: 2026-06-26
Task: #4834 Debug STX workspace initialization and persistence
Feature: #F1347 GetByShell panel parity recovery

## Scope

Static diagnosis only. No live service restart, compositor reload, relogin, Nix switch, or additional panel signal was run for this task.

## Grounding sources

- `src-panel/panel-entry.tsx`
- `src/lib/floating/overlay/PanelWorkspace.tsx`
- `src/lib/floating/overlay/index.tsx`
- `src/lib/floating/FloatingPanelProvider.tsx`
- `src/lib/floating/hooks/usePanelPersistence.ts`
- `src/lib/floating/stx/initial.ts`
- `src/lib/floating/stx/constants.ts`
- `src/lib/floating/stx/effects.ts`
- `src/lib/floating/stx/spawn.ts`
- `src/lib/floating/stx/visibility.ts`
- `src/lib/floating/visitors/index.ts`

## Observed mechanisms

### 1. Initialization is sentinel-based, not content-seeded

`initialData.panelTree` starts as `null` in `src/lib/floating/stx/initial.ts`.

`PanelWorkspace.useInitializeWorkspace()` runs on mount and, only when `panelTree` is completely empty, writes:

```ts
stx.data.panelTree.set(leaf(WORKSPACE_SENTINEL))
```

`WorkspaceContent` treats `leaf(WORKSPACE_SENTINEL)` as an effectively empty workspace and renders `EmptyState`.

**Verdict:** first-open behavior is intentionally empty. The panel does not seed canonical content on show; the user must click empty state or use the action bar. This explains the “blank / not like TMNL panels” impression after the runtime trigger succeeds.

### 2. `spawnPanel()` correctly replaces the sentinel for the first tiled panel

`src/lib/floating/stx/spawn.ts` checks:

```ts
const isSentinel = currentTree && isLeaf(currentTree) && currentTree.panelId === WORKSPACE_SENTINEL
```

When true, `spawnPanel(..., { mode: 'tiled' })` replaces the sentinel with `leaf(newId)`, removes the tiled panel from `zOrder`, sets the panel mode to `tiled`, and sets `activePanel` to the new id. It also inserts a column into the strip model.

**Verdict:** STX spawn semantics are sound for first tiled panel creation. The mismatch is the absence of an initial seed/affordance parity, not a broken sentinel replacement.

### 3. Strip is the default visible layout authority

`PanelWorkspace.tsx` defines:

```ts
const layoutMode$ = observable<LayoutMode>('strip')
```

When `hasTiledLayout` is true and mode is `strip`, `WorkspaceContent` renders `ScrollStrip`; otherwise it renders `SplitContainer`.

**Verdict:** canonical current workspace presentation is strip-first. Any remediation should preserve STX strip authority instead of inventing React-local layout truth.

### 4. Persistence is split across two incompatible mechanisms

There are two persistence paths using the same storage key `tmnl-floating-panels`:

1. `src/lib/floating/hooks/usePanelPersistence.ts`
   - Restores via `restorePersistedState(storage)`.
   - Persists `PanelStorage` version `1` with `panels` and `order` only.
   - Does **not** persist `panelTree`.
   - Does **not** persist `strip`.

2. `src/lib/floating/stx/effects.ts`
   - `floatingEffects.persist` writes version `2` and includes serialized `panelTree`.
   - `floatingEffects.restore` can deserialize `panelTree`.
   - This effect path is not the one used by `FloatingPanelProvider`; provider calls `usePanelPersistence()`.

`restorePersistedState()` in `src/lib/floating/stx/visibility.ts` only applies data to already-registered panels and recomputes `zOrder` from existing ids. It does not re-register missing panels and does not reconstruct the strip.

**Verdict:** persistence cannot restore a standalone panel workspace faithfully after a reload. It can adjust existing registered panel positions/visibility, but it cannot resurrect panel instances, content visitors, the panel tree, or strip columns. This is a real persistence parity gap.

### 5. Visitor registration is self-contained in `PanelWorkspace`, but main app has extra side-effect registrations

`PanelWorkspace.tsx` calls `registerAllVisitors()` at module load, which registers:

- `morphchat`
- `morphchat:harness`
- geoint visitors
- muse log visitor

The main app additionally side-effect imports other panels in `src/main.tsx`, such as:

- `@/lib/egui/panels`
- `@/lib/code-editor/panels/CodeEditorPanel`

`src-panel/panel-entry.tsx` does not import those side-effect registration modules.

**Verdict:** MorphChat/harness visitors are available in standalone panel, but full main-app visitor parity is not guaranteed.

### 6. Overlay test snapshot currently reports DOM presence, not atom-open state

`src/lib/floating/overlay/index.tsx` exposes `window.__PANEL_TEST__.snapshot()` in dev. It currently returns:

```ts
overlayOpen: !!document.querySelector('[data-panel-workspace-overlay]')
```

The overlay is deliberately always mounted, so this value is true even when the overlay atom is closed.

**Verdict:** snapshot `overlayOpen` is not reliable for regression assertions. It should read `panelOverlayRegistry.get(panelOverlayOpenAtom)` or reuse `isOpen()`.

### 7. Standalone close path is only React-local today

`PanelWorkspace.WorkspaceActionBar` calls `closePanelOverlay()`. In the standalone `tmnl-panel` process that only closes the React overlay atom; it does not invoke the Tauri `close_panel` command that hides the layer-shell surface.

`src-panel/panel-entry.tsx` listens for `tmnl:panel-state`; when true it calls `openPanelOverlay()`, but when false it only updates the local `visible` React state.

**Verdict:** runtime visibility and React overlay visibility can diverge. This explains a class of “closed but surface still active / hidden but overlay stale” issues.

## Debug conclusion

STX itself is not the primary failure. The state authority is coherent for first spawn and strip/tree layout, but the standalone shell fails to provide canonical boot context:

- no canonical CSS import;
- no standalone overlay host mode;
- close path does not bridge back to Tauri;
- false runtime state does not close the overlay atom;
- first-open content is intentionally empty;
- persistence cannot reconstruct workspace content/tree/strip;
- dev snapshot lies about `overlayOpen`.

## Recommended remediation order

1. Import canonical CSS in `src-panel/panel-entry.tsx`, with standalone font-size guard preserving the 12px floor.
2. Add a standalone host mode to `PanelWorkspaceOverlay` so the component can fill a Tauri layer-shell surface without AppShell grid assumptions.
3. Add an optional `onRequestClose` prop to `PanelWorkspace`; default remains `closePanelOverlay`, standalone passes `dismissPanel`.
4. On `tmnl:panel-state=false`, close the overlay atom in `src-panel/panel-entry.tsx`.
5. Fix `__PANEL_TEST__.snapshot().overlayOpen` to read the atom state.
6. Defer full persistence repair until after parity basics; real restore needs panel instance reconstruction and strip/tree persistence, not just `restorePersistedState()`.

## Validation note

A first attempt used `bun test` directly for Vitest files and timed out after printing only the Bun banner. Mechanism: repository test scripts use Vitest (`bunx vitest run ...` / `bun run test:run`), not Bun’s native test runner. Future validation should use the Vitest command from `package.json`.
