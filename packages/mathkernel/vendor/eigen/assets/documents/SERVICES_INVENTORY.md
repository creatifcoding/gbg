# TMNL Effect Services Inventory

> Comprehensive catalog of all Effect.Service definitions in the codebase.

---

## Service Index

| Domain | Service | Tag | Location |
|--------|---------|-----|----------|
| **Commands** | `CommandService` | `tmnl/commands/CommandService` | `src/lib/commands/service.ts` |
| **Minibuffer** | `MinibufferService` | `tmnl/minibuffer/MinibufferService` | `src/lib/minibuffer/services/MinibufferService.ts` |
| **Hotkeys** | `KeyParser` | `tmnl/hotkeys/KeyParser` | `src/lib/hotkeys/services/KeyParser.ts` |
| **Overlays** | `OverlayRegistry` | `tmnl/overlays/OverlayRegistry` | `src/lib/overlays/services/OverlayRegistry.ts` |
| **Overlays** | `PortHub` | `tmnl/overlays/PortHub` | `src/lib/overlays/services/PortHub.ts` |
| **Overlays** | `EventDispatcher` | `tmnl/overlays/EventDispatcher` | `src/lib/overlays/services/EventDispatcher.ts` |
| **Data Manager v1** | `DataManager<T>` | `tmnl/data-manager/DataManager` | `src/lib/data-manager/v1/DataManager.ts` |
| **Data Manager v1** | `KernelRegistry` | `tmnl/data-manager/KernelRegistry` | `src/lib/data-manager/v1/namespaces/KernelRegistry.ts` |
| **Data Manager v1** | `SearchKernel` | `tmnl/data-manager/SearchKernel` | `src/lib/data-manager/v1/kernels/SearchKernel.ts` |
| **Data Manager v2** | `KernelRegistry` | `tmnl/data-manager/v2/KernelRegistry` | `src/lib/data-manager/v2/KernelRegistry.ts` |
| **Data Manager v2** | `SearchKernel` | `tmnl/data-manager/v2/SearchKernel` | `src/lib/data-manager/v2/kernels/SearchKernel.ts` |
| **Search** | `SearchService` | `tmnl/search/SearchService` | `src/lib/search/types.ts` |
| **Slider** | `SliderBehavior` | `tmnl/slider/SliderBehavior` | `src/lib/slider/v1/services/SliderBehavior.ts` |
| **Streams** | `ChannelService` | `tmnl/streams/ChannelService` | `src/lib/streams/constructs/ChannelService.ts` |
| **Streams** | `FeedsManager` | `tmnl/streams/FeedsManager` | `src/lib/streams/constructs/FeedsManager.ts` |
| **Table** | `TableService` | `tmnl/TableService` | `src/lib/table-service/TableService.ts` |
| **Context** | `RecontextService` | `tmnl/context/RecontextService` | `src/lib/context/atoms/index.ts` |
| **Schema (Spike)** | `PayloadSchemaRegistry` | `tmnl/schema/PayloadSchemaRegistry` | `src/lib/schema-system/spikes/spike-4-schema-registry.ts` |

---

## Service Details

### CommandService

**Location**: `src/lib/commands/service.ts`

**Tag**: `tmnl/commands/CommandService`

**Pattern**: `Context.Tag` with `Layer.succeed`

**Purpose**: Command registration, execution, and keybinding management.

**Interface**:
```typescript
interface CommandServiceImpl {
  get: (id: string) => Effect<Option<Command>>
  execute: (id: string) => Effect<void, CommandError>
  executeEntity: <T>(id: string, entity: T, ctx?) => Effect<void, CommandError>
  list: () => Effect<readonly Command[]>
  listByScope: (scope: CommandScope) => Effect<readonly Command[]>
  getBindings: () => Effect<readonly KeyBinding[]>
  overrideBinding: (registry, commandId, keys, scope?) => Effect<void>
  resetBinding: (registry, commandId) => Effect<void>
  resetAllBindings: (registry) => Effect<void>
}
```

