# GetByShell Calendar — Architecture & Design Specification

> **Codename**: CHRONICLE
> **Status**: Design Phase
> **Owner**: Val (architecture) + Melanie (knowledge layer)

---

## 1. Vision

A **fullscreen modal calendar** that launches from the shell bar with a **holographic projection** entrance animation. Each day is a rich entity containing notes, morph cards, events, tasks, knowledge links, mood tracking, and media. Days render on a custom canvas surface (the existing TMNL collaborative editor with y-sweet/NATS/prose/tiptap) where morph cards can be spawned, linked, and manipulated. Melanie (the knowledge agent) connects everything.

### Aesthetic

**Holographic Projection** — Light bloom → wireframe grid → solid elements materializing. The bar cracks open with phosphor light, a grid unfolds from the origin point, and calendar elements phase in with choreographed stagger. Every element has intentional entrance choreography.

---

## 2. System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        GetByShell Bar (48px)                         │
│  ┌──────┐                                                            │
│  │Clock │──click──▶ FULLSCREEN OVERLAY (holographic entrance)        │
│  └──────┘          ┌─────────────────────────────────────────────┐  │
│                    │              CHRONICLE MODAL                 │  │
│                    │  ┌─────────┬───────────────────────────────┐│  │
│                    │  │ MONTH   │         DAY CANVAS            ││  │
│                    │  │ GRID    │  ┌─────────────────────────┐  ││  │
│                    │  │         │  │   Collaborative Editor   │  ││  │
│                    │  │ ┌─────┐ │  │   (y-sweet + tiptap)    │  ││  │
│                    │  │ │ Day │ │  │                          │  ││  │
│                    │  │ │cells│ │  │  ┌──────┐  ┌──────┐     │  ││  │
│                    │  │ │     │ │  │  │Morph │  │Morph │     │  ││  │
│                    │  │ └─────┘ │  │  │Card  │  │Card  │     │  ││  │
│                    │  │         │  │  └──────┘  └──────┘     │  ││  │
│                    │  │ EVENTS  │  │                          │  ││  │
│                    │  │ PANEL   │  │  Notes, tasks, links...  │  ││  │
│                    │  └─────────┴───────────────────────────────┘││  │
│                    │                                             │  │
│                    │  ┌─ MELANIE STATUS BAR ─────────────────┐   │  │
│                    │  │ "3 connections found" │ 📊 │ 🔍 │ ⚡ │   │  │
│                    │  └──────────────────────────────────────┘   │  │
│                    └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Entrance Animation — Holographic Projection

### Sequence (total: ~800ms)

| Phase | Time | Element | Animation |
|-------|------|---------|-----------|
| 0 | 0ms | **Bloom** | Phosphor light burst from clock position, circular expand |
| 1 | 80ms | **Backdrop** | Vantablack `rgba(0,0,0,0.96)` fade + 12px blur |
| 2 | 120ms | **Grid lines** | Wireframe grid draws from center outward (SVG stroke-dasharray) |
| 3 | 200ms | **Container** | Scale 0.92→1.0, opacity 0→1, spring physics |
| 4 | 280ms | **Month header** | Slide down + fade, phosphor glow text |
| 5 | 320ms | **Day labels** | Stagger fade (25ms per label, left→right) |
| 6 | 400ms | **Day cells** | Cascade fill: top-left → bottom-right diagonal wave (15ms stagger per cell) |
| 7 | 550ms | **Today cell** | Scale pop 1.0→1.15→1.0, phosphor ring pulse |
| 8 | 650ms | **Side panel** | Slide from right edge, spring |
| 9 | 750ms | **Melanie bar** | Fade in bottom, typewriter status text |

### Exit (total: ~400ms)

| Phase | Time | Element | Animation |
|-------|------|---------|-----------|
| 0 | 0ms | **Side panel** | Slide right + fade |
| 1 | 50ms | **Day cells** | Reverse cascade (bottom-right → top-left, 8ms stagger) |
| 2 | 150ms | **Grid/container** | Scale 1.0→0.96, opacity→0 |
| 3 | 250ms | **Backdrop** | Fade out |
| 4 | 350ms | **Bloom** | Reverse bloom (collapse to clock position) |

### Implementation Notes

- All animations via `motion/react` (framer-motion v12)
- Spring physics: `stiffness: 400-500, damping: 25-35`
- Easing for stagger: `[0.16, 1, 0.3, 1]` (custom cubic-bezier)
- Grid wireframe: SVG `<line>` elements with `strokeDasharray` + `strokeDashoffset` animation
- Bloom: radial gradient expanding from clock trigger position
- Use `AnimatePresence` with `mode="sync"` for coordinated enter/exit
- Day cascade: `custom` variant with `(i) => ({ delay: i * 0.015 })` based on Manhattan distance from top-left

---

## 4. Day Entity — Effect Schema

