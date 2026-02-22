# Splash V2 — Real Boot Trace + Wordmark + Route Preloader

> Feature: `#F405`
> Status: **Planned**
> Deps: React + GSAP (`useGSAP` hook) + CSS. Zero animatable/effect-atom/Three.js.

## Why

The old splash (`Splash.tsx`, `CRTEffect.tsx`, `LogoReveal.tsx`, `TerminalInit.tsx`) is:

1. **Never mounted** — not in `main.tsx` render tree. Dead code.
2. **Broken** — depends on `animatable()` system which doesn't work.
3. **Heavy** — pulls GSAP, Three.js, effect-atom, custom animation atoms for a boot screen nobody sees.
4. **1,738 lines** across 8 files for zero functionality.

The theater approach (fake boot lines on a timer) is also trash. If we're showing boot
lines, they should reflect what's **actually happening**. This is a desktop app — the
boot screen is the first thing a user sees. It should be honest.

## Design

### Philosophy: Honest Boot Trace

Every line on the splash represents a **real initialization event**. The splash is a
live terminal that subscribes to a lightweight boot trace bus. Providers, services,
and side-effect imports report their status as they mount. The splash renders each
trace as it arrives.

This makes the splash:
- **Diagnostic** — if something is slow, you SEE which step is blocking
- **Adaptive** — splash duration matches actual boot time, not a fixed timer
- **Honest** — developers and users see real telemetry, not fiction
- **Useful for profiling** — boot trace data persists for performance analysis

### Aesthetic

**Q-Branch Brutalist** — warm gray palette, VT323 monospace, mechanical timing.
Feels like launching a serious tool, not loading a website.

### Dependency Budget

| Allowed                              | Forbidden                                  |
|--------------------------------------|--------------------------------------------|
| React (already loaded)               | `animatable()` / `useAnimatable()`         |
| GSAP v3.13.0 (already loaded)        | `Animatable.setDriver()` / animation lib   |
| `@gsap/react` v2.1.2 `useGSAP` hook | The broken animation abstraction layer     |
| `effect-atom` / `Atom.make`          |                                            |
| `useAtomValue` for reactive state    |                                            |
| Three.js / `AsciiScene` (background) |                                            |
| CSS animations / transitions         |                                            |
| VT323 font (already in `index.css`)  |                                            |

**What's broken**: The `animatable()` → `useAnimatable()` → `Animatable.setDriver(gsapDriver)`
pipeline in `src/lib/animation/`. That abstraction layer is dead. GSAP itself is fine.
effect-atom is fine. Three.js is fine.

### CRT Effects (CSS Only)

- **Scanlines**: `repeating-linear-gradient(0deg, transparent 0 1px, rgba(255,252,245,0.03) 1px 2px)` at 8% opacity
- **Vignette**: `radial-gradient(ellipse at 50% 50%, transparent 0% 60%, rgba(0,0,0,0.4) 100%)`
- No canvas, no rAF loops, no moiré rotation.

---

## Boot Trace Architecture — EventLog + effect-atom

### Pattern Source

Follows the canonical overlay system EventLog pattern from `src/lib/overlays/events/`.
Key files to reference:
- `src/lib/overlays/events/container.ts` — EventGroup.empty.add() pattern
- `src/lib/overlays/events/handlers.ts` — EventLog.group() handler registration
- `src/lib/overlays/events/reactivity.ts` — Reactivity keys for auto-invalidation
- `src/lib/overlays/atoms/eventlog.ts` — Atom.runtime() + EventLog layer composition

### File: `src/lib/boot-trace/events.ts` — EventGroup

