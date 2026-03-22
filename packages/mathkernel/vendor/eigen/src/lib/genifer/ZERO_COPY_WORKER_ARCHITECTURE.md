# Zero-Copy Worker Architecture for Genifer

> Technical analysis of achieving true zero-copy data transfer between main thread and web workers for the Genifer streaming UI system.

## Problem Statement

The Genifer system streams UI patches from an API, applies them to build a UITree, and renders via React. Currently, all worker communication uses **structured clone**, which copies data on every `postMessage`.

For large UI trees (1000+ elements), this creates:
- Memory pressure (duplicate allocations)
- GC pauses
- Main thread blocking during clone

## Current Architecture (Structured Clone)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     CURRENT: STRUCTURED CLONE (COPIES DATA)                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   MAIN THREAD                           WORKER THREAD                        │
│   ───────────                           ─────────────                        │
│                                                                              │
│   UITree {                              UITree {                             │
│     root: "r1",         ══════════▶       root: "r1",      ← DEEP COPY      │
│     elements: {          postMessage      elements: {                        │
│       "e1": {...},      (structured       "e1": {...},                      │
│       "e2": {...},       clone)           "e2": {...},                      │
│       ...1000 more                        ...1000 more                       │
│     }                                   }                                    │
│   }                                   }                                      │
│                                                                              │
│   Memory: 50MB ──────────────────────▶ Memory: 50MB (NEW ALLOCATION)        │
│                                                                              │
│   COST: O(n) copy for every postMessage round-trip                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## What Zero-Copy Actually Means

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     ZERO-COPY: TRANSFERABLE ARRAYBUFFER                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   MAIN THREAD                           WORKER THREAD                        │
│   ───────────                           ─────────────                        │
│                                                                              │
│   ArrayBuffer ──────────────────────────────────────▶ ArrayBuffer           │
│   [memory: 0x7fff...]   OWNERSHIP TRANSFER            [memory: 0x7fff...]   │
│        │                (same memory!)                      │               │
│        │                                                    │               │
│        ▼                                                    ▼               │
│   (neutered - 0 bytes)                              (now owns the memory)   │
│                                                                              │
│   COST: O(1) - just moves pointer, no data copied                           │
│                                                                              │
│   LIMITATION: Only works for:                                                │
│   ├─ ArrayBuffer                                                            │
│   ├─ MessagePort                                                            │
│   ├─ ImageBitmap                                                            │
│   ├─ OffscreenCanvas                                                        │
│   └─ ReadableStream / WritableStream                                        │
│                                                                              │
│   Does NOT work for: Plain objects, arrays, Maps, classes                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## The Serialization Gap

UITree is a JavaScript object. To achieve zero-copy transfer, we must serialize it to an ArrayBuffer.

### Option A: MessagePack/CBOR

```
UITree ──▶ msgpack.encode() ──▶ Uint8Array ══TRANSFER══▶ msgpack.decode() ──▶ UITree
```

| Aspect | Analysis |
|--------|----------|
| Main→Worker | O(n) encode + O(1) transfer |
| Worker→Main | O(1) transfer + O(n) decode |
| Complexity | Medium - drop-in library |
| React compat | Yes - decode produces plain objects |

### Option B: FlatBuffers (TRUE Zero-Copy)

```
UITree ──▶ builder.finish() ──▶ Uint8Array ══TRANSFER══▶ DIRECT ACCESS (no decode!)
```

| Aspect | Analysis |
|--------|----------|
| Main→Worker | O(n) build + O(1) transfer |
| Worker→Main | O(1) transfer + O(1) access |
| Complexity | High - schema definition, different API |
| React compat | **REQUIRES INVESTIGATION** |

### Option C: Effect Transferable.Uint8Array (Partial)

Only binary FIELDS transfer zero-copy; structure still cloned.

```typescript
Schema.Class({
  id: Schema.String,
  data: Transferable.Uint8Array  // ← only this field is zero-copy
})
```

Not applicable for UITree where the entire structure needs transfer.

## Decision Matrix

| Approach | Main→Worker | Worker→Main | Complexity | Best For |
|----------|-------------|-------------|------------|----------|
| Structured Clone (now) | O(n) copy | O(n) copy | Low | Small trees (<1000 elements) |
| MessagePack + Transfer | O(n) encode + O(1) xfer | O(1) xfer + O(n) decode | Medium | Large trees (1000-10000) |
| FlatBuffers | O(n) build + O(1) xfer | O(1) access (no decode!) | High | Huge trees (>10000 elements) |

---

# FlatBuffers Approach: Deep Dive

## What is FlatBuffers?

FlatBuffers is a binary serialization format from Google. Unlike MessagePack/JSON/Protobuf, it requires **no parsing/unpacking step**. You read directly from the buffer.

```
Traditional:  Buffer ──▶ Parse ──▶ Object ──▶ Access field
FlatBuffers:  Buffer ──────────────────────▶ Access field (reads offset directly)
```

## Schema Definition

FlatBuffers requires a `.fbs` schema file:

