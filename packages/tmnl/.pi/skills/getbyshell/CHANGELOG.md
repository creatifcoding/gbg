# getbyshell — Changelog

> up: SKILL.md
> meta: true

## [0.1.0] — 2026-03-03

Skill scaffolded and populated. Diagnosed and fixed panel crash loop (255 restarts) and systemd dependency cycle.

| Action | File | What changed |
|---|---|---|
| `+` | `SKILL.md` | Created. Router covering debugging, per-widget work, Nix modules, surface addition, cross-surface comms. 6 inline sections: systemd topology, failure modes, Nix architecture, adding surfaces, shared infra, file map. |
| `+` | `CHANGELOG.md` | Created. Initial version tracking. |
| `+` | `GRAPH.md` | Created. Full topology: SKILL.md → 8 reference docs + cross-refs to source architecture docs. |
| `+` | `references/INDEX.md` | Created. Router to all reference contents + source architecture doc cross-references. |
| `+` | `references/bar.md` | Created. Bar widget reference: source layout, runtime atom pattern, input region sync, surface width expansion. |
| `+` | `references/panel.md` | Created. Panel widget reference: GTK transplant pattern, SIGUSR1 toggle mechanism, layer-shell properties, common crash causes with fixes. |
| `+` | `references/popover.md` | Created. Popover compound component: Ark UI–inspired API, surface expansion flow. |
| `+` | `references/modal.md` | Created. Modal compound component: full-overlay expansion, version-counter race guards. |
| `+` | `references/calendar.md` | Created. Calendar + Chronicle reference: month grid, rich day entities, lifecycle machine, IIoT Alarm pattern lineage. |
| `+` | `references/logging.md` | Created. Logging pipeline: Effect Logger → Tauri IPC batching → Rust log → journald. Diagnostic commands. |
| `+` | `references/niri.md` | Created. NiriService: Effect.Service API, event flow, atoms driven by compositor events. |
| `+` | `references/palette.md` | Created. Command palette: current event-driven state, standalone surface future. |