```typescript
import { EventGroup } from "@effect/experimental"
import { Schema } from "effect"

/**
 * Boot phase discriminator.
 * critical = must complete before app is usable
 * provider = React provider mount
 * service  = background service initialization
 * dev      = dev-only tooling (conditional on import.meta.env.DEV)
 */
export const BootPhase = Schema.Literal("critical", "provider", "service", "dev")
export type BootPhase = typeof BootPhase.Type

/**
 * Boot trace EventGroup — single event type, append-only log.
 *
 * primaryKey is label+timestamp to ensure uniqueness (boot events are
 * one-shot, never updated or conflicted).
 */
export const BootTraceEvents = EventGroup.empty
  .add({
    tag: "BootTraceReported",
    primaryKey: (p) => `${p.label}:${p.timestamp}`,
    payload: Schema.Struct({
      label: Schema.String,           // Subsystem: 'REACT', 'PROVIDER:SCALE', etc.
      status: Schema.String,          // What happened: 'root created', 'mounted'
      timestamp: Schema.Number,       // performance.now()
      phase: BootPhase,
    }),
  })
  .add({
    tag: "BootTraceSealed",
    primaryKey: () => "sealed",
    payload: Schema.Struct({
      totalEntries: Schema.Number,
      totalDurationMs: Schema.Number,
      timestamp: Schema.Number,
    }),
  })
```

### File: `src/lib/boot-trace/handlers.ts` — EventLog Handlers

```typescript
import { EventLog } from "@effect/experimental"
import * as Effect from "effect/Effect"
import * as Ref from "effect/Ref"
import { BootTraceEvents } from "./events"
import { BootTraceService } from "./service"

/**
 * Handlers that update the BootTraceService Ref when events are processed.
 * Follows exact same pattern as ContainerHandlersLive in overlays.
 */
export const BootTraceHandlersLive = EventLog.group(BootTraceEvents, (handlers) =>
  handlers
    .handle("BootTraceReported", ({ payload }) =>
      Effect.gen(function* () {
        const svc = yield* BootTraceService
        yield* svc.append(payload)
      })
    )
    .handle("BootTraceSealed", ({ payload }) =>
      Effect.gen(function* () {
        const svc = yield* BootTraceService
        yield* svc.seal(payload)
      })
    )
)
```

### File: `src/lib/boot-trace/service.ts` — Effect.Service

```typescript
import * as Effect from "effect/Effect"
import * as Context from "effect/Context"
import * as Ref from "effect/Ref"
import * as Layer from "effect/Layer"
import { Schema } from "effect"
import type { BootPhase } from "./events"

export interface BootEntry {
  readonly label: string
  readonly status: string
  readonly timestamp: number
  readonly phase: BootPhase
}

export interface BootTraceServiceShape {
  readonly append: (entry: BootEntry) => Effect.Effect<void>
  readonly seal: (summary: { totalEntries: number; totalDurationMs: number; timestamp: number }) => Effect.Effect<void>
  readonly getAll: Effect.Effect<ReadonlyArray<BootEntry>>
  readonly isSealed: Effect.Effect<boolean>
}

export class BootTraceService extends Context.Tag("tmnl/boot-trace/BootTraceService")<
  BootTraceService,
  BootTraceServiceShape
>() {
  static Default = Layer.effect(
    this,
    Effect.gen(function* () {
      const entriesRef = yield* Ref.make<ReadonlyArray<BootEntry>>([])
      const sealedRef = yield* Ref.make(false)

      return {
        append: (entry) => Ref.update(entriesRef, (prev) => [...prev, entry]),
        seal: (_summary) => Ref.set(sealedRef, true),
        getAll: Ref.get(entriesRef),
        isSealed: Ref.get(sealedRef),
      }
    })
  )
}
```

### File: `src/lib/boot-trace/atoms.ts` — Atom.runtime + Reactive Queries