```flatbuffers
// uitree.fbs

namespace Genifer;

table UIElement {
  key: string (required);
  type: string (required);
  props: [KeyValue];        // Props as key-value pairs
  children: [string];       // Child keys
  parent_key: string;
  visible: Visibility;
  entrance: Entrance;
}

table KeyValue {
  key: string (required);
  value: string;            // JSON-encoded value
}

table Visibility {
  condition: string;        // JSON-encoded condition
}

table Entrance {
  animation: string;
  duration: float;
  delay: float;
}

table UITree {
  root: string (required);
  elements: [UIElement];    // Flat array, not map
}

root_type UITree;
```

## Generated TypeScript API

After running `flatc --ts uitree.fbs`:

```typescript
import * as flatbuffers from 'flatbuffers';
import { UITree, UIElement } from './uitree_generated';

// READING (zero-copy - no decode!)
function readTree(buffer: Uint8Array): void {
  const buf = new flatbuffers.ByteBuffer(buffer);
  const tree = UITree.getRootAsUITree(buf);

  const root = tree.root();           // Direct offset read
  const count = tree.elementsLength();

  for (let i = 0; i < count; i++) {
    const el = tree.elements(i);      // Returns accessor, not copy
    const key = el.key();             // Reads from buffer
    const type = el.type();
    // ...
  }
}

// WRITING (requires builder)
function writeTree(tree: UITreeJS): Uint8Array {
  const builder = new flatbuffers.Builder(1024);

  // Build elements (must build strings first, then tables)
  const elementOffsets = tree.elements.map(el => {
    const keyOffset = builder.createString(el.key);
    const typeOffset = builder.createString(el.type);
    // ... create all strings and nested tables

    UIElement.startUIElement(builder);
    UIElement.addKey(builder, keyOffset);
    UIElement.addType(builder, typeOffset);
    return UIElement.endUIElement(builder);
  });

  const elementsVector = UITree.createElementsVector(builder, elementOffsets);
  const rootOffset = builder.createString(tree.root);

  UITree.startUITree(builder);
  UITree.addRoot(builder, rootOffset);
  UITree.addElements(builder, elementsVector);
  const treeOffset = UITree.endUITree(builder);

  builder.finish(treeOffset);
  return builder.asUint8Array();
}
```

## Critical Question: Can React Render FlatBuffers Directly?

### The Challenge

React components expect plain JavaScript objects:

```tsx
function UIElementComponent({ element }: { element: UIElement }) {
  return <div className={element.type}>{element.props.label}</div>;
}
```

FlatBuffers returns **accessor objects**, not plain objects:

```typescript
const el = tree.elements(0);  // Returns UIElement accessor
el.key();                      // Method call, not property access
el.props(0);                   // Returns accessor, not object
```

### Options for React Integration

#### Option 1: Decode to Plain Objects (defeats purpose)

```typescript
// This defeats the zero-copy benefit
function toPlainElement(accessor: UIElement): UIElementJS {
  return {
    key: accessor.key(),
    type: accessor.type(),
    props: decodeProps(accessor),
    // ...
  };
}
```

#### Option 2: Accessor-Aware Components

```tsx
// Components work with FlatBuffer accessors directly
function UIElementComponent({ element }: { element: UIElement }) {
  // Call methods instead of property access
  return <div className={element.type()}>{element.propsJson()}</div>;
}
```

**Problem**: Breaks existing component API, verbose syntax.

#### Option 3: Proxy Objects

```typescript
// Wrap accessor in Proxy to look like plain object
function proxyElement(accessor: UIElement): UIElementJS {
  return new Proxy({} as UIElementJS, {
    get(_, prop) {
      if (prop === 'key') return accessor.key();
      if (prop === 'type') return accessor.type();
      // ...
    }
  });
}
```

**Problem**: Proxy overhead, complex implementation.

#### Option 4: Selective Materialization

```typescript
// Only decode elements that are currently visible
function materializeVisible(tree: UITree, viewportKeys: Set<string>): UIElementJS[] {
  const result: UIElementJS[] = [];
  for (let i = 0; i < tree.elementsLength(); i++) {
    const el = tree.elements(i);
    if (viewportKeys.has(el.key())) {
      result.push(toPlainElement(el));  // Decode only visible
    }
  }
  return result;
}
```

**Best approach for virtualized lists**.

## Verdict: React + FlatBuffers

| Approach | Zero-Copy Preserved? | React Compatible? | Complexity |
|----------|---------------------|-------------------|------------|
| Decode all | No | Yes | Low |
| Accessor components | Yes | Breaks API | High |
| Proxy objects | Partial | Yes | High |
| Selective materialization | Partial | Yes | Medium |

**Recommendation**: FlatBuffers makes sense ONLY if:
1. Tree is very large (>10,000 elements)
2. We use virtualization (only render visible elements)
3. We're willing to decode visible subset on-demand

For Genifer's typical use case (streaming UI, moderate sizes), **MessagePack is the pragmatic choice**.

---

## Next Steps

1. **Benchmark current structured clone** - measure actual overhead
2. **Prototype MessagePack path** - compare performance
3. **If MessagePack insufficient** - consider FlatBuffers with selective materialization
4. **A/B test in GeniferTestbed** - measure real-world impact

## References

- [MDN: Transferable Objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects)
- [Chrome: Transferable Objects Lightning Fast](https://developer.chrome.com/blog/transferable-objects-lightning-fast)
- [FlatBuffers Documentation](https://google.github.io/flatbuffers/)
- [Effect Platform Transferable Module](https://github.com/Effect-TS/effect/tree/main/packages/platform)
