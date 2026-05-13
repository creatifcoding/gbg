# Calendar — Widget Reference

> up: ../SKILL.md
> prereqs: none
> update-strategy: re-derive from src/lib/getbyshell/calendar/
> update-trigger: calendar schema changes, Chronicle architecture changes

## Overview

Month grid + Chronicle rich day entity system. The most complex widget in GetByShell, modeled after the IIoT Alarm vertical slice pattern (schemas → state → machines → services → atoms → hooks).

## Source Layout

```
src/lib/getbyshell/calendar/
├── ARCHITECTURE.md          # Calendar + Chronicle design spec
├── types.ts                 # Day, DayNote, DayCard, CalendarEvent
├── math.ts                  # Pure date arithmetic (grid building)
├── atoms.ts                 # Calendar state (scoped per RegistryProvider)
├── Calendar.tsx             # Compound: Header + DayLabels + Grid + etc.
├── index.ts
└── chronicle/               # Rich Day entity system
    ├── ARCHITECTURE.md      # Comprehensive architecture spec
    ├── schemas/             # identifiers, day, commands, queries
    ├── state/               # DayState service (InMemory, LocalStorage)
    ├── machines/            # DayMachine + day-state-graph
    ├── services/            # ChronicleService (orchestration)
    ├── atoms/               # chronicleRuntimeAtom + operations
    └── index.ts
```

## Chronicle Day Entity Lifecycle

```
empty → active → rich → archived
```

Days are aggregate entities with: notes, cards, tasks, knowledge links, mood, media. Full lifecycle via XState machine.

## Deep Dive

Read `src/lib/getbyshell/calendar/chronicle/ARCHITECTURE.md` for the comprehensive spec.