```typescript
import { Atom } from "@effect-atom/atom"
import { EventLog, EventJournal, Reactivity } from "@effect/experimental"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Stream from "effect/Stream"
import * as Option from "effect/Option"
import { BootTraceEvents } from "./events"
import { BootTraceService, type BootEntry } from "./service"
import { BootTraceHandlersLive } from "./handlers"

// ─────────────────────────────────────────────────────────────
// Reactivity Keys
// ─────────────────────────────────────────────────────────────

export const Keys = {
  entries: "boot-trace:entries",
  sealed: "boot-trace:sealed",
} as const

// ─────────────────────────────────────────────────────────────
// Reactivity Layer (auto-invalidation on event)
// ─────────────────────────────────────────────────────────────

export const BootTraceReactivityLive = EventLog.groupReactivity(BootTraceEvents, {
  BootTraceReported: [Keys.entries],
  BootTraceSealed: [Keys.sealed, Keys.entries],
})

// ─────────────────────────────────────────────────────────────
// Full Layer
// ─────────────────────────────────────────────────────────────

export const BootTraceLive = Layer.mergeAll(
  BootTraceService.Default,
  EventJournal.layerMemory,
  Reactivity.layer,
).pipe(
  Layer.provideMerge(BootTraceHandlersLive),
  Layer.provideMerge(BootTraceReactivityLive),
)

// ─────────────────────────────────────────────────────────────
// Runtime Atom
// ─────────────────────────────────────────────────────────────

export const bootTraceRuntimeAtom = Atom.runtime(BootTraceLive)

// ─────────────────────────────────────────────────────────────
// Reactive Query Atoms
// ─────────────────────────────────────────────────────────────

/**
 * All boot entries — auto-updates when BootTraceReported fires.
 * Splash component subscribes via useAtomValue(bootEntriesAtom).
 */
export const bootEntriesAtom = bootTraceRuntimeAtom.atom(
  Reactivity.stream(
    [Keys.entries],
    Effect.gen(function* () {
      const svc = yield* BootTraceService
      return yield* svc.getAll
    })
  ).pipe(
    Stream.runLast,
    Effect.map((opt) => Option.getOrElse(opt, () => [] as ReadonlyArray<BootEntry>))
  )
)

/**
 * Sealed state — true when BootTraceSealed fires.
 */
export const bootSealedAtom = bootTraceRuntimeAtom.atom(
  Reactivity.stream(
    [Keys.sealed],
    Effect.gen(function* () {
      const svc = yield* BootTraceService
      return yield* svc.isSealed
    })
  ).pipe(
    Stream.runLast,
    Effect.map((opt) => Option.getOrElse(opt, () => false))
  )
)

// ─────────────────────────────────────────────────────────────
// Operations (write events via EventLog)
// ─────────────────────────────────────────────────────────────

/**
 * Report a boot trace event.
 * Called from providers, main.tsx, service inits.
 */
export const reportBootTrace = bootTraceRuntimeAtom.fn<{
  label: string
  status: string
  phase?: "critical" | "provider" | "service" | "dev"
}>()(({ label, status, phase = "critical" }) =>
  Effect.gen(function* () {
    const log = yield* EventLog
    yield* log.write("BootTraceReported", {
      label,
      status,
      timestamp: performance.now(),
      phase,
    })
  })
)

/**
 * Seal the boot trace. Called when splash completes.
 */
export const sealBootTrace = bootTraceRuntimeAtom.fn<void>()(() =>
  Effect.gen(function* () {
    const log = yield* EventLog
    const svc = yield* BootTraceService
    const entries = yield* svc.getAll
    const duration = entries.length >= 2
      ? entries[entries.length - 1].timestamp - entries[0].timestamp
      : 0
    yield* log.write("BootTraceSealed", {
      totalEntries: entries.length,
      totalDurationMs: duration,
      timestamp: performance.now(),
    })
  })
)
```

### Usage in Providers / main.tsx

```typescript
import { reportBootTrace } from '@/lib/boot-trace/atoms'

// Synchronous call sites — fire and forget
reportBootTrace({ label: 'REACT', status: 'root created', phase: 'critical' })

// In a provider useEffect:
useEffect(() => {
  // ... actual init logic ...
  reportBootTrace({ label: 'PROVIDER:BUFFER', status: 'pool allocated', phase: 'provider' })
}, [])
```

### Usage in Splash Component

```typescript
import { useAtomValue } from "@effect-atom/atom-react"
import { bootEntriesAtom, sealBootTrace } from "@/lib/boot-trace/atoms"
import type { BootEntry } from "@/lib/boot-trace/service"

function Splash({ onComplete }: SplashProps) {
  // Reactive — auto-updates as entries arrive via Reactivity.stream
  const entriesResult = useAtomValue(bootEntriesAtom)
  const entries: ReadonlyArray<BootEntry> = Result.isSuccess(entriesResult)
    ? entriesResult.value
    : []

  // ... render entries, animate with GSAP, dissolve when ready ...

  const handleComplete = () => {
    sealBootTrace()  // seals the EventLog
    onComplete?.()
  }
}
```

---

## Instrumented Boot Sequence

### Where traces fire (in execution order)