**Atoms**:
- `commandsAtom`: `Map<string, Command>`
- `bindingOverridesAtom`: `KeyBindingOverride[]`
- `effectiveBindingsAtom`: `KeyBinding[]` (derived)

**Dependencies**: None (leaf service)

**Consumers**: Hotkeys wire, command palette UI

---

### MinibufferService

**Location**: `src/lib/minibuffer/services/MinibufferService.ts`

**Tag**: `tmnl/minibuffer/MinibufferService`

**Pattern**: `Context.Tag` with `Layer.succeed`

**Purpose**: Emacs-inspired prompt engine with blocking semantics via `Effect.Deferred`.

**Interface**:
```typescript
interface MinibufferServiceImpl {
  prompt: (message, opts?) => Effect<string>           // read-string
  read: (prompt, providerId, opts?) => Effect<string>  // completing-read
  executeCommand: () => Effect<void>                   // M-x (TO BE REMOVED)
  yOrN: (prompt) => Effect<boolean>                    // y-or-n-p
  message: (text, duration?) => Effect<void>           // echo area
  showWhichKey: (prefix) => Effect<void>               // which-key hints
  cancel: () => Effect<void>                           // C-g
  resolveWithCompletion: (completion) => Effect<void>  // UI callback
}
```

**Atoms** (via `../atoms`):
- `minibufferModeAtom`: `"idle" | "prompt" | "completing" | "message"`
- `minibufferInputAtom`: `string`
- `minibufferPromptAtom`: `string`
- `filteredCompletionsAtom`: `Completion[]`
- `minibufferSelectedIndexAtom`: `number`

**Dependencies**: Provider registry (for `read()`)

**Consumers**: `useMinibuffer` hook, commands (via `executeCommand`)

**Note**: `executeCommand()` should be moved to CommandService per EPOCH-0003.

---

### KeyParser

**Location**: `src/lib/hotkeys/services/KeyParser.ts`

**Tag**: `tmnl/hotkeys/KeyParser`

**Pattern**: `Context.Tag` with `Layer.succeed`

**Purpose**: Parse keyboard events into normalized key chord representations.

**Interface**:
```typescript
interface KeyParserImpl {
  parse: (event: KeyboardEvent) => KeyChord
  normalize: (chord: string) => string
  matches: (event: KeyboardEvent, binding: string) => boolean
}
```

**Dependencies**: None (leaf service)

**Consumers**: Hotkeys wire (`src/lib/commands/wire.ts`)

---

### OverlayRegistry

**Location**: `src/lib/overlays/services/OverlayRegistry.ts`

**Tag**: `tmnl/overlays/OverlayRegistry`

**Pattern**: `Context.Tag` with `Layer.succeed`

**Purpose**: Registry for overlay instances with lifecycle management.

**Interface**:
```typescript
interface OverlayRegistryImpl {
  register: (id, config) => Effect<void>
  unregister: (id) => Effect<void>
  get: (id) => Effect<Option<OverlayInstance>>
  list: () => Effect<readonly OverlayInstance[]>
  listByType: (type) => Effect<readonly OverlayInstance[]>
}
```

**Dependencies**: None

**Consumers**: Visual overlay provider, renderers

---

### PortHub

**Location**: `src/lib/overlays/services/PortHub.ts`

**Tag**: `tmnl/overlays/PortHub`

**Pattern**: `Context.Tag` with `Layer.succeed`

**Purpose**: Portal target management for overlay rendering.

**Interface**:
```typescript
interface PortHubImpl {
  registerPort: (id, element) => Effect<void>
  unregisterPort: (id) => Effect<void>
  getPort: (id) => Effect<Option<HTMLElement>>
}
```

**Dependencies**: None

**Consumers**: Overlay slot components

---

### EventDispatcher

**Location**: `src/lib/overlays/services/EventDispatcher.ts`

**Tag**: `tmnl/overlays/EventDispatcher`

**Pattern**: `Context.Tag` with `Layer.succeed`

