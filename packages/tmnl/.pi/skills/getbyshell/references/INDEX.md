# getbyshell — References

> up: ../SKILL.md
> prereqs: none
> provides: reference-index
> children: bar.md, panel.md, popover.md, modal.md, calendar.md, logging.md, niri.md, palette.md

## Contents

| File | When to read |
|---|---|
| `bar.md` | Working on the 48px vertical strip, workspace indicators, clock, input regions |
| `panel.md` | Working on the overlay panel, debugging GTK transplant or SIGUSR1 toggle |
| `popover.md` | Working on floating panels, compound component API, surface expansion |
| `modal.md` | Working on full-overlay panels, surface width sync |
| `calendar.md` | Working on month grid or Chronicle day entities |
| `logging.md` | Working on the Effect Logger → Tauri IPC → journald pipeline |
| `niri.md` | Working on NiriService, workspace/window atoms, compositor events |
| `palette.md` | Working on the command palette or planning standalone surface |

## Source Architecture Docs (Cross-References)

| Document | Path | Description |
|----------|------|-------------|
| AGENTS.md | `src/lib/getbyshell/AGENTS.md` | System overview, architecture principles, widget map |
| Nix SPEC.md | `nix/lib/getbyshell/SPEC.md` | Nix library implementation specification |
| IDE Architecture | `assets/documents/GETBYSHELL_IDE_ARCHITECTURE.md` | Monaco editor integration (future) |
| Calendar Architecture | `src/lib/getbyshell/calendar/ARCHITECTURE.md` | Calendar + month grid design |
| Chronicle Architecture | `src/lib/getbyshell/calendar/chronicle/ARCHITECTURE.md` | Rich day entity system |

## External References

- [Tauri v2 docs](https://v2.tauri.app)
- [gtk-layer-shell](https://github.com/wmww/gtk-layer-shell)
- [niri compositor](https://github.com/YaLTeR/niri)
- [Effect-TS](https://effect.website)