```
Location                         Label              Status                          Phase
───────────────────────────────  ─────────────────  ──────────────────────────────  ─────────
src/main.tsx (top of file)       MODULE             evaluating entry point          critical
src/main.tsx (after imports)     CSS                stylesheets loaded              critical
src/main.tsx (createRoot)        REACT              root created                    critical
src/router.tsx (module scope)    ROUTER             route tree compiled             critical
src/main.tsx (render call)       RENDER             mounting component tree         critical

Provider mounts (useEffect):
  OverlayRegistryProvider        PROVIDER:OVERLAY   registry initialized            provider
  DataplaneRegistryProvider      PROVIDER:DATAPLANE registry initialized            provider
  ScaleProvider                  PROVIDER:SCALE     scale=1.0 applied               provider
  VisualOverlayProvider          PROVIDER:VISUAL    overlay slots ready             provider
  BufferProvider                 PROVIDER:BUFFER    buffer pool allocated            provider
  WindowProvider                 PROVIDER:WINDOW    window manager ready            provider

Shell mounts:
  AppShell                       SHELL              layout mounted                  service
  Sidebar                        SIDEBAR            5 items configured              service
  HeaderContent                  HEADER             header band ready               service

Side-effect imports:
  @/lib/variables/v2/config      VARS               variables registered            service
  @/lib/egui/panels              PANELS             panel types registered          service

Dev-only (import.meta.env.DEV):
  browserLogForwarder            DEV:LOGS           log forwarder installed         dev
  react-grab                     DEV:GRAB           element selector loaded         dev
  @react-grab/claude-code        DEV:AGENT          claude-code agent attached      dev
  atom observability             DEV:ATOMS          atom devtools initialized       dev

Route resolution:
  Initial route match            ROUTE              "/" matched → App               critical
  HoundstoothGOL mount           CANVAS             WebGL context acquired          service
```

### Instrumentation Pattern

Each trace is a single line added at the relevant point:

```typescript
// In a provider component:
import { bootTrace } from '@/lib/boot-trace'

export function BufferProvider({ children }: Props) {
  useEffect(() => {
    // ... actual init logic ...
    bootTrace.report('PROVIDER:BUFFER', 'buffer pool allocated', 'provider')
  }, [])
  return <BufferContext.Provider value={...}>{children}</BufferContext.Provider>
}
```

```typescript
// In main.tsx (synchronous):
import { bootTrace } from '@/lib/boot-trace'
bootTrace.report('MODULE', 'evaluating entry point', 'critical')

// ... imports ...
bootTrace.report('CSS', 'stylesheets loaded', 'critical')

const root = ReactDOM.createRoot(rootElement)
bootTrace.report('REACT', 'root created', 'critical')
```

```typescript
// For async dev imports:
if (import.meta.env.DEV) {
  import('./dev/browserLogForwarder').then(({ installBrowserLogForwarder }) => {
    installBrowserLogForwarder()
    bootTrace.report('DEV:LOGS', 'log forwarder installed', 'dev')
  })
}
```

---

## Splash Component Behavior

### Timing Model: Adaptive with Minimum

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Minimum duration** | 2.0s | Wordmark reveal needs ~1.5s to complete. 2s floor. |
| **Maximum duration** | 6.0s | Failsafe. If boot hangs, splash dissolves anyway. |
| **Completion signal** | All `critical` phase traces received | Core app is ready. |
| **Dissolve trigger** | `max(minDuration, lastCriticalTrace + 300ms)` | Whichever is later. |

### What the user sees

