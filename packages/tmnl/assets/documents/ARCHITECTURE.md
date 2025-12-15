# TMNL System Architecture

> **VAL**: Vigilant Architecture Layer — the guardian of boundaries, enforcer of contracts, watchful sentinel against entropy.

## Overview

TMNL (Terminal & Multi-Modal Navigation Layer) is a modular development environment built on **Effect-TS** for dependency injection, **effect-atom** for reactive state, and **Tauri** for native desktop capabilities.

The architecture follows the **Emacs philosophy**: functions, commands, variables, and hooks as first-class citizens — with a modern twist via Effect's type-safe DI and Schema validation.

---

## Core Principles

### 1. Effect as the Spine

Every service is an `Effect.Service`. Layers are vertebrae. The runtime is the nervous system.

```
Layer.mergeAll(
  CommandService.Default,
  MinibufferService.Default,
  OverlayRegistry.Default,
  DataManager.Default,
  ...
)
```

### 2. Atom-as-State

React consumes state via `effect-atom`. Services mutate atoms directly. No `useState` pollution.

```typescript
// Service mutates atom
Atom.set(overlaysAtom, newOverlays)

// React subscribes
const overlays = useAtomValue(overlaysAtom)
```

### 3. Schema-First Types

Domain types are Effect Schemas. Runtime validation, encode/decode, JSON Schema generation.

```typescript
const Command = Schema.TaggedStruct("Command", {
  id: Schema.String,
  name: Schema.NonEmptyString,
  // ...
})
```

### 4. Testbed-Driven Development

Every subsystem has a testbed. Testbeds are proving grounds, not production — they validate integration patterns before synthesis.

---

## System Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PRESENTATION                                    │
│  React Components · Overlays · Drawers · Modals · Panels                    │
│  Animation: Framer Motion · GSAP · anime.js                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ useAtomValue, useDrawer, useMinibuffer
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              STATE LAYER                                     │
│  effect-atom: Reactive atoms with Effect integration                        │
│  Atom.make() · Atom.runtime() · Atom.batch() · Atom.family()               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Atom.set, Atom.get
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SERVICE LAYER                                   │
│  Effect.Service<T> · Context.Tag · Layer.succeed                           │
│                                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│  │   Commands   │ │  Minibuffer  │ │   Overlays   │ │  DataManager │      │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│  │   Hotkeys    │ │    Search    │ │   Streams    │ │    Slider    │      │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│  │  TableSvc    │ │   DataGrid   │ │     AMS      │ │   Sidebar    │      │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Effect.gen, Layer.provide
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              RUNTIME LAYER                                   │
│  Tauri: Native desktop shell, IPC, window management                        │
│  Rust: High-res timing, serial I/O, WASM kernels                           │
│  NATS/NEX: Distributed messaging (via Nix derivations)                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Domain Architecture

### Commands System

**Location**: `src/lib/commands/`

**Philosophy**: Commands are functions with an `interactive` specification (à la Emacs). They can be invoked via M-x or keybindings.

```
┌─────────────────────────────────────────────────────────────────┐
│  CommandService (Effect.Service)                                 │
│  ├── get(id) → Option<Command>                                  │
│  ├── execute(id) → Effect<void, CommandError>                   │
│  ├── executeEntity(id, entity, ctx) → Effect<void>              │
│  ├── list() → Effect<Command[]>                                 │
│  ├── getBindings() → Effect<KeyBinding[]>                       │
│  └── overrideBinding(id, keys) → Effect<void>                   │
│                                                                  │
│  Atoms:                                                          │
│  ├── commandsAtom: Map<string, Command>                         │
│  ├── bindingOverridesAtom: KeyBindingOverride[]                 │
│  └── effectiveBindingsAtom: KeyBinding[] (derived)              │
│                                                                  │
│  Integration:                                                    │
│  ├── wire.ts: Keyboard listener → CommandService.execute()      │
│  └── decorators.ts: @command() registration                     │
└─────────────────────────────────────────────────────────────────┘
```

**Key Types**:
- `GlobalCommand`: No entity context, invoked via M-x
- `EntityCommand<T>`: Requires entity context (e.g., "delete selection")
- `KeyBinding`: Maps key chord to command ID

### Minibuffer System

**Location**: `src/lib/minibuffer/`

**Philosophy**: Generic prompt engine. The minibuffer is a configurable bottom drawer that can render any content. It does NOT know about commands — it's just an I/O pipe.

