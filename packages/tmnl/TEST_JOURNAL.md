# Test Journal - Layer System

**Purpose**: Document decisions about whether to fix tests, implementation, or design.

---

## Entry 1: Atom Function API Misuse

**Date**: 2025-11-27
**Tests Affected**: 8 atom tests (layersAtom, layerOpsAtom tests)
**Error**: `TypeError: createLayer is not a function`

### The Issue

```typescript
const createLayer = layerRuntimeAtom.fn(Effect.gen(...));
await createLayer(); // ❌ Error: createLayer is not a function
```

### Three-Level Analysis

#### 1. Design Level - Is the API correct?

**Pattern from effect-atom** (verified in submodule and working tests):
```typescript
// Definition
export const layerOpsAtom = {
  bringToFront: layerRuntimeAtom.fn(Effect.gen(...))
};

// Usage
const bringToFront = registry.get(layerOpsAtom.bringToFront);
await bringToFront(id);
```

**Verdict**: ✅ Design is correct - `layerRuntimeAtom.fn()` returns an **atom wrapping a function**, not a function directly.

#### 2. Implementation Level - Is layerRuntimeAtom.fn() broken?

**Evidence**: `layerOpsAtom.bringToFront` works correctly in other tests when retrieved via `registry.get()`.

**Verdict**: ✅ Implementation is correct - working as designed.

#### 3. Test Level - Is the test using the API wrong?

**Current (wrong)**:
```typescript
const createLayer = layerRuntimeAtom.fn(...); // Returns atom
await createLayer(); // ❌ Trying to call atom as function
```

**Should be**:
```typescript
const createLayerAtom = layerRuntimeAtom.fn(...);
const createLayer = registry.get(createLayerAtom); // Extract function
await createLayer(); // ✅ Call the actual function
```

**Verdict**: ❌ Test is using effect-atom API incorrectly.

### Decision

**Fix at TEST LEVEL** ✅

**Rationale**:
- Design matches effect-atom's intended usage pattern
- Implementation proven working in other tests
- Test code misunderstands atom vs function distinction

**Action**: Update atom tests to properly use `registry.get()` to extract callable functions from atom functions.

---

## Entry 2: Option Unwrapping in LayerManager (FIXED)

**Date**: 2025-11-27
**Tests Affected**: 9 LayerManager tests (bringToFront, sendToBack, getLayer)
**Error**: `TypeError: Cannot read properties of undefined (reading 'onResort')`

### The Issue

```typescript
const target = Array.findFirst(layers, (l) => l.id === id);
// target is Option<LayerInstance>, not LayerInstance | undefined
const updated = { ...target, zIndex: newZIndex }; // ❌ Spreading Option
```

### Decision

**Fix at IMPLEMENTATION LEVEL** ✅

**Rationale**:
- Effect's `Array.findFirst` returns `Option<T>` by design
- Implementation incorrectly assumed it returns `T | undefined`
- Must use `Option.getOrUndefined()` to unwrap

**Fix Applied**:
```typescript
const targetOption = Array.findFirst(layers, (l) => l.id === id);
const target = Option.getOrUndefined(targetOption);
```

**Result**: 9 tests fixed ✅

---

## Entry 3: IdGeneratorConfig Circular Dependency (FIXED)

**Date**: 2025-11-27
**Tests Affected**: 20+ integration and service tests
**Error**: `ReferenceError: Cannot access 'IdGeneratorConfig' before initialization`

### The Issue

```typescript
export class IdGenerator extends Effect.Service<IdGenerator>()("...", {
  dependencies: [IdGeneratorConfig.Default], // ❌ Used here (line 36)
}) {}

export class IdGeneratorConfig extends Context.Tag(...)() { // ❌ Defined here (line 42)
  static Default = Layer.succeed(...);
}
```

### Decision

**Fix at IMPLEMENTATION LEVEL** ✅

**Rationale**:
- Classic circular dependency - using before defining
- Implementation error, not design or test issue

**Fix Applied**: Moved `IdGeneratorConfig` class definition before `IdGenerator` class.

**Result**: 20+ tests fixed ✅

---

## Entry 4: XState Initial State API (FIXED)

**Date**: 2025-11-27
**Tests Affected**: 14 XState machine tests
**Error**: `TypeError: Cannot convert undefined or null to object`

### The Issue

```typescript
// XState 5.x doesn't support this:
createActor(machine, {
  snapshot: { value: "hidden" } // ❌ Invalid in v5
});
```

### Decision

**Fix at IMPLEMENTATION LEVEL** ✅ (API migration)

**Rationale**:
- XState 4 → 5 breaking change
- Implementation didn't migrate properly
- Design is fine, just using old API

**Fix Applied**: Created separate machine definitions for each initial state:
```typescript
const hiddenMachine = createMachine({ initial: 'hidden', states: {...} });
const lockedMachine = createMachine({ initial: 'locked', states: {...} });
const visibleMachine = createMachine({ initial: 'visible', states: {...} });
```

**Result**: 14 tests fixed ✅

---

## Summary Stats

| Level | Fixes | Tests Fixed |
|-------|-------|-------------|
| Design | 0 | 0 |
| Implementation | 3 | 43+ |
| Test | 1 (pending) | 8 (pending) |

**Pattern**: Most issues are **implementation bugs**, not design flaws or bad tests.
