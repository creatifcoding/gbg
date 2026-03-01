# EPOCH-0005: Streaming Response UX Overhaul

**Status**: Approved  
**Feature**: #F842  
**Tasks**: #3137–#3145

## Goal

Eight-dimension UX improvement across the streaming response lifecycle: from the moment the user presses Send to the moment the response settles and they can act on it. Every phase of the experience gets design attention proportional to its screen time.

## Architecture Principle: Forage, Derive, Don't Duplicate

All new state is **derived from existing atoms** via `Atom.make((get) => ...)`. No new `Effect.Ref`, no parallel state machines. The Atom-as-State pattern means:

- `streaming$(instanceId)` is the **canonical** streaming state per harness instance
- `messages$(instanceId)` / per-message atoms are the canonical message state
- New atoms **derive** from these via `Atom.make((get) => ...)` 
- React components subscribe to derived atoms, never to the raw streaming$ directly (except where narrowing already exists like `getStreamingSignalAtom`)

---

## Existing Atom Infrastructure (Foraged)

### Per-Instance Atom Families (`useHarnessAdapter.ts`)

| Atom Family | Type | Source |
|---|---|---|
| `streaming$(id)` | `Atom<StreamingState>` | Canonical streaming lifecycle |
| `messages$(id)` | `Atom<ReadonlyArray<ChatMessage>>` | Full message array |
| `messageIds$(id)` | Derived from messages$ | Stable ID ordering |
| `getMessageAtom(id, msgId)` | `Atom<ChatMessage \| null>` | Per-message isolation |
| `connection$(id)` | `Atom<ConnectionState>` | Connection lifecycle |
| `sessionId$(id)` | `Atom<HarnessSessionId \| null>` | Session identity |
| `metrics$(id)` | `Atom<ReadonlyArray<MetricEntry>>` | Harness event metrics |
| `provider$(id)` | `Atom<ProviderMarker \| null>` | Provider marker (model info) |
| `contextUsage$(id)` | `Atom<ContextUsage \| null>` | Context window tracking (EPOCH-0004) |
| `availableModels$(id)` | `Atom<ReadonlyArray<HarnessModelOption>>` | Model list |
| `selectedModel$(id)` | `Atom<string \| null>` | Selected model ID |
| `statusRows$(id)` | `Atom<ReadonlyArray<HarnessStatusRow>>` | Status/interruption rows |

### StreamingState Shape (Canonical)

```typescript
interface StreamingState {
  phase: 'idle' | 'waiting' | 'receiving' | 'finalizing' | 'cancelling' | 'error-recovery'
  buffer: string
  messageId?: string
  tokensReceived?: number
  sessionId?: string
  startedAt?: number      // epoch ms — stream start
  lastEventAt?: number    // epoch ms — last delta received
}
```

**Key**: `startedAt` and `tokensReceived` ALREADY EXIST. We derive everything from these. No new fields needed on StreamingState.

### Existing Narrowing: `getStreamingSignalAtom` (thread-view.tsx)

Already provides `{ isStreaming: boolean, messageId: string | null }` — closure-memoized, changes only at stream start/end, NOT on every delta. This is the template for our derived atoms.

### Existing Animations

| Component | Animation | Framework |
|---|---|---|
| RoleIconRail | Breathing icon during streaming | `motion/react` (opacity [1, 0.35, 1]) |
| StreamingBadge | Same breathing + 'streaming' label | `motion/react` |
| StreamCursor | `animate-pulse` (CSS, 2s cycle) | Tailwind CSS |
| Shell border | `border-l-2 border-l-cyan-500/40` during streaming | Static class toggle |
| Md structural | Gate on MdContext.streaming (Vector 4 fix) | `framer-motion` (gated) |

### Existing Context Providers