```typescript
// src/lib/getbyshell/calendar/types.ts (extending existing)

class Day extends Schema.TaggedClass<Day>()('Day', {
  /** ISO date string: "2026-02-20" */
  dateKey: DateKey,

  /** Freeform notes (markdown, stored in collaborative editor) */
  notes: Schema.Array(DayNote),

  /** Morph cards spawned on this day's canvas */
  cards: Schema.Array(DayCard),

  /** Time-boxed events */
  events: Schema.Array(CalendarEvent),

  /** Checkable tasks */
  tasks: Schema.Array(DayTask),

  /** Knowledge links (Melanie's domain) */
  links: Schema.Array(KnowledgeLink),

  /** Daily mood/status */
  mood: Schema.optional(DayMood),

  /** Media attachments */
  media: Schema.Array(MediaAttachment),

  /** Metadata */
  createdAt: Schema.DateFromSelf,
  updatedAt: Schema.DateFromSelf,

  /** Collaborative document ID (y-sweet) */
  documentId: Schema.optional(Schema.String),
}) {
  get isEmpty() {
    return (
      this.notes.length === 0 &&
      this.cards.length === 0 &&
      this.events.length === 0 &&
      this.tasks.length === 0 &&
      this.links.length === 0 &&
      !this.mood &&
      this.media.length === 0
    )
  }

  get taskCompletion() {
    if (this.tasks.length === 0) return null
    const done = this.tasks.filter(t => t.completed).length
    return { done, total: this.tasks.length, ratio: done / this.tasks.length }
  }
}
```

### Sub-Entities

```typescript
const DayNote = Schema.TaggedClass<DayNote>()('DayNote', {
  id: Schema.String,
  content: Schema.String,  // Markdown
  createdAt: Schema.DateFromSelf,
  tags: Schema.Array(Schema.String),
})

const DayCard = Schema.TaggedClass<DayCard>()('DayCard', {
  id: Schema.String,
  cardId: Schema.String,         // Reference to MorphCard instance
  position: Schema.Struct({ x: Schema.Number, y: Schema.Number }),
  sizeKey: CardMode,              // From morph-card schemas
  title: Schema.String,
  content: Schema.String,
  createdAt: Schema.DateFromSelf,
})

const DayTask = Schema.TaggedClass<DayTask>()('DayTask', {
  id: Schema.String,
  title: Schema.String,
  completed: Schema.Boolean,
  priority: EventPriority,
  dueTime: Schema.optional(Schema.String),
  piTaskId: Schema.optional(Schema.String),  // Link to PI task system
})

const KnowledgeLink = Schema.TaggedClass<KnowledgeLink>()('KnowledgeLink', {
  id: Schema.String,
  sourceId: Schema.String,        // Entity ID (note, card, task)
  sourceType: Schema.Literal('note', 'card', 'task', 'event', 'day'),
  targetId: Schema.String,
  targetType: Schema.Literal('note', 'card', 'task', 'event', 'day'),
  relationship: Schema.Literal('references', 'continues', 'contradicts', 'supports', 'inspired-by'),
  confidence: Schema.Number,       // 0.0-1.0, Melanie's certainty
  discoveredBy: Schema.Literal('user', 'melanie'),
  createdAt: Schema.DateFromSelf,
})

const DayMood = Schema.TaggedClass<DayMood>()('DayMood', {
  energy: Schema.Literal('high', 'medium', 'low'),
  focus: Schema.Literal('high', 'medium', 'low'),
  sentiment: Schema.Literal('positive', 'neutral', 'negative'),
  tags: Schema.Array(Schema.String),
  note: Schema.optional(Schema.String),
})

const MediaAttachment = Schema.TaggedClass<MediaAttachment>()('MediaAttachment', {
  id: Schema.String,
  type: Schema.Literal('image', 'file', 'screenshot', 'audio', 'video'),
  url: Schema.String,              // Object store URL
  filename: Schema.String,
  mimeType: Schema.String,
  size: Schema.Number,
  createdAt: Schema.DateFromSelf,
})
```

---

## 5. State Architecture — Atom-as-State

