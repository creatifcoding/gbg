# GetByShell `tmnl-panel` first-run/default experience remediation

Date: 2026-06-26
Task: #4837 Fix first-run/default panel experience
Feature: #F1347 GetByShell panel parity recovery

## File changed

- `src/lib/floating/overlay/PanelWorkspace.tsx`

## Changes

1. Replaced the single ambiguous empty-state plus button with a canonical launch palette.

   The sentinel state now presents:

   - **Live Conductor** — spawns `morphchat:harness` tiled.
   - **Demo Conductor** — spawns `morphchat` tiled.
   - **Muse Log** — spawns `muse:log` floating.

   All launches still go through `spawnPanel()`, so STX remains the authority for replacing `WORKSPACE_SENTINEL`, setting active focus, updating strip columns, and registering panel lifecycle.

2. Fixed action-bar spawn affordances:

   - `+ Demo` now spawns the mock/local `morphchat` visitor.
   - `+ Live` now spawns the harness-backed `morphchat:harness` visitor as tiled workspace content.
   - `+ Muse` spawns `muse:log` as a floating stream surface.

3. Removed the broken `+ Empty` path.

   `spawnPanel('empty')` had no registered visitor, so it produced an unknown visitor panel. The first-run surface no longer advertises that trap.

4. Preserved typography floor.

   The rewritten launch palette uses `var(--tmnl-text-xs, 12px)` and `var(--tmnl-text-sm, 14px)` only; no hard-coded sub-12px text was introduced.

## Validation performed

Passed typography/import hygiene check:

```bash
rg -n "useRef|fontSize:\\s*(?:'|\\\")?(?:[0-9](?:px)?|10(?:px)?|11(?:px)?)(?:'|\\\")?|text-\\[(?:[0-9]|10|11)px\\]|spawnPanel\\('empty'|\\+ Empty|Unknown visitor: empty" \
  src/lib/floating/overlay/PanelWorkspace.tsx -S || true
```

Result: no output.

Passed browser transpile smoke:

```bash
bun build src-panel/panel-entry.tsx src/lib/floating/overlay/index.tsx src/lib/floating/overlay/PanelWorkspace.tsx \
  --target browser --outdir /tmp/tmnl-panel-check-browser \
  --external '@/*' --external '@tauri-apps/*' --external '@effect-atom/*' \
  --external '@legendapp/*' --external '@dnd-kit/*' --external effect \
  --external react --external react-dom --external react-dom/client
```

Result: bundled edited TSX entry points successfully.

## Remaining caveats

- This still does not auto-spawn on panel open; it offers canonical launch paths. That avoids surprising live harness sessions and preserves sentinel semantics.
- Live `morphchat:harness` still depends on the harness remote WS being available. #4836 added the standalone panel Vite proxy, but no live service smoke was run under the current no-live-restart/no-signal constraint.
