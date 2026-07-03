# GetByShell skill update — panel mechanisms

Date: 2026-06-26
Task: #4841 Update GetByShell skill/docs with learned panel mechanisms
Feature: #F1347 GetByShell panel parity recovery

## Files updated

- `/home/getbygenius/.pi/agent/skills/getbyshell/SKILL.md`
- `/home/getbygenius/.pi/agent/skills/getbyshell/references/surfaces/panel.md`
- `/home/getbygenius/.pi/agent/skills/getbyshell/references/state/REF.md`
- `/home/getbygenius/.pi/agent/skills/getbyshell/references/runtime/REF.md`
- `/home/getbygenius/.pi/agent/skills/getbyshell/CHANGELOG.md`

## Mechanisms documented

- `tmnl-panel` SIGUSR1 trigger was healthy; parity failure was frontend/runtime coupling.
- Standalone panel imports canonical `@/index.css` and locally enforces the 12/14/16 typography floor.
- Standalone panel uses `<PanelWorkspaceOverlay host="standalone">` instead of inheriting AppShell grid placement assumptions.
- Standalone close/Alt+P routes through Tauri `close_panel`; main app keeps overlay atom fallback.
- `tmnl:panel-state=false` closes `panelOverlayOpenAtom` to avoid Rust/React visibility divergence.
- First-run STX sentinel is `leaf(WORKSPACE_SENTINEL)` and should be replaced only by STX operations like `spawnPanel()`.
- First-run palette offers `morphchat:harness`, `morphchat`, and `muse:log`; `spawnPanel('empty')` should not be advertised until an empty visitor exists.
- Standalone dev needs `/api/harness` proxy in `vite.config.panel.ts` for same-origin harness WebSocket routing.
- `stateTier: 'full'` panels require strip overscan scanning all panel IDs in a split column.
- Session drawer remains reachable in idle/error harness states; `NEW` remains connected-only.
- Current persistence cannot resurrect panel instances/content/tree/strip from version 1; richer version 2 effect path is not yet provider-restored.
- Correct regression command is `bunx vitest run ...`, not native `bun test`.
- Validation caveats: no `build:panel` script; direct panel Vite build timed out; `panel:smoke` needs a mounted agent-browser app and does not prove standalone Tauri panel parity by itself.

## Validation / checks

- `ms.profile('getbyshell')` still reports `missing`, matching the known metaskill/tooling issue from the continuation context. Direct skill files remain source of truth.
- Source grep confirmed the new mechanism sections and intentional warnings are present.
- A first grep attempt timed out because shell backticks in the pattern invoked command substitution; rerun with single-quoted pattern succeeded. Mechanism recorded here to avoid repeating that mistake.
