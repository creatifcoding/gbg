# MorphChat — Adaptive Chat Surface Architecture

> *"One surface. Any shape. Every context."*

MorphChat is an adaptive, spec-driven chat surface system built on the MorphCard
paradigm: Effect Schema for configuration, XState for lifecycle, effect-atom for
state, and compound components for composition. It embeds anywhere — full-page,
sidebar, tldraw canvas, AG-Grid detail row, command palette — and morphs between
configurations at runtime with animated transitions.

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Glossary](#glossary)
3. [Architecture Overview](#architecture-overview)
4. [Surface Spec (Effect Schema)](#surface-spec)
5. [Feature Axes](#feature-axes)
6. [Preset Specs](#preset-specs)
7. [State Machine (XState)](#state-machine)
8. [State Ownership (Atoms + Adapters)](#state-ownership)
9. [Compound Component API](#compound-component-api)
10. [Skins System](#skins-system)
11. [Transition Grammar](#transition-grammar)
12. [File Structure](#file-structure)
13. [Migration from ChatIsolated](#migration)
14. [Testing Strategy](#testing-strategy)

---

## Design Philosophy

### Inherited from MorphCard

MorphCard proved that a single component can serve radically different contexts
when governed by:

1. **Schema-validated specs** — compile-time + runtime safety
2. **XState lifecycle** — explicit transitions, no implicit state
3. **Atom-backed state** — reactive, testable, composable
4. **Skin/slot separation** — structure vs. appearance decoupled
5. **Transition grammar** — `verb:modifier:direction` animation vocabulary

MorphChat extends this paradigm to chat surfaces.

### New Principles

6. **Adapter pattern for data** — Surface defines an interface; consumers provide
   implementations. Messages, connection, streaming — all behind adapters.
7. **Spec-driven topology** — The internal component tree is *computed from the
   spec*. Not prop-drilled. Not boolean-flagged.
8. **Morph at runtime** — Specs are not static. A sidebar chat can pop out to
   full-page. A widget can expand to dock. The state machine governs transitions.
9. **Independent derived views** — Multiple surfaces can share the same atom
   state, each rendering their own derived view.

---

## Glossary

| Term | Definition |
|------|-----------|
| **Surface** | A single MorphChat instance — the rendered chat UI |
| **Spec** | Effect Schema config object defining which features are enabled and how |
| **Preset** | A named, pre-built spec (e.g., `Conductor`, `Dock`, `Spotlight`) |
| **Axis** | A single feature dimension (e.g., `composer`, `thread`, `frameChrome`) |
| **Adapter** | Interface implementation providing data operations (messages, connection) |
| **Skin** | Slot components providing visual appearance (inherited from MorphCard) |
| **Morph** | Runtime transition between specs with animated state change |
| **Band** | A horizontal layout zone within the shell (header, thread, composer) |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Consumer (App Code)                          │
│                                                                     │
│  <MorphChat.Surface                                                 │
│    spec={MorphChat.presets.Conductor}                               │
│    adapter={myChatAdapter}                                          │
│    skin={tmnlChatSkin}                                              │
│  />                                                                 │
└───────────────┬─────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     MorphChat.Surface (Provider)                    │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Spec Context  │  │ Adapter Ctx  │  │ Skin Context             │  │
│  │ (active spec) │  │ (data ops)   │  │ (slot components)        │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────────┘  │
│         │                  │                      │                  │
│         ▼                  ▼                      ▼                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Topology Resolver                               │   │
│  │              (spec → component tree)                         │   │
│  │                                                               │   │
│  │  if spec.composer === 'full'     → <FullComposer />          │   │
│  │  if spec.composer === 'command'  → <CommandInput />           │   │
│  │  if spec.composer === 'none'     → null                      │   │
│  │  if spec.thread === 'compact'    → <CompactThread />         │   │
│  │  ... etc for every axis                                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              XState Machine                                  │   │
│  │              (lifecycle + morph transitions)                  │   │
│  │                                                               │   │
│  │  States: idle | active | morphing | error                    │   │
│  │  Events: MORPH { targetSpec }, CONNECT, DISCONNECT, ...      │   │
│  │  Actions: applySpec, animateTransition, syncAtoms            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Atom Layer (effect-atom)                        │   │
│  │                                                               │   │
│  │  Messages ──→ derived: threadAtom, latestMessageAtom         │   │
│  │  Connection → derived: statusAtom, latencyAtom               │   │
│  │  Streaming ─→ derived: isStreamingAtom, streamBufferAtom     │   │
│  │  UI State ──→ activeSpecAtom, expansionAtom, focusAtom       │   │
│  │                                                               │   │
│  │  Multiple surfaces can subscribe to same data atoms          │   │
│  │  UI atoms are per-surface-instance                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Surface Spec

The spec is an Effect Schema struct with a value for every feature axis.
Consumer code either uses a preset or builds a custom spec via `pipe`/merge.

```typescript
// schemas/surface-spec.ts

import { Schema } from 'effect'

// ── Axis Literals ──

export const ComposerVariant = Schema.Literal(
  'full', 'single-line', 'command', 'structured', 'none'
)

export const ThreadMode = Schema.Literal(
  'full', 'compact', 'stream-only', 'log', 'card', 'none'
)

export const InlineTaskMode = Schema.Literal(
  'full', 'compact', 'hidden'
)

export const AgentSelectorMode = Schema.Literal(
  'dropdown', 'tabs', 'hidden'
)

export const ConnectionDisplayMode = Schema.Literal(
  'badge', 'toast-only', 'hidden'
)

export const FrameChromeLevel = Schema.Literal(
  'full', 'minimal', 'none'
)

export const KeyboardShortcutScope = Schema.Literal(
  'full', 'minimal', 'disabled'
)

export const ContextChipMode = Schema.Literal(
  'full', 'read-only', 'hidden'
)

export const ScrollBehavior = Schema.Literal(
  'auto-follow', 'manual', 'pinned'
)

// ── Surface Spec ──

export const ChatSurfaceSpec = Schema.Struct({
  /** Unique spec identifier */
  _tag: Schema.String,

  /** Human-readable label */
  label: Schema.String,

  // ── Feature axes ──
  composer: ComposerVariant,
  thread: ThreadMode,
  inlineTasks: InlineTaskMode,
  agentSelector: AgentSelectorMode,
  connectionStatus: ConnectionDisplayMode,
  frameChrome: FrameChromeLevel,
  keyboardShortcuts: KeyboardShortcutScope,
  contextChips: ContextChipMode,
  scrollBehavior: ScrollBehavior,

  // ── Layout constraints ──
  maxHeight: Schema.optional(Schema.Number),
  maxWidth: Schema.optional(Schema.Number),
  minHeight: Schema.optional(Schema.Number),

  // ── Transfer system ──
  enableTransferDrag: Schema.optional(Schema.Boolean),
  enableTransferDrop: Schema.optional(Schema.Boolean),
})

export type ChatSurfaceSpec = typeof ChatSurfaceSpec.Type
```

### Spec Composition

```typescript
import { pipe } from 'effect'

// Start from a preset, override axes:
const myCustomSpec = {
  ...MorphChat.presets.Dock,
  _tag: 'MyCustom',
  label: 'Custom Dock',
  composer: 'command' as const,
  inlineTasks: 'hidden' as const,
}
```

---

## Feature Axes

### 1. Composer Variant

| Value | Renders | Use Case |
|-------|---------|----------|
| `full` | Full multiline textarea, toolbar, thinking level, context chips, send/pause | Workstation, dialog |
| `single-line` | Compact one-liner, enter-to-send | Widget, embed, sidebar |
| `command` | Slash-command input, autocomplete, no rich formatting | Spotlight, command palette |
| `structured` | Predefined fields, form-like | Card view, structured workflows |
| `none` | No composer rendered | Monitor, read-only feed |

### 2. Thread Display Mode

| Value | Renders | Use Case |
|-------|---------|----------|
| `full` | All messages, role badges, timestamps, attachments, animations | Full-page, dialog |
| `compact` | Reduced chrome, tighter spacing, no role rail | Sidebar, widget |
| `stream-only` | Only the current streaming response, no history | Embedded, minimal |
| `log` | Monospace, timestamped, terminal-style | Monitor, debug |
| `card` | Each message as a distinct card surface | Card view contexts |
| `none` | No thread (composer-only) | Spotlight |

### 3. Inline Task Shell

| Value | Renders |
|-------|---------|
| `full` | Full virtualized list, transfer, expand/collapse, metrics band |
| `compact` | Summary count badge, click to expand |
| `hidden` | No task display |

### 4. Agent Selector

| Value | Renders |
|-------|---------|
| `dropdown` | Trigger button + dropdown menu |
| `tabs` | Tab bar for agent switching |
| `hidden` | No selector |

### 5. Connection Status Display

| Value | Renders |
|-------|---------|
| `badge` | Persistent badge with dot + label + latency |
| `toast-only` | Toast on state change only |
| `hidden` | Silent |

### 6. Frame Chrome

| Value | Renders |
|-------|---------|
| `full` | Frame corners, title bar, resize handles |
| `minimal` | Hairline border, no title bar |
| `none` | No frame |

### 7. Keyboard Shortcuts

| Value | Scope |
|-------|-------|
| `full` | All shortcuts (Ctrl+Enter send, Escape cancel, Ctrl+C copy selection, etc.) |
| `minimal` | Enter to send only |
| `disabled` | No keyboard handling |

### 8. Context Chips

| Value | Renders |
|-------|---------|
| `full` | Full composer chips with add/remove |
| `read-only` | Display only, no interaction |
| `hidden` | No chips |

### 9. Scroll Behavior

| Value | Behavior |
|-------|----------|
| `auto-follow` | Auto-scroll to latest message |
| `manual` | User controls scroll position |
| `pinned` | Locked to bottom (streaming-optimized) |

---

## Preset Specs

Eight named presets covering every embedding context.

### Conductor

> *Full workstation — every dial, every readout.*

```typescript
export const Conductor: ChatSurfaceSpec = {
  _tag: 'Conductor',
  label: 'Conductor',
  composer: 'full',
  thread: 'full',
  inlineTasks: 'full',
  agentSelector: 'dropdown',
  connectionStatus: 'badge',
  frameChrome: 'full',
  keyboardShortcuts: 'full',
  contextChips: 'full',
  scrollBehavior: 'auto-follow',
  enableTransferDrag: true,
  enableTransferDrop: true,
}
```

**Surfaces:** Full-page, split-pane

### Dock

> *Persistent side companion — always there, never loud.*

```typescript
export const Dock: ChatSurfaceSpec = {
  _tag: 'Dock',
  label: 'Dock',
  composer: 'full',
  thread: 'compact',
  inlineTasks: 'compact',
  agentSelector: 'dropdown',
  connectionStatus: 'badge',
  frameChrome: 'minimal',
  keyboardShortcuts: 'full',
  contextChips: 'full',
  scrollBehavior: 'auto-follow',
  enableTransferDrag: true,
  enableTransferDrop: true,
}
```

**Surfaces:** Sidebar, split-pane

### Dialog

> *Focused conversation — modal attention capture.*

```typescript
export const Dialog: ChatSurfaceSpec = {
  _tag: 'Dialog',
  label: 'Dialog',
  composer: 'full',
  thread: 'full',
  inlineTasks: 'full',
  agentSelector: 'hidden',
  connectionStatus: 'toast-only',
  frameChrome: 'full',
  keyboardShortcuts: 'full',
  contextChips: 'full',
  scrollBehavior: 'auto-follow',
  maxHeight: 600,
  maxWidth: 720,
  enableTransferDrag: true,
  enableTransferDrop: true,
}
```

**Surfaces:** Modal overlay

### Widget

> *Floating bubble — tap to talk, dismiss to hide.*

```typescript
export const Widget: ChatSurfaceSpec = {
  _tag: 'Widget',
  label: 'Widget',
  composer: 'single-line',
  thread: 'compact',
  inlineTasks: 'hidden',
  agentSelector: 'hidden',
  connectionStatus: 'hidden',
  frameChrome: 'none',
  keyboardShortcuts: 'minimal',
  contextChips: 'hidden',
  scrollBehavior: 'pinned',
  maxHeight: 400,
  maxWidth: 360,
}
```

**Surfaces:** Floating FAB

### Spotlight

> *Slash-command speed — intent-first, no history.*

```typescript
export const Spotlight: ChatSurfaceSpec = {
  _tag: 'Spotlight',
  label: 'Spotlight',
  composer: 'command',
  thread: 'none',
  inlineTasks: 'hidden',
  agentSelector: 'hidden',
  connectionStatus: 'hidden',
  frameChrome: 'none',
  keyboardShortcuts: 'minimal',
  contextChips: 'hidden',
  scrollBehavior: 'manual',
  maxWidth: 640,
}
```

**Surfaces:** Command palette

### Embed

> *Canvas citizen — lives inside something else.*

```typescript
export const Embed: ChatSurfaceSpec = {
  _tag: 'Embed',
  label: 'Embed',
  composer: 'single-line',
  thread: 'compact',
  inlineTasks: 'compact',
  agentSelector: 'hidden',
  connectionStatus: 'hidden',
  frameChrome: 'none',
  keyboardShortcuts: 'minimal',
  contextChips: 'hidden',
  scrollBehavior: 'auto-follow',
}
```

**Surfaces:** tldraw shape, AG-Grid detail row

### Monitor

> *Read-only feed — observe the stream.*

```typescript
export const Monitor: ChatSurfaceSpec = {
  _tag: 'Monitor',
  label: 'Monitor',
  composer: 'none',
  thread: 'log',
  inlineTasks: 'compact',
  agentSelector: 'hidden',
  connectionStatus: 'badge',
  frameChrome: 'minimal',
  keyboardShortcuts: 'disabled',
  contextChips: 'hidden',
  scrollBehavior: 'pinned',
}
```

**Surfaces:** Notification drawer, activity feed

### Card

> *Rich artifact display — each message is a surface.*

```typescript
export const Card: ChatSurfaceSpec = {
  _tag: 'Card',
  label: 'Card',
  composer: 'structured',
  thread: 'card',
  inlineTasks: 'hidden',
  agentSelector: 'tabs',
  connectionStatus: 'hidden',
  frameChrome: 'minimal',
  keyboardShortcuts: 'full',
  contextChips: 'read-only',
  scrollBehavior: 'manual',
}
```

**Surfaces:** Card view contexts, artifact browsers

---

## State Machine

XState governs the surface lifecycle and spec morphing.

```
                    ┌──────────┐
          ┌────────│   idle    │────────┐
          │        └──────────┘        │
          │ CONNECT                    │ MORPH
          ▼                            ▼
    ┌──────────┐              ┌──────────────┐
    │  active   │◄─────────── │   morphing    │
    │           │  MORPH_DONE │              │
    │           │─────────────►│  (animating) │
    │           │    MORPH    │              │
    └──────────┘              └──────────────┘
          │
          │ DISCONNECT / ERROR
          ▼
    ┌──────────┐
    │  error    │
    └──────────┘
```

### Events

| Event | Payload | Effect |
|-------|---------|--------|
| `CONNECT` | `{ adapter }` | Transition idle → active |
| `DISCONNECT` | — | Transition → idle |
| `MORPH` | `{ targetSpec, trigger? }` | Start morph transition |
| `MORPH_DONE` | — | Complete morph, apply new spec |
| `ERROR` | `{ error }` | Transition → error |
| `RECOVER` | — | Attempt reconnection |

### Context

```typescript
interface MorphChatMachineContext {
  surfaceId: string
  activeSpec: ChatSurfaceSpec
  previousSpec: ChatSurfaceSpec | null
  morphTransition: TransitionGrammar | null
  error: string | null
}
```

### Morph Triggers

- **User action:** Click "pop out" button → morph Dock → Conductor
- **Viewport size:** Responsive breakpoint → morph Conductor → Dock
- **Declared:** Parent component passes new spec prop
- **Agent response:** Agent requests expanded view → morph Embed → Dialog

---

## State Ownership

### Atom-as-State Pattern

Per AGENTS.md: Atom.make() is the primary state. No Effect.Ref inside services.

```
┌─────────────────────────────────────────────┐
│             Data Atoms (shared)              │
│                                              │
│  messagesAtom ─────────→ multiple surfaces   │
│  connectionAtom ───────→ multiple surfaces   │
│  streamBufferAtom ─────→ multiple surfaces   │
│                                              │
│  Adapter writes to atoms.                    │
│  Surfaces subscribe via derived atoms.       │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│         UI Atoms (per-surface-instance)      │
│                                              │
│  activeSpecAtom(surfaceId)                   │
│  expansionAtom(surfaceId)                    │
│  scrollPositionAtom(surfaceId)               │
│  focusedMessageAtom(surfaceId)               │
│  selectionAtom(surfaceId)                    │
└─────────────────────────────────────────────┘
```

### Adapter Interface

```typescript
// adapters/types.ts

export interface MorphChatAdapter {
  /** Unique adapter ID — scopes atom families */
  readonly adapterId: string

  /** Subscribe to message stream */
  readonly messages$: Atom.Atom<ReadonlyArray<ChatMessage>>

  /** Connection state */
  readonly connection$: Atom.Atom<ConnectionState>

  /** Send a message */
  readonly send: (params: SendParams) => Effect.Effect<void>

  /** Cancel streaming response */
  readonly cancel: () => Effect.Effect<void>

  /** Reconnect after disconnect */
  readonly reconnect: () => Effect.Effect<void>

  /** Agent roster (if applicable) */
  readonly agents$?: Atom.Atom<ReadonlyArray<AgentInfo>>

  /** Transfer surface config (if applicable) */
  readonly transferConfig?: TransferSurfaceConfig
}
```

Consumers implement this interface:

```typescript
// Example: WebSocket adapter
const wsAdapter = createWebSocketChatAdapter({
  url: 'wss://api.example.com/chat',
  sessionId: 'session-123',
})

// Example: Local/mock adapter
const mockAdapter = createMockChatAdapter({
  responses: [...],
  latencyMs: 200,
})

// Example: Multi-agent adapter
const conductorAdapter = createConductorChatAdapter({
  agentRegistry: myAgentAtoms,
  taskSurface: myTaskAtoms,
})
```

---

## Compound Component API

### Consumer-facing API

```tsx
import { MorphChat } from '@/lib/morphchat'

// ── Preset usage (most common) ──
<MorphChat.Surface
  spec={MorphChat.presets.Conductor}
  adapter={myChatAdapter}
/>

// ── Custom spec ──
<MorphChat.Surface
  spec={{ ...MorphChat.presets.Dock, composer: 'command' }}
  adapter={myChatAdapter}
/>

// ── Morph at runtime ──
function MyChat() {
  const [spec, setSpec] = useState(MorphChat.presets.Widget)

  return (
    <MorphChat.Surface
      spec={spec}
      adapter={myChatAdapter}
      onMorph={(from, to) => console.log(`Morphing ${from._tag} → ${to._tag}`)}
    >
      {/* Optional: override specific bands */}
      <MorphChat.Surface.HeaderBand>
        <MyCustomHeader />
      </MorphChat.Surface.HeaderBand>
    </MorphChat.Surface>
  )
}

// ── Slot overrides (compound pattern) ──
<MorphChat.Surface spec={MorphChat.presets.Conductor} adapter={adapter}>
  <MorphChat.Surface.Composer>
    <MyCustomComposer />
  </MorphChat.Surface.Composer>
</MorphChat.Surface>
```

### Internal topology resolution

The Surface component reads the active spec and renders the appropriate
sub-components. This is NOT prop drilling — it's spec-driven composition:

```tsx
// components/surface-root.tsx (simplified)

function SurfaceContent() {
  const { spec, adapter, skin } = useMorphChatContext()

  return (
    <ChatShell expansionLevel={spec.frameChrome === 'full' ? 'l3' : 'l2'}>
      {spec.frameChrome !== 'none' && <FrameChrome level={spec.frameChrome} />}
      {spec.connectionStatus !== 'hidden' && <ConnectionDisplay mode={spec.connectionStatus} />}
      {spec.agentSelector !== 'hidden' && <AgentSelector mode={spec.agentSelector} />}
      {spec.thread !== 'none' && <ThreadView mode={spec.thread} scroll={spec.scrollBehavior} />}
      {spec.composer !== 'none' && <ComposerView variant={spec.composer} chips={spec.contextChips} />}
      {adapter.transferConfig && <TransferOverlay />}
    </ChatShell>
  )
}
```

---

## Skins System

Inherited from MorphCard. Skins provide slot components for visual customization
without changing structure.

```typescript
// skins/types.ts

export interface MorphChatSkin {
  /** Shell frame styling */
  Shell: ComponentType<ShellSlotProps>
  /** Message bubble styling */
  MessageBubble: ComponentType<MessageSlotProps>
  /** Composer area styling */
  ComposerFrame: ComponentType<ComposerSlotProps>
  /** Header bar styling */
  HeaderBar: ComponentType<HeaderSlotProps>
  /** Badge/chip styling */
  Badge: ComponentType<BadgeSlotProps>
}

// skins/tmnl.tsx — TMNL default skin
export const tmnlChatSkin: MorphChatSkin = {
  Shell: TmnlShell,
  MessageBubble: TmnlMessageBubble,
  ComposerFrame: TmnlComposerFrame,
  HeaderBar: TmnlHeaderBar,
  Badge: TmnlBadge,
}
```

---

## Transition Grammar

Reuses MorphCard's transition grammar for morph animations:

```typescript
// When morphing Widget → Conductor:
// Computed grammar: 'expand:smooth:up'
// Large delta → cinematic transition

// When morphing Dock → Conductor:
// Small delta → 'morph:fast'
// Just width change → slide

deriveGrammarByDelta({
  from: { width: 360, height: 600 },  // Dock
  to: { width: 1200, height: 800 },   // Conductor
})
// → { verb: 'cinematic', modifier: 'slow' }
```

---

## File Structure

```
src/lib/morphchat/
├── ARCHITECTURE.md              # This document
├── index.ts                     # Public API barrel
│
├── schemas/
│   ├── surface-spec.ts          # ChatSurfaceSpec + axis literals
│   ├── adapter-types.ts         # MorphChatAdapter interface
│   ├── message-types.ts         # ChatMessage, ConnectionState, etc.
│   └── index.ts
│
├── specs/
│   ├── conductor.ts             # Full workstation
│   ├── dock.ts                  # Sidebar companion
│   ├── dialog.ts                # Modal conversation
│   ├── widget.ts                # Floating bubble
│   ├── spotlight.ts             # Command palette
│   ├── embed.ts                 # Canvas citizen
│   ├── monitor.ts               # Read-only feed
│   ├── card.ts                  # Artifact display
│   └── index.ts                 # All presets barrel
│
├── machines/
│   ├── surface-machine.ts       # XState: lifecycle + morph transitions
│   ├── surface-stx.ts           # Machine → atom bridge (à la island-stx)
│   └── index.ts
│
├── atoms/
│   ├── registry.ts              # Dedicated MorphChat atom registry
│   ├── surface-atoms.ts         # Per-surface UI atoms (family pattern)
│   ├── data-atoms.ts            # Shared data atoms (messages, connection)
│   └── index.ts
│
├── adapters/
│   ├── types.ts                 # MorphChatAdapter interface
│   ├── mock-adapter.ts          # Mock/demo adapter
│   ├── websocket-adapter.ts     # WebSocket adapter
│   └── index.ts
│
├── components/
│   ├── surface-root.tsx          # MorphChat.Surface — top-level provider
│   ├── surface-content.tsx       # Topology resolver (spec → component tree)
│   ├── frame-chrome.tsx          # Frame rendering (full/minimal/none)
│   ├── thread-view.tsx           # Thread mode resolver
│   ├── composer-view.tsx         # Composer variant resolver
│   ├── connection-display.tsx    # Connection status renderer
│   ├── agent-selector-view.tsx   # Agent selector mode renderer
│   ├── morph-overlay.tsx         # Morph transition overlay animation
│   └── index.ts
│
├── hooks/
│   ├── useMorphChat.ts           # Primary consumer hook
│   ├── useSurfaceMachine.ts      # XState actor hook
│   ├── useMorphTransition.ts     # Transition animation hook
│   ├── useAdapterState.ts        # Adapter atom subscription hook
│   └── index.ts
│
├── skins/
│   ├── types.ts                  # MorphChatSkin interface
│   ├── tmnl.tsx                  # TMNL default skin
│   └── index.ts
│
├── services/
│   ├── SurfaceService.ts         # Effect.Service for surface lifecycle
│   └── index.ts
│
└── __tests__/
    ├── surface-spec.test.ts
    ├── surface-machine.test.ts
    ├── topology-resolver.test.ts
    └── presets.test.ts
```

### Progressive Disclosure

Files are organized for **progressive disclosure**:

1. **Consumer starts at `index.ts`** — imports `MorphChat`, uses presets
2. **Custom spec** — reads `schemas/surface-spec.ts` for axis options
3. **Custom adapter** — reads `adapters/types.ts` for interface
4. **Custom skin** — reads `skins/types.ts` for slot contracts
5. **Internal architecture** — reads `machines/`, `atoms/`, `components/`

---

## Migration from ChatIsolated

`ChatIsolated` becomes `MorphChat.presets.Conductor` (or `Dialog` depending on
context). The existing compound components in `src/lib/chat/` become the
*internal implementation* that MorphChat's topology resolver selects from.

### Relationship to `src/lib/chat/`

```
src/lib/chat/          → Implementation library (components, compound patterns)
src/lib/morphchat/     → Orchestration layer (specs, machines, adapters, topology)
```

MorphChat *composes* from chat/, it does not replace it. The composer, msg,
shell, frame, btn, selector, card, status, banner, empty modules are the
building blocks. MorphChat is the architect.

### Migration steps

1. Build `schemas/` — spec definition, adapter interface
2. Build `specs/` — all 8 presets
3. Build `machines/` — surface lifecycle + morph
4. Build `atoms/` — registry + surface atoms
5. Build `components/` — surface root + topology resolver
6. Build `adapters/` — mock adapter for testbed
7. Build `skins/` — TMNL default
8. Wire testbed — showcase all 8 presets

---

## Testing Strategy

### Schema Tests

Validate all presets decode successfully, custom specs compose correctly,
invalid axis values are rejected.

### Machine Tests

XState model-based testing: morph transitions, error recovery, concurrent
morphs are serialized.

### Topology Tests

Snapshot tests: given spec X, assert rendered component tree matches expected
topology. No visual regression — structural assertion only.

### Adapter Tests

Mock adapter: verify atom updates, send/cancel/reconnect contracts.

### Integration Tests

Mount full surface with mock adapter, morph between presets, verify no
state leaks between morph transitions.