```
┌──────────────────────────────────────────────────────────────┐
│                    RegistryProvider (per modal)                │
│                                                                │
│  ┌─ Writable Atoms ───────────────────────────────────────┐   │
│  │ isOpenAtom          : boolean                          │   │
│  │ viewYearAtom        : number                           │   │
│  │ viewMonthAtom       : number                           │   │
│  │ selectedDayAtom     : DateKey | null                   │   │
│  │ activeDayAtom       : Day | null (loaded from store)   │   │
│  │ daysMapAtom         : Map<DateKey, DaySummary>         │   │
│  │ entrancePhaseAtom   : 'idle'|'bloom'|'grid'|'fill'     │   │
│  │ sidePanelTabAtom    : 'notes'|'cards'|'events'|'tasks' │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                │
│  ┌─ Derived Atoms ────────────────────────────────────────┐   │
│  │ monthGridAtom       : DayMeta[][] (existing)           │   │
│  │ dayTaskCompletionAtom : { done, total, ratio }         │   │
│  │ dayEventCountAtom   : number                           │   │
│  │ melanieInsightsAtom : Insight[]                        │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                │
│  ┌─ Runtime Atoms ────────────────────────────────────────┐   │
│  │ chronicleRuntimeAtom = Atom.runtime(                   │   │
│  │   Layer.mergeAll(                                      │   │
│  │     DayService.Default,                                │   │
│  │     CollaborationServiceLive,                          │   │
│  │     MelanieService.Default,                            │   │
│  │   )                                                    │   │
│  │ )                                                      │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                │
│  ┌─ Ops (chronicleRuntimeAtom.fn) ────────────────────────┐   │
│  │ openChronicle    : (fromRect) => Effect                │   │
│  │ closeChronicle   : () => Effect                        │   │
│  │ selectDay        : (dateKey) => Effect (loads Day)     │   │
│  │ saveNote         : (dayKey, note) => Effect            │   │
│  │ spawnCard        : (dayKey, position) => Effect        │   │
│  │ addTask          : (dayKey, task) => Effect            │   │
│  │ toggleTask       : (dayKey, taskId) => Effect          │   │
│  │ setMood          : (dayKey, mood) => Effect            │   │
│  │ askMelanie       : (query) => Effect<Insight[]>        │   │
│  └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. Canvas Integration

Each Day's canvas is a **collaborative editor** instance:

- **Document storage**: y-sweet (CRDT sync) via existing `CollaborationService`
- **Editor**: TipTap/ProseMirror (existing `CollaborativeTiptapEditor`)
- **Document scoping**: Each Day has a unique `documentId` → maps to a y-sweet doc
- **Morph cards**: Rendered as custom TipTap node views or floating overlays on the canvas
- **Object store persistence**: Documents + media attachments persisted to custom object store (S3-compatible)

### Document Scoping Strategy

```
Day "2026-02-20" → documentId: "chronicle:2026-02-20"
Day "2026-02-21" → documentId: "chronicle:2026-02-21"
```

Each day gets its own y-sweet document. The collaborative editor connects to the day's doc when the user selects that day. This gives us:
- Per-day CRDT history
- Independent sync per day
- Easy export/backup per day
- Scoped presence (who's looking at this day)

---

## 7. Melanie Integration Points

| Hook | Trigger | Response |
|------|---------|----------|
| `onDayOpen` | User selects a day | Pre-load related cards, surface connections |
| `onNoteCreate` | User writes a note | Background: find similar notes from other days |
| `onCardSpawn` | New morph card | Suggest tags, auto-link to related cards |
| `onWeekStart` | Monday morning | Generate weekly digest of last week |
| `onSearch` | User queries | Semantic search across all days + cards |

---

## 8. File Structure

```
src/lib/getbyshell/calendar/
├── ARCHITECTURE.md          # This document
├── types.ts                 # Effect Schema: Day, DayNote, DayCard, etc.
├── math.ts                  # Pure date arithmetic (existing)
├── atoms.ts                 # Atom-as-State: month grid atoms (existing)
├── Calendar.tsx             # Compound component: month grid (existing)
├── index.ts                 # Public API (existing)
├── chronicle/
│   ├── types.ts             # Chronicle-specific schemas (Day entity, full)
│   ├── atoms.ts             # Fullscreen modal state + ops
│   ├── Chronicle.tsx         # Fullscreen modal compound component
│   ├── ChronicleEntrance.tsx # Holographic entrance animation
│   ├── MonthGrid.tsx         # Enhanced month grid for chronicle
│   ├── DayCanvas.tsx         # Day detail view with collaborative editor
│   ├── DaySidePanel.tsx      # Notes/cards/events/tasks tabs
│   ├── MelanieBar.tsx        # Bottom status bar (Melanie's presence)
│   └── index.ts              # Public API
└── docs/                     # Design documents, specs

src/lib/maidens/melanie/
├── AGENTS.md                # Persona definition (done)
├── types.ts                 # Melanie service schemas
├── service.ts               # MelanieService (Effect.Service)
├── tools/                   # Tool implementations
│   ├── search.ts            # Semantic search
│   ├── link.ts              # Auto-link discovery
│   ├── summarize.ts         # Summarization
│   └── suggest.ts           # Proactive suggestions
├── atoms.ts                 # Melanie state atoms
└── index.ts                 # Public API
```

---

## 9. Dependencies

### Existing (already in TMNL)
- `motion/react` (v12.34.3) — All animations
- `@effect-atom/atom-react` — State management
- `effect` — Services, Schema, Runtime
- y-sweet + TipTap — Collaborative editor
- NATS — Real-time sync
- MorphCard system — Card spawning + rendering

### New
- Object store client (S3-compatible) — Document + media persistence
- Vector embeddings (for Melanie's semantic search) — via PI extensions or local model

---

## 10. Open Questions

1. **Object store**: MinIO (self-hosted) or cloud S3? Or abstract behind Effect service?
2. **Vector embeddings**: Local model (via Ollama) or API (OpenAI embeddings)?
3. **Melanie's autonomy**: How proactive should she be? Background processes or on-demand only?
4. **Multi-day views**: Week view? Timeline view? Or just month grid + day detail?
5. **Mobile/touch**: The shell bar is desktop-only (Wayland). Does the calendar need touch support?
6. **Keyboard navigation**: Full vim-style bindings for the month grid? (h/j/k/l, enter to open day)