| Context | Location | Provides |
|---|---|---|
| `MdProvider` / `useMdContext()` | `md-components/md-context.ts` | `{ streaming: boolean }` |
| `ChatMessageShellContext` | `message-shell-context.ts` | `{ role, streaming, messageAnchorId }` |
| `ChatThinkingBlockContext` | `thinking-block-context.ts` | `{ isStreaming, isOpen, setIsOpen, durationSec }` |
| `useMorphChatContext()` | `surface-context.ts` | `{ spec, adapter, surfaceId }` |
| `useChatThreadTail()` | `thread-band-root.tsx` | `{ tailMode, unreadCount, jumpToLatest, interruptTail }` |

---

## New Derived Atoms

### 1. `streamingMetrics$` — Per-Instance Derived Atom

**Location**: `src/lib/morphchat/atoms/streaming-metrics.ts`

```typescript
import { Atom } from '@effect-atom/atom'
import { streaming$ } from '../hooks/useHarnessAdapter'

export type CursorVelocity = 'fast' | 'normal' | 'slow'

export interface StreamingMetrics {
  /** Whether streaming is active (any non-idle, non-error-recovery phase) */
  readonly active: boolean
  /** Current phase from canonical streaming$ */
  readonly phase: StreamPhase
  /** Tokens received so far */
  readonly tokensReceived: number
  /** Tokens per second (derived from tokensReceived / elapsed) */
  readonly tokensPerSecond: number
  /** Elapsed seconds since stream start */
  readonly elapsedSec: number
  /** Cursor velocity bucket for adaptive cursor */
  readonly velocity: CursorVelocity
  /** Message ID being streamed */
  readonly messageId: string | null
}

export const IDLE_METRICS: StreamingMetrics = {
  active: false,
  phase: 'idle',
  tokensReceived: 0,
  tokensPerSecond: 0,
  elapsedSec: 0,
  velocity: 'normal',
  messageId: null,
}
```

**Derivation strategy**: `streamingMetrics$` is an `Atom.family` that reads `streaming$(id)` and derives rate + velocity + elapsed. 

**Key issue**: `Atom.make((get) => ...)` is pull-based — it only recomputes when a dependency changes. `streaming$` updates on every rAF flush (~16ms during active streaming). So `tokensPerSecond` and `elapsedSec` are naturally fresh during streaming without any timers.

BUT — `elapsedSec` doesn't advance when no tokens arrive (e.g., waiting phase, slow model). For that, we need a 1-second tick atom that only runs during streaming:

```typescript
// Tick atom: increments once/sec while streaming is active
// Only used as a dependency signal — value itself doesn't matter
export const streamTick$ = Atom.family((id: string) => {
  let interval: ReturnType<typeof setInterval> | null = null
  const tick = Atom.make(0)
  // Side-effect: start/stop interval based on streaming phase
  // Managed by the hook that mounts the metrics context
  return tick
})
```

**Actually simpler**: the existing `streaming$` already updates `lastEventAt` on every delta. During 'waiting' phase, nothing updates — but that's correct: `elapsedSec` grows in the React component via `Date.now() - startedAt`, re-evaluated on each streaming$ change + 1s interval in the hook.

### 2. `StreamingMetricsProvider` — React Context

**Location**: `src/lib/morphchat/components/streaming-metrics-provider.tsx`

```typescript
const StreamingMetricsCtx = createContext<StreamingMetrics>(IDLE_METRICS)
export const StreamingMetricsProvider = StreamingMetricsCtx.Provider
export const useStreamingMetrics = () => useContext(StreamingMetricsCtx)
```

**Mounted in**: `AssistantMessage` (thread-view.tsx) wraps its children in `<StreamingMetricsProvider value={metrics}>`. The metrics are computed from `streaming$(instanceId)` via `useAtomValue`.

**All parts** (text, thinking, tool, code) can call `useStreamingMetrics()` to get tokens, rate, velocity, elapsed time — the "per-message-family" access pattern the user specified.

---

## Task Specifications

### #3137 — Streaming Metrics Context