```
0.0s   ┌─────────────────────────────────────────────┐
       │                                             │  Black screen, scanlines
0.05s  │  [  12ms] MODULE   evaluating entry point   │  ← traces appear as they
0.08s  │  [  34ms] CSS      stylesheets loaded       │     arrive from the bus
0.12s  │  [  89ms] REACT    root created             │
0.15s  │  [ 112ms] ROUTER   route tree compiled      │  Mechanical staccato —
0.18s  │  [ 145ms] RENDER   mounting component tree  │  each line fades in with
       │                                             │  a tiny gsap.fromTo
0.5s   │  [ 487ms] PROVIDER:OVERLAY  initialized     │
0.6s   │  [ 553ms] PROVIDER:SCALE   scale=1.0        │  Provider phase traces
0.7s   │  [ 621ms] PROVIDER:BUFFER  pool allocated   │  arrive as React mounts
       │                                             │
1.2s   │  [1187ms] SHELL    layout mounted           │  Service phase
1.3s   │  [1244ms] SIDEBAR  5 items configured       │
       │                                             │
1.5s   │  ─── WORDMARK REVEAL ───                    │  After critical traces
       │  T → Terminal                               │  done OR 1.5s elapsed,
       │  M → Multi-Modal                            │  wordmark sequence plays
       │  N → Navigation                             │
       │  L → Layer                                  │
       │                                             │
2.0s+  │  ─── FADE OUT ───                           │  max(2.0s, lastCritical+300ms)
       │  Container opacity → 0                      │
       └─────────────────────────────────────────────┘
       onComplete() → splash unmounts
```

### Trace Line Formatting

Each trace line displays:

```
[  89ms] REACT    root created
 ^^^^    ^^^^^    ^^^^^^^^^^^^
 │       │        └─ status (secondary color, regular weight)
 │       └─ label (primary color → shifts to success green when complete)
 └─ timestamp since page load (dim color, right-aligned in 5-char field)
```

- Timestamp: `performance.now()` formatted as ms, right-aligned
- Label: uppercase, fixed-width column (18 chars)
- Status: lowercase, flows naturally
- Phase coloring: `critical` = primary, `provider` = secondary, `dev` = dim

### Wordmark Reveal

Unchanged from original spec. Plays after the boot trace lines:

```
T → Terminal
M → Multi-Modal
N → Navigation
L → Layer
```

Triggered when: first `critical` phase trace with label `ROUTE` arrives,
OR 1.5s has elapsed (whichever comes first). This ensures the wordmark
plays even if route matching is slow.

---

## GSAP + effect-atom Pattern

```typescript
import { useRef, useState, useEffect, useCallback } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { useAtomValue } from '@effect-atom/atom-react'
import { Result } from '@effect-atom/atom'
import {
  bootEntriesAtom,
  sealBootTrace,
  type BootEntry,
} from '@/lib/boot-trace'

gsap.registerPlugin(useGSAP)

export function Splash({ onComplete, skippable = true }: SplashProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const traceListRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)
  const [wordmarkReady, setWordmarkReady] = useState(false)

  // ── Reactive subscription to EventLog-backed boot entries ──
  // Auto-updates via Reactivity.stream when BootTraceReported fires
  const entriesResult = useAtomValue(bootEntriesAtom)
  const entries: ReadonlyArray<BootEntry> = Result.isSuccess(entriesResult)
    ? entriesResult.value
    : []

  // ── Animate each NEW trace line as it arrives ──
  useEffect(() => {
    if (entries.length <= prevCountRef.current) return
    // Animate only the new entries
    for (let i = prevCountRef.current; i < entries.length; i++) {
      const el = traceListRef.current?.children[i]
      if (el) {
        gsap.fromTo(el,
          { opacity: 0, x: -6 },
          { opacity: 1, x: 0, duration: 0.08, ease: 'none' }
        )
      }
    }
    prevCountRef.current = entries.length
  }, [entries.length])

  // ── Trigger wordmark: ROUTE trace or 1.5s timeout ──
  useEffect(() => {
    const hasCriticalRoute = entries.some(t => t.label === 'ROUTE')
    const timer = setTimeout(() => setWordmarkReady(true), 1500)
    if (hasCriticalRoute) setWordmarkReady(true)
    return () => clearTimeout(timer)
  }, [entries])

  // ── Wordmark animation via useGSAP ──
  const { contextSafe } = useGSAP(() => {
    if (!wordmarkReady) return
    const tl = gsap.timeline()

    WORDMARK.forEach((_, i) => {
      tl.fromTo(`.wm-letter-${i}`, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.12, ease: 'none' }, i * 0.35)
      tl.fromTo(`.wm-arrow-${i}`, { opacity: 0, x: -4 }, { opacity: 1, x: 0, duration: 0.08, ease: 'none' }, i * 0.35 + 0.1)
      tl.fromTo(`.wm-word-${i}`, { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.15, ease: 'power1.out' }, i * 0.35 + 0.15)
    })
  }, { scope: containerRef, dependencies: [wordmarkReady] })

  // ── Dissolve: adaptive timing ──
  useEffect(() => {
    if (!wordmarkReady) return
    const minDuration = 2000
    const elapsed = performance.now()
    const remaining = Math.max(0, minDuration - elapsed)

    const timer = setTimeout(() => {
      gsap.to(containerRef.current, {
        opacity: 0,
        duration: 0.4,
        ease: 'power2.inOut',
        onComplete: () => {
          sealBootTrace()    // writes BootTraceSealed to EventLog
          onComplete?.()
        }
      })
    }, remaining + 300)

    return () => clearTimeout(timer)
  }, [wordmarkReady, onComplete])

  // ── Skip (contextSafe — created after hook execution) ──
  const handleSkip = contextSafe(() => {
    gsap.to(containerRef.current, {
      opacity: 0, duration: 0.2, ease: 'power2.inOut',
      onComplete: () => { sealBootTrace(); onComplete?.() }
    })
  })

  // ... render entries as trace lines ...
}
```