```
┌─────────────────────────────────────────────────────────────────┐
│  MinibufferService (Effect.Service)                              │
│  ├── prompt(msg, opts) → Effect<string>     # read-string       │
│  ├── read(prompt, providerId) → Effect<string>  # completing-read│
│  ├── yOrN(prompt) → Effect<boolean>         # y-or-n-p          │
│  ├── message(text, dur) → Effect<void>      # echo area         │
│  └── cancel() → Effect<void>                # C-g               │
│                                                                  │
│  Provider Registry:                                              │
│  ├── providerRegistry.register(provider)                        │
│  ├── providerRegistry.get(id) → CompletionProvider              │
│  └── CommandProvider registered externally from commands/       │
│                                                                  │
│  Animation Config:                                               │
│  └── { animate: "slide" | "none" | boolean }                    │
└─────────────────────────────────────────────────────────────────┘
```

**Emacs Mapping**:
| Emacs | Minibuffer |
|-------|------------|
| `read-string` | `prompt()` |
| `completing-read` | `read(providerId)` |
| `y-or-n-p` | `yOrN()` |
| `message` | `message()` |

### Overlay System

**Location**: `src/lib/overlays/`

**Philosophy**: Unified overlay management for drawers, modals, toasts, sidebars. Z-order management, animation states, slot-based rendering.

```
┌─────────────────────────────────────────────────────────────────┐
│  Visual Overlay Provider (React Context)                         │
│  ├── open(type, options) → VisualOverlayId                      │
│  ├── close(id) → void                                           │
│  ├── remove(id) → void                                          │
│  ├── bringToFront(id) → void                                    │
│  └── sendToBack(id) → void                                      │
│                                                                  │
│  PERF: Atom.batch() + startTransition for snappy mutations      │
│                                                                  │
│  Atoms:                                                          │
│  ├── visualOverlaysAtom: Map<VisualOverlayId, VisualOverlayInstance>│
│  ├── zOrderByTypeAtom: Map<VisualOverlayType, VisualOverlayId[]>│
│  └── slotsAtom: Map<SlotId, SlotState>                          │
│                                                                  │
│  Renderers:                                                      │
│  ├── DrawerRenderer (Framer Motion spring animations)           │
│  ├── ModalRenderer                                              │
│  ├── ToastRenderer                                              │
│  └── SidebarRenderer                                            │
└─────────────────────────────────────────────────────────────────┘
```

### Data Manager

**Location**: `src/lib/data-manager/`

**Philosophy**: Service-scoped data orchestration with hybrid dispatch (Effect fibers + Web Workers). Search kernels for fuzzy/prefix/exact matching.

```
┌─────────────────────────────────────────────────────────────────┐
│  DataManager (Effect.Service)                                    │
│  ├── search(query, opts) → Stream<SearchResult>                 │
│  ├── index(items) → Effect<void>                                │
│  ├── dispatchHot(task) → Effect<Result> (untraced)              │
│  └── dispatch(task) → Effect<Result> (traced via withSpan)      │
│                                                                  │
│  Kernels:                                                        │
│  ├── SearchKernel (FlexSearch + Linear drivers)                 │
│  └── KernelRegistry (dynamic kernel registration)               │
│                                                                  │
│  Versions:                                                       │
│  ├── v1: Original implementation                                │
│  └── v2: Refined with better atom patterns                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Integration Flow: M-x Command Execution

```
User presses M-x
       │
       ▼
┌──────────────┐
│   Hotkeys    │  wire.ts intercepts keydown
│   Layer      │  Recognizes M-x binding
└──────┬───────┘
       │ calls
       ▼
┌──────────────┐
│  Commands    │  CommandService.executeInteractive()
│   Service    │  (to be wired)
└──────┬───────┘
       │ calls
       ▼
┌──────────────┐
│  Minibuffer  │  minibuffer.read(CommandProvider, { animate: "slide" })
│   Service    │  Opens drawer, shows completions
└──────┬───────┘
       │ user selects
       ▼
