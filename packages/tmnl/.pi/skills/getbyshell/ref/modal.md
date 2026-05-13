# Modal — Widget Reference

> up: ../SKILL.md
> prereqs: none
> update-strategy: re-derive from src/lib/getbyshell/modal/
> update-trigger: modal API changes, surface sync logic changes

## Overview

Full-overlay panels that take over the entire screen right of the bar strip. Used for Chronicle, settings, and other full-screen experiences.

## Source Layout

| Location | Purpose |
|----------|---------|
| `src/lib/getbyshell/modal/types.ts` | ModalEntrance, ModalRect, ModalEntry |
| `src/lib/getbyshell/modal/atoms.ts` | Module store (useSyncExternalStore), surface sync |
| `src/lib/getbyshell/modal/Modal.tsx` | Compound: `<Modal>` + `<Modal.Trigger>` + `<Modal.Content>` |
| `src/lib/getbyshell/modal/index.ts` | Exports |

## Surface Expansion

Modals expand the bar surface to **full monitor width** via `set_surface_width`. A version-counter guards prevent async race conditions between rapid open/close surface syncs.