**Files to create**:
- `src/lib/morphchat/atoms/streaming-metrics.ts` — `streamingMetrics$` atom family, `StreamingMetrics` interface, `IDLE_METRICS` constant, `deriveVelocity()` pure function
- `src/lib/morphchat/components/streaming-metrics-provider.tsx` — React context + provider + `useStreamingMetrics()` hook

**Files to modify**:
- `src/lib/morphchat/components/thread-view.tsx` — `AssistantMessage` wraps children in `<StreamingMetricsProvider>`
- `src/lib/morphchat/schemas/message-types.tsx` — Export `StreamPhase` (already exists, may need explicit export)

**Derivation**:
```typescript
export const streamingMetrics$ = Atom.family((id: string) =>
  Atom.make<StreamingMetrics>((get) => {
    const s = get(streaming$(id))
    const active = s.phase !== 'idle' && s.phase !== 'error-recovery'
    if (!active) return IDLE_METRICS

    const tokens = s.tokensReceived ?? 0
    const elapsed = s.startedAt ? (Date.now() - s.startedAt) / 1000 : 0
    const rate = elapsed > 0.5 ? Math.round(tokens / elapsed) : 0

    return {
      active: true,
      phase: s.phase,
      tokensReceived: tokens,
      tokensPerSecond: rate,
      elapsedSec: Math.floor(elapsed),
      velocity: deriveVelocity(rate, s.phase),
      messageId: s.messageId ?? null,
    }
  })
)

function deriveVelocity(rate: number, phase: StreamPhase): CursorVelocity {
  if (phase === 'waiting') return 'slow'  // Pre-token: orbital dots
  if (rate >= 20) return 'fast'           // Brisk blink
  if (rate < 5 && rate > 0) return 'slow' // Orbital dots
  return 'normal'                         // Breathing pulse
}
```

**Threading into AssistantMessage**:
```typescript
// In thread-view.tsx AssistantMessage:
const { adapter } = useMorphChatContext()
const instanceId = resolveHarnessInstanceId(adapter.adapterId)
const metrics = useAtomValue(
  instanceId ? streamingMetrics$(instanceId) : idleMetricsAtom
)

return (
  <StreamingMetricsProvider value={metrics}>
    <ChatMessageShellRoot ...>
      {/* all parts can useStreamingMetrics() */}
    </ChatMessageShellRoot>
  </StreamingMetricsProvider>
)
```

**Sentinel for non-harness adapters**:
```typescript
const idleMetricsAtom = Atom.make(IDLE_METRICS)  // Never changes
```

---

### #3138 — Adaptive Cursor

**Files to modify**:
- `src/lib/chat/msg/body-content/stream-cursor.tsx` — Replace static `▌` with velocity-adaptive behavior
- `src/globals.css` — Add `@keyframes blink`, `@keyframes orbital` 

**Reads from**: `useStreamingMetrics()` → `velocity`

**Three modes**:
| Velocity | Visual | Animation |
|---|---|---|
| `fast` (≥20 tok/s) | `▌` block cursor | `blink 300ms step-end infinite` |
| `normal` | `▌` block cursor | `pulse 900ms ease-in-out infinite` (tightened from 2s) |
| `slow` / waiting | Three orbital dots | `orbital 1.4s ease-in-out infinite` with staggered delays |

**Props change**: `ChatMessageStreamCursor` gains optional `velocity?: CursorVelocity` prop. Default `'normal'` for backward compat.

**Caller change**: In `PartRenderer` (thread-view.tsx), read `useStreamingMetrics().velocity` and pass to cursor.

---

### #3139 — Phased Entry Sequence

**Files to create**:
- `src/lib/chat/msg/body-content/stream-entry-placeholder.tsx` — `StreamEntryPlaceholder` component

**Files to modify**:
- `src/lib/morphchat/components/thread-view.tsx` — `PartRenderer` renders placeholder when `isStreaming && parts.length === 0`