**Purpose**: Event bus for overlay lifecycle events.

**Interface**:
```typescript
interface EventDispatcherImpl {
  dispatch: (event: OverlayEvent) => Effect<void>
  subscribe: (handler) => Effect<() => void>
}
```

**Dependencies**: None

**Consumers**: Overlay renderers, animation coordinators

---

### DataManager<T> (v1)

**Location**: `src/lib/data-manager/v1/DataManager.ts`

**Tag**: `tmnl/data-manager/DataManager`

**Pattern**: `Effect.Service<T>()` with `effect:` factory

**Purpose**: Service-scoped data orchestration with kernel dispatch.

**Interface**:
```typescript
interface DataManagerImpl<T> {
  search: (query, opts) => Stream<SearchResult<T>>
  index: (items: T[]) => Effect<void>
  dispatch: (task) => Effect<Result>      // traced
  dispatchHot: (task) => Effect<Result>   // untraced hot path
  stats: () => Effect<DataManagerStats>
}
```

**Dependencies**: `SearchKernel`, `KernelRegistry`

**Consumers**: DataManager testbeds, search UI

---

### KernelRegistry (v1 & v2)

**Location**:
- v1: `src/lib/data-manager/v1/namespaces/KernelRegistry.ts`
- v2: `src/lib/data-manager/v2/KernelRegistry.ts`

**Tag**: `tmnl/data-manager/KernelRegistry` (v1), `tmnl/data-manager/v2/KernelRegistry` (v2)

**Pattern**: `Effect.Service<T>()` with `effect:` factory

**Purpose**: Factory + lookup for kernel instances with namespaced atoms.

**Interface**:
```typescript
interface KernelRegistryImpl {
  create: (namespace, config) => Effect<Kernel>
  get: (namespace) => Effect<Option<Kernel>>
  destroy: (namespace) => Effect<void>
  list: () => Effect<readonly string[]>
}
```

**Atoms** (namespaced):
- `kernelAtomFamily(namespace)`: Individual kernel state
- `kernelIndexAtom`: Active kernel listing

**Dependencies**: Kernel implementations (SearchKernel, etc.)

**Consumers**: DataManager, search components

---

### SearchKernel (v1 & v2)

**Location**:
- v1: `src/lib/data-manager/v1/kernels/SearchKernel.ts`
- v2: `src/lib/data-manager/v2/kernels/SearchKernel.ts`

**Tag**: `tmnl/data-manager/SearchKernel` (v1), `tmnl/data-manager/v2/SearchKernel` (v2)

**Pattern**: `Effect.Service<T>()` with `effect:` factory

**Purpose**: Search execution with FlexSearch and Linear drivers.

**Interface**:
```typescript
interface SearchKernelImpl {
  search: (query, opts) => Stream<SearchResult>
  index: (items) => Effect<void>
  setDriver: (driver: "flex" | "linear") => Effect<void>
  getStats: () => Effect<SearchStats>
}
```

**Dependencies**: FlexSearch (optional), Linear fallback

**Consumers**: KernelRegistry, DataManager

---

### SearchService

**Location**: `src/lib/search/types.ts`

**Tag**: `tmnl/search/SearchService`

**Pattern**: `Context.Tag` (interface only)

**Purpose**: Stream-based search interface with driver abstraction.

**Interface**:
```typescript
interface SearchServiceImpl<T> {
  search: (query) => Stream<SearchResult<T>>
  prefix: (query) => Stream<SearchResult<T>>
  fuzzy: (query) => Stream<SearchResult<T>>
  index: (items: T[]) => Effect<void>
  add: (item: T) => Effect<void>
  remove: (id: string) => Effect<void>
  stats: () => Effect<SearchStats>
  clear: () => Effect<void>
}
```

**Dependencies**: Driver (FlexSearch or Linear)

**Consumers**: Search testbed, command search

---

### SliderBehavior

**Location**: `src/lib/slider/v1/services/SliderBehavior.ts`

