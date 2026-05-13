# getbyshell — Skill Graph

> up: SKILL.md
> prereqs: none
> provides: full-topology
> children: none
> meta: true

## Topology

```
SKILL.md                                      # Router + 6 inline sections + failure modes
├──[routes]─→ GRAPH.md                        # This file
├──[routes]─→ CHANGELOG.md                    # Version history
│
├──[routes]─→ references/INDEX.md             # Reference router
│   ├──[contains]─→ bar.md                    # Bar widget: 48px strip, atoms, input regions
│   ├──[contains]─→ panel.md                  # Panel widget: GTK transplant, SIGUSR1, crash fixes
│   ├──[contains]─→ popover.md                # Popover compound component, surface expansion
│   ├──[contains]─→ modal.md                  # Modal compound component, full-overlay expansion
│   ├──[contains]─→ calendar.md               # Calendar + Chronicle day entity system
│   ├──[contains]─→ logging.md                # Effect Logger → Tauri IPC → journald pipeline
│   ├──[contains]─→ niri.md                   # NiriService: compositor bridge, workspace/window atoms
│   └──[contains]─→ palette.md                # Command palette (evolving toward standalone)
│
├──[cross]──→ src/lib/getbyshell/AGENTS.md    # Source-of-truth architecture reference
├──[cross]──→ nix/lib/getbyshell/SPEC.md      # Nix library implementation specification
├──[cross]──→ assets/documents/GETBYSHELL_IDE_ARCHITECTURE.md  # Monaco editor integration (future)
└──[cross]──→ src/lib/getbyshell/calendar/chronicle/ARCHITECTURE.md  # Chronicle deep-dive
```

## Surface ↔ Source Mapping

```
references/bar.md      ←→  src/lib/getbyshell/ + src-shell/ + src-shell-tauri/
references/panel.md    ←→  src-panel-tauri/
references/popover.md  ←→  src/lib/getbyshell/popover/
references/modal.md    ←→  src/lib/getbyshell/modal/
references/calendar.md ←→  src/lib/getbyshell/calendar/ + chronicle/
references/logging.md  ←→  src/lib/getbyshell/logging/
references/niri.md     ←→  src/lib/getbyshell/niri.ts
references/palette.md  ←→  src-shell/components/CommandPalette.tsx
```

## Nix Module ↔ Service Mapping

```
nix/lib/getbyshell/surface.nix    → generates tmnl-{name}.service + tmnl-{name}-vite.service
nix/lib/getbyshell/target.nix     → generates getbyshell.target
nix/lib/getbyshell/health-check.nix → generates tmnl-{name}-vite-health ExecStartPre
nix/lib/getbyshell/mission-control.nix → generates getbyshell-{start,stop,restart,logs,status} scripts
nix/lib/getbyshell/hm-module.nix  → Home-Manager consumer module (gbg.getbyshell.surfaces.{...})
```

## Counts

| Metric | Value |
|---|---|
| Skill doc nodes | 12 |
| Reference docs | 8 |
| Cross-references | 4 (source architecture docs) |
| Surfaces (active) | 2 (bar, panel) |
| Surfaces (planned) | 1 (palette standalone) |
| Systemd units | 5 (2 × service pairs + 1 target) |
| Nix lib files | 8 |