**Phase derivation** (from `useStreamingMetrics()`):
| `metrics.phase` | Placeholder phase |
|---|---|
| `'waiting'` | `'waiting'` — skeleton lines |
| `'receiving'` with 0 tokens | `'thinking'` — orbital dots + label |
| `'receiving'` with >0 tokens | Don't show — text parts rendering |
| `'idle'` | Don't show |

**AnimatePresence `mode="wait"`** transitions between phases.

---

### #3140 — Token Counter + Rate + Duration in Streaming Badge

**Files to modify**:
- `src/lib/chat/msg/header-cluster/header-streaming-badge.tsx` — Replace static 'streaming' label with live metrics

**Reads from**: `useStreamingMetrics()` → `tokensReceived`, `tokensPerSecond`, `elapsedSec`

**Display format during streaming**:
```
🤖 247 tok · 38/s · 6s
```

**Throttle**: The atom itself is rAF-throttled (streaming$ only updates on rAF flush). The badge re-renders at whatever rate React schedules — which is naturally throttled by React's batching. No additional throttle needed.

**Display format idle**: `🤖 IDLE` (current behavior, uppercase tracking).

---

### #3141 — Graceful Landing Sequence

**Files to modify**:
- `src/lib/morphchat/components/thread-view.tsx` — `AssistantMessage` metadata row wrapped in `AnimatePresence` with entry animation. Add `useJustCompleted` hook.
- `src/lib/chat/msg/body-content/stream-cursor.tsx` — Wrap cursor in `AnimatePresence` with `exit={{ opacity: 0 }}` 
- `src/lib/chat/msg/message-shell/message-shell-root.tsx` — Border dissolve via CSS `transition-[border-color] duration-200`

**`useJustCompleted` hook**:
```typescript
function useJustCompleted(status: MessageStatus): boolean {
  const [just, setJust] = useState(false)
  const prevRef = useRef(status)
  
  useEffect(() => {
    if (prevRef.current === 'streaming' && status === 'complete') {
      setJust(true)
      const t = setTimeout(() => setJust(false), 600)
      return () => clearTimeout(t)
    }
    prevRef.current = status
  }, [status])
  
  return just
}
```

**Three-beat choreography**:
1. **Cursor exit** (100ms): `AnimatePresence` → `exit={{ opacity: 0 }}` transition 100ms
2. **Border dissolve** (200ms): Shell class changes from `border-l-cyan-500/40` to `border-l-transparent transition-[border-color] duration-200`
3. **Metadata entrance** (200ms, 150ms delay): `motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}`

---

### #3142 — Floating Scroll Pill

**Files to create**:
- `src/lib/morphchat/components/floating-scroll-pill.tsx` — `FloatingScrollPill` component

**Files to modify**:
- `src/lib/morphchat/components/thread-view.tsx` — Replace `<ThreadTailControls />` with `<FloatingScrollPill />`

**Reads from**: `useChatThreadTail()` (existing) — `tailMode`, `unreadCount`, `jumpToLatest`

**Position**: `sticky bottom-3` inside the scroll container. `pointer-events-none` on wrapper, `pointer-events-auto` on button. AnimatePresence for enter/exit.

**Keyboard**: Space bar triggers `jumpToLatest` when pill is visible. Wire via `onKeyDown` on the scroll container.

---

### #3143 — Role-Directional Message Entry Animation

**Files to modify**:
- `src/lib/chat/msg/message-shell/message-shell-root.tsx` — Replace `<article>` with `<motion.article>`

**Entry direction**:
| Role | Initial | Animate |
|---|---|---|
| `user` | `{ opacity: 0, x: 12 }` | `{ opacity: 1, x: 0 }` |
| `assistant` / `tool` / `system` | `{ opacity: 0, y: 8 }` | `{ opacity: 1, y: 0 }` |

**Critical safeguards**:
- `layout={false}` — prevents Framer Motion layout animation on content growth
- `transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}` — 200ms ease-out
- `useReducedMotion()` → opacity-only fallback

**No re-fire risk**: `motion.article` `initial` only fires on mount. Content growth within the shell is handled by React reconciliation of children, not Framer Motion layout.