**Key architecture decisions:**
- `useAtomValue(bootEntriesAtom)` — reactive, auto-updates via Reactivity.stream
- NO useState for entries — atom IS the state (Atom-as-State pattern from AGENTS.md)
- `prevCountRef` tracks which entries are already animated (avoids re-animating on re-render)
- `sealBootTrace()` writes `BootTraceSealed` event to EventLog — clean shutdown
- Wordmark trigger is event-driven (ROUTE trace) with 1.5s timeout failsafe
- Dissolve timing is adaptive: `max(2s, lastCriticalTrace + 300ms)`

---

## Architecture

### Component Tree (in main.tsx)

```
<React.StrictMode>
  {showSplash && <Splash onComplete={() => setShowSplash(false)} />}  ← overlay, z-10000
  <OverlayRegistryProvider>          ← reports: PROVIDER:OVERLAY
    <DataplaneRegistryProvider>      ← reports: PROVIDER:DATAPLANE
      <ScaleProvider>                ← reports: PROVIDER:SCALE
        <VisualOverlayProvider>      ← reports: PROVIDER:VISUAL
          <BufferProvider>           ← reports: PROVIDER:BUFFER
            <AppShell>               ← reports: SHELL
              <RouterProvider />     ← reports: ROUTE (on match)
            </AppShell>
          </BufferProvider>
        </VisualOverlayProvider>
      </ScaleProvider>
    </DataplaneRegistryProvider>
  </OverlayRegistryProvider>
</React.StrictMode>
```

**App tree is NOT gated by splash.** It renders simultaneously.
The splash is a fixed overlay. Providers mount behind it and report traces.

### Route Preloading (during splash)

```typescript
useEffect(() => {
  router.preloadRoute({ to: '/' })
  router.preloadRoute({ to: '/playground' })
  bootTrace.report('PRELOAD', 'core routes queued', 'service')
}, [])
```

---

## File Structure (after rewrite)

```
src/lib/boot-trace/                  ← NEW: EventLog-backed boot trace bus
├── index.ts                         ← Barrel: reportBootTrace, sealBootTrace, atoms, types
├── events.ts                        ← EventGroup: BootTraceReported, BootTraceSealed
├── handlers.ts                      ← EventLog.group() handlers → BootTraceService
├── service.ts                       ← Effect.Service: Ref<BootEntry[]>, append/seal/getAll
└── atoms.ts                         ← Atom.runtime(BootTraceLive), reactive query atoms

src/components/splash/
├── SPLASH_V2.md                     ← this file
├── Splash.tsx                       ← REWRITTEN: useAtomValue(bootEntriesAtom) + GSAP + CSS
├── tokens.ts                        ← SIMPLIFIED: palette, wordmark config, timing bounds
├── index.ts                         ← SIMPLIFIED: Splash, LockScreenController, tokens, etc.
├── lock/
│   ├── LockScreenController.tsx     ← UNCHANGED (separate concern)
│   └── index.ts
├── services/                        ← UNCHANGED (auth, idle detection)
├── schemas/                         ← UNCHANGED (auth schemas)
└── aberration/                      ← KEPT (Three.js — allowed, may use as splash background)

DELETED:
  ├── CRTEffect.tsx                  ← canvas noise, 2 rAF loops, animatable deps
  ├── LogoReveal.tsx                 ← GSAP+setTimeout soup, animatable deps
  └── TerminalInit.tsx               ← setTimeout chains, GSAP+animatable deps
```