┌──────────────┐
│  Commands    │  CommandService.execute(selectedId)
│   Service    │  Runs the command
└──────────────┘
```

---

## Tauri + Rust Vision

### Current State

```rust
// src-tauri/src/lib.rs
#[tauri::command]
fn now_micros() -> u64 {
    // High-resolution timing for animation/profiling
}
```

### Future Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Effect RPC Layer                                                │
│  ├── TaggedRequest<Tag, Input, Output>                          │
│  ├── TaggedError<Tag, Data>                                     │
│  └── Tagged* extension APIs                                     │
│                                                                  │
│  Transport:                                                      │
│  ├── Tauri invoke (IPC to Rust)                                 │
│  ├── Web Workers (parallel JS execution)                        │
│  └── NATS/NEX (distributed messaging)                           │
│                                                                  │
│  Rust Capabilities:                                              │
│  ├── Serial I/O (hardware interfaces)                           │
│  ├── WASM kernels (search, compression, crypto)                 │
│  ├── File system operations (native performance)                │
│  └── System integration (notifications, tray, etc.)             │
│                                                                  │
│  Config:                                                         │
│  ├── Nix derivations (dynamic service composition)              │
│  └── Rescript DSL (type-safe config generation)                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
src/lib/
├── commands/           # Command system (Emacs M-x)
│   ├── service.ts      # CommandService (Effect.Service)
│   ├── types.ts        # Command, GlobalCommand, EntityCommand
│   ├── decorators.ts   # @command() registration
│   ├── defaults.ts     # Default keybindings
│   ├── wire.ts         # Keyboard listener
│   └── persistence.ts  # User binding storage
│
├── minibuffer/         # Generic prompt engine
│   ├── services/       # MinibufferService
│   ├── providers/      # Completion provider registry
│   ├── components/     # MinibufferContent UI
│   ├── atoms/          # Reactive state
│   └── hooks/          # useMinibuffer
│
├── overlays/           # Unified overlay system
│   ├── visual/         # Visual overlay provider
│   │   ├── providers/  # VisualOverlayProvider
│   │   ├── renderers/  # Drawer, Modal, Toast, Sidebar
│   │   ├── slots/      # GlobalSlot, LocalSlot
│   │   └── hooks/      # useDrawer, useModal
│   ├── atoms/          # Overlay state atoms
│   ├── schemas/        # VisualOverlayId, SlotId, etc.
│   └── services/       # OverlayRegistry, PortHub
│
├── data-manager/       # Data orchestration
│   ├── v1/             # Original implementation
│   ├── v2/             # Refined implementation
│   └── kernels/        # SearchKernel, etc.
│
├── search/             # Search framework
│   ├── drivers/        # FlexSearch, Linear
│   └── operators/      # withMinScore, withBoosts
│
├── hotkeys/            # Keybinding system
│   ├── atoms/          # Key state atoms
│   └── services/       # KeyParser
│
├── slider/             # DAW-grade sliders
│   ├── v1/services/    # SliderBehavior (Linear, Log, Decibel)
│   └── components/     # Slider UI
│
├── streams/            # Effect streams
│   └── constructs/     # ChannelService, FeedsManager, Feed
│
├── data-grid/          # AG-Grid integration
│   ├── services/       # FlashTrackingService, GridDragService
│   └── renderers/      # Cell renderers
│
├── table-service/      # TableService
├── ams/                # Asset Management System
├── sidebar/            # Persistent sidebar
└── animation/          # Animation primitives
```

---

## Design Decisions

### ADR-001: Commands Separate from Minibuffer

**Decision**: Commands are a standalone system. Minibuffer is just an I/O pipe.

**Rationale**: Follows Emacs model. `execute-extended-command` (M-x) uses minibuffer, but minibuffer doesn't know about commands. This enables:
- Multiple command sources (not just minibuffer)
- Generic minibuffer for any completion
- Clean separation of concerns

### ADR-002: Atom-as-State Pattern

**Decision**: Use `Atom.make()` as primary state, not `Effect.Ref` inside services.

**Rationale**: Services mutate atoms directly, React subscribes directly. Eliminates Ref→Atom bridge: no polling, no SubscriptionRef, no streams-to-consume-streams.

### ADR-003: Performance via Batching + Transitions

**Decision**: Use `Atom.batch()` + `startTransition()` for all overlay mutations.

**Rationale**:
- `Atom.batch()` coalesces multiple updates into single notification
- `startTransition()` marks updates as non-urgent, allowing React to prioritize user input
- Result: Snappy drawer toggles even with complex state

### ADR-004: Animation Configurable per Invocation

**Decision**: Minibuffer drawer accepts `{ animate: "slide" | "none" }`.

**Rationale**: Commands want slide animation for cmdk-style UX. Other use cases (transient status) want instant snap. One system, configurable behavior.

---

## References

- [Effect Documentation](https://effect.website)
- [effect-atom Documentation](https://github.com/tim-smart/effect-atom)
- [Emacs Manual - Commands](https://www.gnu.org/software/emacs/manual/html_node/elisp/Defining-Commands.html)
- [Emacs Manual - Minibuffer](https://www.gnu.org/software/emacs/manual/html_node/elisp/Minibuffers.html)
- `.edin/epochs/EPOCH-0003.md` - Minibuffer/Commands separation
- `.edin/EFFECT_PATTERNS.md` - Effect-Atom pattern registry
