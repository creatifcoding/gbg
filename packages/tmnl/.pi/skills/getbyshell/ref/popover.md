# Popover — Widget Reference

> up: ../SKILL.md
> prereqs: none
> update-strategy: re-derive from src/lib/getbyshell/popover/
> update-trigger: popover API changes, placement logic changes

## Overview

Floating panels that expand from bar items into the overlay zone. Ark UI–inspired compound component with context-scoped state.

## Source Layout

| Location | Purpose |
|----------|---------|
| `src/lib/getbyshell/popover/types.ts` | PopoverPlacement, PopoverRect, PopoverEntry |
| `src/lib/getbyshell/popover/atoms.ts` | activePopoversAtom, input region sync fns |
| `src/lib/getbyshell/popover/Popover.tsx` | Compound: `<Popover>` + `<Popover.Trigger>` + `<Popover.Content>` |
| `src/lib/getbyshell/popover/index.ts` | Exports |

## Usage

```tsx
<Popover id="calendar" placement="right-end">
  <Popover.Trigger><ClockButton /></Popover.Trigger>
  <Popover.Content width={240}><CalendarPanel /></Popover.Content>
</Popover>
```

## Surface Expansion Flow

1. User clicks bar item → Popover opens
2. Bar surface expands from 48px to ~400px (via Rust IPC: `set_surface_width`)
3. Input regions updated (via Rust IPC: `update_input_region`) so transparent backdrop captures clicks
4. Click outside → Popover closes → Surface shrinks back to 48px
