# Palette — Widget Reference

> up: ../SKILL.md
> prereqs: none
> update-strategy: re-derive from src-shell/components/CommandPalette.tsx
> update-trigger: palette standalone surface created

## Overview

Command palette (Ctrl+K style) — search, commands, navigation. Currently rendered as a bar component; evolving toward standalone Tauri surface.

## Current State

- Listens via `tmnl:palette-state` Tauri events
- Triggered from bar via keyboard shortcut
- Search, command execution, workspace navigation

## Future

- Standalone Tauri layer-shell surface (Layer::Overlay)
- Separate Vite config + systemd services
- Cross-surface communication via shared PubSub
