# Listener Subsystem Architecture

## Overview

The Listener subsystem provides Emacs-style hooks (renamed to "listeners") for event handling in TMNL. It is designed around three core principles:

1. **EventJournal as Source of Truth** - Listener registrations are events persisted to the journal
2. **Atoms for Reactivity** - Derived reactive state via `Atom.family` for per-listener-name queries
3. **ECS Perspective** - Listeners are "systems" that react to entity/component changes

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         React Components                         │
│  ┌─────────────────────┐         ┌─────────────────────────┐    │
│  │ useListenersAtoms() │         │ listenersByNameAtom(...)│    │
│  └──────────┬──────────┘         └───────────┬─────────────┘    │
└─────────────┼─────────────────────────────────┼─────────────────┘
              │                                 │
              ▼                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      effect-atom Layer                           │
│  ┌───────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │ listenerRun-  │  │allListeners- │  │ listenersByName-   │   │
│  │ timeAtom      │  │Atom          │  │ Atom (family)      │   │
│  └───────┬───────┘  └──────┬───────┘  └────────┬───────────┘   │
└──────────┼─────────────────┼───────────────────┼────────────────┘
           │                 │                   │
           ▼                 ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ListenerRegistry Service                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Ref<Map<ListenerName, StoredListener[]>>                 │   │
│  │                                                           │   │
│  │  add(name, handler, opts) → id                           │   │
│  │  remove(id)                                               │   │
│  │  run(name, payload) → forEach handler, catch errors      │   │
│  │  getAll() → ListenerDefinition[]                         │   │
│  │  getByName(name) → ListenerDefinition[]                  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
           │
           ▼ (Future: EventJournal persistence)
┌─────────────────────────────────────────────────────────────────┐
│                      EventJournal (TODO)                         │
│  ListenerRegister events                                         │
│  ListenerRemove events                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Emacs Hook Mapping

| Emacs Concept | Listener Subsystem |
|---------------|-------------------|
| `add-hook` | `registry.add(name, handler)` |
| `remove-hook` | `registry.remove(id)` |
| `run-hooks` | `registry.run(name, payload)` |
| Hook variable | `ListenerName` (e.g., "layer:after-resort") |
| Hook function | `ListenerHandler<T>` |
| Depth/order | `depth` option (lower runs first) |

---

## Key Design Decisions

### 1. Listeners vs Hooks
**Decision**: Renamed "hooks" to "listeners" to avoid confusion with React hooks.

### 2. Type-Safe Event Names
**Decision**: `TypedListenerName` ensures only valid event names are used.

```typescript
type TypedListenerName = keyof ListenerPayloads;
// "layer:after-resort" | "layer:before-visibility-change" | ...
```

### 3. Error Isolation
**Decision**: Each listener runs in isolation; one failure doesn't stop others.

```typescript
yield* Effect.forEach(listeners, (l) =>
  l.handler(payload).pipe(
    Effect.catchAll((e) => Effect.logWarning(`Listener failed: ${e}`))
  )
);
```

### 4. Depth-Based Ordering
**Decision**: Listeners run in order of `depth` (lower first), like Emacs.

```typescript
const sorted = listeners.sort((a, b) => a.depth - b.depth);
```

### 5. In-Memory First
**Decision**: Start with in-memory storage, add EventJournal persistence later.

---

## File Structure

```
src/lib/listeners/
├── types.ts            # Core types: ListenerId, ListenerName, etc.
├── Events.ts           # EventGroup definitions for journal persistence
├── ListenerRegistry.ts # Main service: add/remove/run
├── atoms.ts            # Atom bindings for React
└── index.ts            # Public exports
```

---

## Usage

### Basic Usage (Effect)

```typescript
import { ListenerRegistry } from "@/lib/listeners";

const program = Effect.gen(function* () {
  const registry = yield* ListenerRegistry;

  // Register a listener
  const id = yield* registry.add(
    "layer:after-resort",
    (payload) => Effect.log(`Layer ${payload.id} moved to z:${payload.newZIndex}`)
  );

  // Trigger the listener
  yield* registry.run("layer:after-resort", {
    id: "layer-1",
    oldZIndex: 10,
    newZIndex: 20
  });

  // Remove when done
  yield* registry.remove(id);
});

Effect.runPromise(program.pipe(Effect.provide(ListenerRegistry.Default)));
```

### React Integration (Atoms)

```typescript
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react";
import { listenersByNameAtom, listenerOpsAtom } from "@/lib/listeners";

function ListenerPanel({ name }: { name: string }) {
  const listeners = useAtomValue(listenersByNameAtom(name));

  return (
    <ul>
      {listeners.map(l => (
        <li key={l.id}>{l.handlerRef} (depth: {l.depth})</li>
      ))}
    </ul>
  );
}
```

### Integration with LayerManager

```typescript
// In LayerManager.bringToFront:
const bringToFront = (id: string) => Effect.gen(function* () {
  const registry = yield* ListenerRegistry;
  const layers = yield* Ref.get(layersRef);
  const target = layers.find(l => l.id === id);

  const oldZIndex = target.zIndex;
  const newZIndex = calculateNewZIndex(layers, id, "front");

  // Before listeners
  yield* registry.run("layer:before-resort", { id, oldZIndex, newZIndex });

  // Update state
  yield* Ref.update(layersRef, ...);

  // After listeners
  yield* registry.run("layer:after-resort", { id, oldZIndex, newZIndex });
});
```

---

## Event Types

| Event Name | Payload |
|-----------|---------|
| `layer:before-resort` | `{ id, oldZIndex, newZIndex }` |
| `layer:after-resort` | `{ id, oldZIndex, newZIndex }` |
| `layer:before-visibility-change` | `{ id, visible }` |
| `layer:after-visibility-change` | `{ id, visible }` |
| `layer:after-create` | `{ id, name, zIndex }` |
| `layer:after-remove` | `{ id }` |

---

## Future Work

1. **EventJournal Persistence**: Persist listener registrations to journal
2. **Remote Sync**: Sync listeners across clients via EventLogRemote
3. **Reactivity Keys**: Fine-grained invalidation for listener queries
4. **Compaction**: Compact old listener events in journal
5. **Serializable Handlers**: Support handler references that can be persisted

---

## References

- [GNU Emacs Hooks](https://www.gnu.org/software/emacs/manual/html_node/emacs/Hooks.html)
- [Effect EventJournal](../../submodules/effect/packages/experimental/src/EventJournal.ts)
- [effect-atom](../../submodules/effect-atom/packages/atom/src/Atom.ts)
- [Receipts Events Pattern](../../receipts/src/Receipts/Events.ts)
