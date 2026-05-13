# GetByGUI — Architecture Specification

> *"The calendar is a portal, not a widget."*

## Vision

GetByGUI is a **personal knowledge operating surface** that masquerades as a calendar. Each day is a rich entity — a container for notes, ideas, tasks, events, moods, and media — rendered on an infinite canvas where morph cards can be spawned, linked, and evolved by an AI analyst agent named **MELANIE**.

The calendar modal is the **entry point**: a fullscreen holographic overlay launched from the TMNL bar that dissolves into a day's canvas view. The canvas hosts the existing collaborative editor (y-sweet, NATS, TipTap) with scoped documents persisted over object store.

---

## System Map

```
TMNL Bar (layer-shell)
  │
  ├── Clock widget ──── click ────┐
  │                               ▼
  │                    ┌──────────────────────────────┐
  │                    │   FULLSCREEN OVERLAY          │
  │                    │   (Holographic Projection)    │
  │                    │                               │
  │                    │   ┌───────────────────────┐   │
  │                    │   │  CALENDAR GRID        │   │
  │                    │   │  Month view           │   │
  │                    │   │  Day cells w/ density  │   │
  │                    │   │  indicators            │   │
  │                    │   └────────┬──────────────┘   │
  │                    │            │ click day         │
  │                    │            ▼                   │
  │                    │   ┌───────────────────────┐   │
  │                    │   │  DAY VIEW             │   │
  │                    │   │  Canvas + Editor      │   │
  │                    │   │  Morph Cards          │   │
  │                    │   │  MELANIE sidebar      │   │
  │                    │   └───────────────────────┘