**Tag**: `tmnl/slider/SliderBehavior`

**Pattern**: `Context.Tag` with multiple `Layer.succeed` implementations

**Purpose**: Runtime-swappable slider value transformation.

**Interface**:
```typescript
interface SliderBehaviorShape {
  normalizedToValue: (normalized: number, config: SliderConfig) => number
  valueToNormalized: (value: number, config: SliderConfig) => number
  formatValue: (value: number, config: SliderConfig) => string
  parseValue: (input: string, config: SliderConfig) => Option<number>
}
```

**Implementations**:
- `LinearBehavior.Default`
- `LogarithmicBehavior.Default`
- `DecibelBehavior.Default`
- `ExponentialBehavior.Default`
- `SteppedBehavior.Default`

**Dependencies**: None (leaf service)

**Consumers**: Slider component, slider testbed

---

### ChannelService

**Location**: `src/lib/streams/constructs/ChannelService.ts`

**Tag**: `tmnl/streams/ChannelService`

**Pattern**: `Context.Tag` with `Layer.succeed`

**Purpose**: Effect Channel management for pub/sub patterns.

**Interface**:
```typescript
interface ChannelServiceImpl {
  create: <A, E>(id: string) => Effect<Channel<A, E>>
  get: <A, E>(id: string) => Effect<Option<Channel<A, E>>>
  publish: <A>(id: string, value: A) => Effect<void>
  subscribe: <A, E>(id: string) => Stream<A, E>
  close: (id: string) => Effect<void>
}
```

**Dependencies**: None

**Consumers**: Streams playground, real-time data flows

---

### FeedsManager

**Location**: `src/lib/streams/constructs/FeedsManager.ts`

**Tag**: `tmnl/streams/FeedsManager`

**Pattern**: `Context.Tag` with `Layer.succeed`

**Purpose**: Higher-order feed orchestration managing multiple Feed instances.

**Interface**:
```typescript
interface FeedsManagerImpl {
  create: <A, E, R>(id: string, source: Stream<A, E, R>) => Effect<Feed<A, E, R>>
  start: (id: string) => Effect<void>
  stop: (id: string) => Effect<void>
  destroy: (id: string) => Effect<void>
  list: () => Effect<readonly string[]>
}
```

**Dependencies**: Feed construct

**Consumers**: Streams playground, telemetry dashboards

---

### TableService

**Location**: `src/lib/table-service/TableService.ts`

**Tag**: `tmnl/TableService`

**Pattern**: `Context.Tag` with `Layer.succeed`

**Purpose**: TmnlDataGrid variant configuration with presets and per-grid overrides.

**Interface**:
```typescript
interface TableServiceImpl {
  getVariant: (gridId: string) => Effect<DataGridVariant>
  setVariant: (gridId: string, variant: DataGridVariant) => Effect<void>
  getPreset: (name: string) => Effect<Option<VariantPreset>>
  registerPreset: (name: string, preset: VariantPreset) => Effect<void>
}
```

**Atoms**:
- `variantPresetsAtom`: `Map<string, VariantPreset>`
- `gridVariantsAtom`: `Map<string, DataGridVariant>`

**Dependencies**: None

**Consumers**: DataGrid testbed, grid components

---

### RecontextService

**Location**: `src/lib/context/atoms/index.ts`

**Tag**: `tmnl/context/RecontextService`

**Pattern**: `Context.Tag` with `Layer.succeed`

**Purpose**: Context reification and transformation for multi-modal navigation.

**Interface**:
```typescript
interface RecontextServiceImpl {
  recontextualize: (source: Context, target: ContextType) => Effect<Context>
  getAvailableContexts: () => Effect<readonly ContextType[]>
}
```

**Dependencies**: None

**Consumers**: Context-aware components

---

## Service Dependency Graph