---

### #3144 — Thinking Block Heatmap

**Files to modify**:
- `src/lib/chat/msg/thinking-block/thinking-block-root.tsx` — Add `THINKING_HEATMAP` color scale, 1s timer for elapsed, dynamic border/bg
- `src/lib/chat/msg/thinking-block/thinking-block-trigger.tsx` — Show `thinking… 12s` during streaming

**Heatmap scale** (pure function, no atoms needed — local state):
```typescript
const THINKING_HEATMAP = [
  { threshold: 0,  border: 'border-violet-500/20', bg: 'bg-violet-500/[0.03]' },
  { threshold: 2,  border: 'border-blue-500/20',   bg: 'bg-blue-500/[0.03]' },
  { threshold: 5,  border: 'border-blue-400/20',   bg: 'bg-blue-400/[0.03]' },
  { threshold: 15, border: 'border-amber-500/20',   bg: 'bg-amber-500/[0.03]' },
  { threshold: 30, border: 'border-rose-500/20',    bg: 'bg-rose-500/[0.03]' },
] as const
```

**Timer**: `useEffect` with `setInterval(1000)` while `isStreaming === true`. Updates local `elapsed` state. No atoms — this is component-local display state.

**Transition**: `transition-colors duration-700` on the root div for smooth color shifts.

---

### #3145 — Progressive Action Bar

**Files to create**:
- `src/lib/chat/msg/action-bar/message-action-bar.tsx` — `MessageActionBar` component
- `src/lib/chat/msg/action-bar/index.ts` — Barrel export

**Files to modify**:
- `src/lib/morphchat/components/thread-view.tsx` — `AssistantMessage` renders `<MessageActionBar>` after metadata when `status === 'complete'`

**Actions**:
| Action | Icon | Callback |
|---|---|---|
| Copy | `Copy` | `navigator.clipboard.writeText(message.content)` |
| Copy MD | `FileText` | Same as copy (content IS markdown) |
| Retry | `RefreshCw` | `adapter.send({ content: lastUserMessage.content })` |
| Continue | `ArrowRight` | `adapter.send({ content: 'Continue from where you left off' })` |

**Visibility**: `opacity-0 group-hover/message:opacity-100 transition-opacity duration-150 ease-out`

**Retry/Continue callbacks**: Passed from `AssistantMessage` which has access to `adapter.send` via `useMorphChatContext()`. `Retry` needs access to the previous user message — derive from `messages$(id)` by finding the last `role: 'operator'` before this message.

---

## Dependency Graph

```
streaming-metrics-ctx (#3137)
├── adaptive-cursor (#3138)
│   └── graceful-landing (#3141)
│       ├── message-entry-anim (#3143)
│       └── action-bar (#3145)
├── phased-entry (#3139)
├── progress-badge (#3140)
├── floating-scroll-pill (#3142)
└── thinking-heatmap (#3144)
```

**Phase 1** (foundation): #3137 — streaming metrics context  
**Phase 2** (parallel): #3138, #3139, #3140, #3142, #3144 — all derive from metrics  
**Phase 3** (sequential): #3141 → #3143 → #3145 — landing → entry → actions

---

## Typography Compliance

All new components use `style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}` or `var(--tmnl-text-sm, 14px)`. No Tailwind `text-*` size classes. 12px floor enforced.

## Animation Compliance (Emil Kowalski)

- `ease-out` default: `[0.32, 0.72, 0, 1]`
- Max 300ms for entrances (200ms standard, 250ms for heavy elements)
- Transform + opacity only (GPU composited)
- `useReducedMotion()` → opacity-only fallback on all motion components
- Every animation has a stated purpose in the JSDoc

## Testing Strategy

- Derived atoms: unit test `streamingMetrics$` with mock `streaming$` values
- Components: snapshot test each visual state (idle, waiting, receiving, complete)
- Integration: existing harness/morphchat test suite — zero regressions
- Manual: `prefers-reduced-motion` media query verification in devtools