---

## Trace Line Typography

| Element | Font | Size | Color |
|---------|------|------|-------|
| Timestamp `[  89ms]` | VT323 | 14px | `#78746e` dim |
| Label `REACT` | VT323 | 16px | `#e8e4de` primary → `#c8e4d8` success |
| Status `root created` | VT323 | 16px | `#b8b4ae` secondary |
| Phase `critical` traces | — | — | Full opacity |
| Phase `provider` traces | — | — | 90% opacity |
| Phase `dev` traces | — | — | 60% opacity |
| Wordmark letter | VT323 | 32px | `#e8e4de` primary |
| Wordmark arrow | VT323 | 16px | `#78746e` dim |
| Wordmark word | VT323 | 24px | `#b8b4ae` secondary |
| Skip hint | VT323 | 14px | `#78746e` dim |

**12px floor respected** — smallest text is 14px.

---

## Skip Behavior

| Input | Action |
|-------|--------|
| `Escape` | Fast fade (0.2s) → seal → onComplete |
| `Space` | Same |
| `Enter` | Same |
| Click anywhere | Same |
| During fade-out | No-op (already completing) |

---

## Post-Boot Profiling

After splash completes, `bootTrace.getAll()` returns the full trace log.
This data feeds directly into the DevPanel (Phase 2 of `#F393`):

```typescript
const traces = bootTrace.getAll()
const total = bootTrace.duration
console.table(traces.map(t => ({
  label: t.label,
  status: t.status,
  ms: `${t.timestamp.toFixed(0)}ms`,
  phase: t.phase,
})))
// → See exactly which provider/service was slowest
```

---

## Phases (Implementation Order)

| # | Task | Key Files | Depends On |
|---|------|-----------|------------|
| 0 | Delete dead code | CRTEffect, LogoReveal, TerminalInit, old Splash | — |
| 1 | Build boot-trace EventLog | `src/lib/boot-trace/{events,handlers,service,atoms}.ts` | — |
| 2 | Rewrite tokens | `tokens.ts` | Phase 0 |
| 3 | Build new Splash | `Splash.tsx` (useAtomValue + useGSAP) | Phase 1, 2 |
| 4 | Update barrel | `index.ts` | Phase 3 |
| 5 | Instrument providers + main.tsx | Every provider, main.tsx (reportBootTrace calls) | Phase 1 |
| 6 | Wire splash into render tree | `main.tsx` (AppRoot wrapper) | Phase 4, 5 |
| 7 | Verify in tauri:dev | — | Phase 6 |

## Composition Stack

```
┌─────────────────────────────────────────────────────────────────────┐
│                         React (Splash.tsx)                          │
│  useAtomValue(bootEntriesAtom)  →  renders trace lines             │
│  useGSAP(() => animate lines)   →  GSAP timeline for entrance      │
│  sealBootTrace()                →  seals EventLog on complete       │
├─────────────────────────────────────────────────────────────────────┤
│                    effect-atom (atoms.ts)                           │
│  bootTraceRuntimeAtom = Atom.runtime(BootTraceLive)                │
│  bootEntriesAtom = runtimeAtom.atom(Reactivity.stream([...]))      │
│  reportBootTrace = runtimeAtom.fn<...>()(EventLog.write)           │
├─────────────────────────────────────────────────────────────────────┤
│                  @effect/experimental                               │
│  EventGroup  →  BootTraceEvents (BootTraceReported, BootTraceSealed)│
│  EventLog    →  write("BootTraceReported", payload)                │
│  EventLog.group()  →  handlers that call BootTraceService.append() │
│  Reactivity  →  auto-invalidates atoms when events fire            │
│  EventJournal.layerMemory  →  in-memory journal (no persistence)   │
├─────────────────────────────────────────────────────────────────────┤
│                    Effect Services                                  │
│  BootTraceService  →  Ref<BootEntry[]>, append/seal/getAll         │
└─────────────────────────────────────────────────────────────────────┘
```