```
                    ┌─────────────────┐
                    │  CommandService │
                    └────────┬────────┘
                             │ uses
                             ▼
┌──────────────┐    ┌─────────────────┐    ┌──────────────┐
│  KeyParser   │◄───│  Hotkeys Wire   │───►│ MinibufferSvc│
└──────────────┘    └─────────────────┘    └──────┬───────┘
                                                   │ uses
                                                   ▼
                                           ┌──────────────┐
                                           │  Providers   │
                                           └──────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Overlay System                            │
│  ┌───────────────┐  ┌───────────┐  ┌─────────────────┐     │
│  │ OverlayRegistry│  │  PortHub  │  │ EventDispatcher │     │
│  └───────────────┘  └───────────┘  └─────────────────┘     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Data Manager                              │
│  ┌─────────────┐    ┌────────────────┐    ┌──────────────┐ │
│  │ DataManager │───►│ KernelRegistry │───►│ SearchKernel │ │
│  └─────────────┘    └────────────────┘    └──────────────┘ │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Streams                                   │
│  ┌────────────────┐         ┌──────────────┐               │
│  │ ChannelService │         │ FeedsManager │               │
│  └────────────────┘         └──────────────┘               │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│SliderBehavior│    │ TableService │    │RecontextSvc  │
└──────────────┘    └──────────────┘    └──────────────┘
     (leaf)              (leaf)              (leaf)
```

---

## Layer Composition Patterns

### Basic Service Provision

```typescript
import { Effect, Layer } from "effect"
import { CommandService } from "@/lib/commands"

const program = Effect.gen(function* () {
  const commands = yield* CommandService
  const list = yield* commands.list()
  return list
})

Effect.runPromise(
  program.pipe(Effect.provide(CommandService.Default))
)
```

### Multiple Services

```typescript
const MainLayer = Layer.mergeAll(
  CommandService.Default,
  MinibufferService.Default,
  OverlayRegistry.Default,
  DataManager.Default,
)

Effect.runPromise(
  program.pipe(Effect.provide(MainLayer))
)
```

### Atom.runtime for React

```typescript
import { Atom } from "@effect-atom/atom"

const runtimeAtom = Atom.runtime(
  Layer.mergeAll(
    CommandService.Default,
    MinibufferService.Default,
  )
)

// In component
const result = useAtomValue(
  runtimeAtom.atom(
    Effect.gen(function* () {
      const commands = yield* CommandService
      return yield* commands.list()
    })
  )
)
```

---

## Testing Patterns

### @effect/vitest for Services

```typescript
import { describe, it, expect } from "@effect/vitest"
import { Effect } from "effect"
import { CommandService } from "./service"

describe("CommandService", () => {
  it.effect("lists all commands", () =>
    Effect.gen(function* () {
      const svc = yield* CommandService
      const list = yield* svc.list()
      expect(list.length).toBeGreaterThan(0)
    }).pipe(Effect.provide(CommandService.Default))
  )
})
```

### Registry-based Atom Testing

```typescript
import { Registry, Atom } from "@effect-atom/atom"

describe("Command atoms", () => {
  it("tracks registered commands", () => {
    const r = Registry.make()

    // Initial state
    expect(r.get(commandsAtom).size).toBe(0)

    // Add command
    r.set(commandsAtom, new Map([["test", testCommand]]))
    expect(r.get(commandsAtom).size).toBe(1)
  })
})
```

---

## Version History

| Version | Services Added | Notes |
|---------|----------------|-------|
| 0.1 | CommandService, KeyParser | Initial command system |
| 0.2 | MinibufferService | Emacs-style prompts |
| 0.3 | OverlayRegistry, PortHub, EventDispatcher | Overlay unification |
| 0.4 | DataManager v1, KernelRegistry v1, SearchKernel v1 | Data orchestration |
| 0.5 | SliderBehavior | DAW-grade sliders |
| 0.6 | ChannelService, FeedsManager | Stream constructs |
| 0.7 | TableService | Grid variant management |
| 0.8 | DataManager v2, KernelRegistry v2, SearchKernel v2 | Refined patterns |
| 0.9 | RecontextService | Context reification |
