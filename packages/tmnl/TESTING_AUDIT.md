# Layer System Testing Audit

## Purpose

This document identifies:
1. **Original Assumptions** - What was assumed during implementation
2. **Latent Assumptions** - Hidden assumptions discovered through unbiased re-read
3. **Test Hypotheses** - Explicit statements of what tests will prove

---

## 1. Original Implementation Assumptions

### 1.1 Z-Index Management
**Assumption**: Layers store their own z-index; LayerIndex is a derived sorted view.
- **Stated in**: CLAUDE.md, `LayerManager.ts:18-26`
- **Rationale**: Allows layers to carry z-index with them; enables onResort closures to access new value
- **Implementation**: `interface LayerInstance { readonly zIndex: number }` (types.ts:30)

**Assumption**: Smart algorithm with ±10 gaps minimizes reassignments.
- **Stated in**: CLAUDE.md, `LayerManager.ts:27-45`
- **Rationale**: Avoids cascading updates; allows future insertions without recalc
- **Implementation**: `calculateNewZIndex()` adds/subtracts 10

### 1.2 Service Architecture
**Assumption**: Effect.Ref holds canonical state; atoms expose it reactively.
- **Stated in**: CLAUDE.md, `LayerManager.ts:16`
- **Rationale**: Separation of concerns - service layer (Effect) vs view layer (React)
- **Implementation**: `layersRef = yield* Ref.make<ReadonlyArray<LayerInstance>>([])`

**Assumption**: Services use Effect.Service pattern for DI and composition.
- **Stated in**: CLAUDE.md, all service files
- **Rationale**: Testability, composability, type-safe dependency injection
- **Implementation**: `class IdGenerator extends Effect.Service<IdGenerator>()(...)`

### 1.3 XState Integration
**Assumption**: XState validates transitions; LayerManager executes z-index operations.
- **Stated in**: CLAUDE.md, `layerMachine.ts:19-43`
- **Rationale**: Orthogonal concerns - lifecycle state vs spatial ordering
- **Implementation**: Machine has BRING_TO_FRONT event but LayerManager.bringToFront() does actual work

### 1.4 React Integration
**Assumption**: withLayering HOC auto-registers/unregisters layers on mount/unmount.
- **Stated in**: `withLayering.tsx:29-70`
- **Rationale**: Declarative layer management; no manual registration needed
- **Implementation**: `useEffect()` with cleanup function

**Assumption**: Pointer-events="pass-through" means container is none, children are auto.
- **Stated in**: CLAUDE.md, `withLayering.tsx:73-76`
- **Rationale**: Smart bubbling for interactive overlays
- **Implementation**: Style applied conditionally based on config

---

## 2. Latent Assumptions (Unbiased Re-read Findings)

### 2.1 Critical Gaps

**LATENT**: IdGenerator.generate() is pure/synchronous.
- **Where**: `IdGenerator.ts:19-30`
- **Evidence**: Returns `string` directly, not `Effect.Effect<string>`
- **Risk**: Cannot fail; cannot use Effect-based ID generation (e.g., database sequences)
- **Test needed**: Verify synchronous behavior; test failure mode if custom generator throws

**LATENT**: LayerFactory.createLayer() starts XState machine immediately.
- **Where**: `LayerFactory.ts:36-37`
- **Evidence**: `machine.start()` called during layer creation
- **Risk**: Machine runs before layer is registered; potential race conditions
- **Test needed**: Verify machine state before/after registration; test unstarted machine behavior

**LATENT**: Layer metadata stores onResort as Promise-returning function, not Effect.
- **Where**: `LayerFactory.ts:51`, `LayerManager.ts:102-105`
- **Evidence**: `Effect.runPromise(onResort(layer))` wraps closure, stored as `(layer) => Promise<void>`
- **Risk**: Bypasses Effect error handling; unhandled promise rejections possible
- **Test needed**: Verify error handling when onResort closure fails

**LATENT**: withLayering uses simplified Effect.runPromise without fiber cleanup.
- **Where**: `withLayering.tsx:57-67`
- **Evidence**: `.catch(console.error)` is only error handling; no runtime management
- **Risk**: Leaked fibers on unmount; no cancellation on component unmount
- **Test needed**: Verify fiber cleanup; test unmount before layer creation completes

**LATENT**: LayerManager operations assume layer exists without explicit error handling.
- **Where**: `LayerManager.ts:86-106` (bringToFront, sendToBack)
- **Evidence**: `if (!target) return;` silently fails
- **Risk**: Silent failures; no feedback when operating on non-existent layers
- **Test needed**: Verify behavior when operating on missing layers; assert Effect.fail() instead of silent return

**LATENT**: Z-index can exceed validation bounds after smart algorithm.
- **Where**: `LayerFactory.ts:68-70` validates -1000 to 10000; `LayerManager.ts:38-43` adds ±10
- **Evidence**: No bounds checking in bringToFront/sendToBack
- **Risk**: Z-index can grow unbounded with repeated operations
- **Test needed**: Verify z-index stays within bounds after 100+ front/back operations

**LATENT**: layersAtom, layerIndexAtom don't handle Effect failures.
- **Where**: `atoms/index.ts:27-44`
- **Evidence**: `layerRuntimeAtom.atom(Effect.gen(...))` returns Effect directly
- **Risk**: Atom consumers must handle Result.Success/Result.Failure
- **Test needed**: Verify atoms return Result types; test failure propagation

**LATENT**: useLayer hook assumes atom values are always available.
- **Where**: `useLayer.ts:15-17`
- **Evidence**: `useAtomValue(layerAtom(layerId))` typed as `LayerInstance | undefined`
- **Risk**: No handling of Result.Failure; assumes Effect never fails
- **Test needed**: Verify behavior when layer service fails; test Result unwrapping

**LATENT**: Multiple layers can have identical z-index.
- **Where**: No uniqueness constraint in LayerManager
- **Evidence**: `calculateNewZIndex()` returns absolute values, not relative to existing layers
- **Risk**: Undefined rendering order for same z-index; layerIndex sort is stable but not guaranteed
- **Test needed**: Verify behavior with duplicate z-indices; test stable sort

**LATENT**: setOpacity silently clamps to [0, 1] instead of failing.
- **Where**: `LayerManager.ts:154-159`
- **Evidence**: `Math.max(0, Math.min(1, opacity))`
- **Risk**: Invalid input accepted without error; no feedback on out-of-range values
- **Test needed**: Verify clamping behavior; compare to factory validation approach

**LATENT**: XState machine events (SHOW, HIDE, LOCK, UNLOCK) are fire-and-forget.
- **Where**: `LayerManager.ts:147`, `LayerManager.ts:174`
- **Evidence**: `layer.machine.send({ type: "SHOW" })` not awaited or checked
- **Risk**: Machine state may not sync with LayerManager state; no error if transition invalid
- **Test needed**: Verify machine state sync; test invalid transitions (e.g., SHOW when already visible)

**LATENT**: onResort closures execute after state update completes.
- **Where**: `LayerManager.ts:101-105`
- **Evidence**: Closure called after `Ref.update()` completes
- **Risk**: Closure sees updated state but other subscribers may not yet; ordering not guaranteed
- **Test needed**: Verify closure execution order relative to atom updates; test concurrent operations

**LATENT**: Layer removal doesn't stop XState machine actor.
- **Where**: `LayerManager.ts:79-81`, no `machine.stop()` call
- **Evidence**: removeLayer only filters layer from array
- **Risk**: Leaked machine actors; memory leak with repeated add/remove
- **Test needed**: Verify machine cleanup; test memory usage with 1000+ add/remove cycles

**LATENT**: layerSortedAtom visualHash doesn't include opacity or visibility changes.
- **Where**: `atoms/index.ts:57-60`
- **Evidence**: Hash is `${id}:${zIndex}` only
- **Risk**: Opacity/visibility changes don't trigger re-render even when visual output changes
- **Test needed**: Verify re-render behavior when opacity changes; test hidden->visible transitions

**LATENT**: Layer names are not unique.
- **Where**: No uniqueness constraint in LayerFactory or LayerManager
- **Evidence**: Factory validates name is non-empty, not unique
- **Risk**: Cannot reliably fetch layer by name; debugging confusion with duplicate names
- **Test needed**: Verify multiple layers can have same name; test name-based lookup (if implemented)

**LATENT**: IdGenerator custom strategy fallback to nanoid if customGenerator is undefined.
- **Where**: `IdGenerator.ts:26`
- **Evidence**: `config.customGenerator?.() ?? nanoid()`
- **Risk**: Silent fallback; no error if custom strategy provided without generator
- **Test needed**: Verify fallback behavior; test custom strategy with missing generator

### 2.2 Type System Assumptions

**LATENT**: LayerInstance properties are readonly but object is not deeply immutable.
- **Where**: `types.ts:27-37`
- **Evidence**: `readonly` on properties, but `metadata: Record<string, unknown>` is mutable
- **Risk**: Metadata can be mutated after creation; violates immutability expectation
- **Test needed**: Verify metadata mutation doesn't affect atom updates; test defensive copying

**LATENT**: LayerConfig metadata is optional; LayerInstance metadata is always present.
- **Where**: `types.ts:21` vs `types.ts:35`
- **Evidence**: Config has `metadata?: Record`, Instance has `metadata: Record`
- **Risk**: Implicit empty object creation; onResort stored in metadata could collide with user metadata
- **Test needed**: Verify metadata merging; test user metadata with "onResort" key

---

## 3. Test Hypotheses & Objectives

### 3.1 IdGenerator Service Tests

**File**: `src/lib/layers/services/__tests__/IdGenerator.test.ts`

**Hypothesis 1**: nanoid strategy generates unique, non-empty strings.
- **Test**: Generate 1000 IDs, assert all unique and match /^[A-Za-z0-9_-]{21}$/
- **Proves**: Default strategy works correctly; no collisions in reasonable sample size

**Hypothesis 2**: uuid strategy generates valid UUIDv4s.
- **Test**: Generate 100 UUIDs, assert all match UUID regex and are unique
- **Proves**: uuid strategy produces RFC4122-compliant IDs

**Hypothesis 3**: custom strategy with valid generator uses provided function.
- **Test**: Provide custom generator returning sequential IDs; assert IDs match sequence
- **Proves**: Custom strategy correctly delegates to user function

**Hypothesis 4**: custom strategy without generator falls back to nanoid.
- **Test**: Provide custom strategy with undefined generator; assert nanoid-format IDs
- **Proves**: Silent fallback behavior (LATENT assumption confirmed)

**Hypothesis 5**: IdGenerator service is effect-based and composable.
- **Test**: Create IdGenerator with custom config layer; assert Effect.provide works
- **Proves**: Service follows Effect dependency injection pattern

---

### 3.2 LayerFactory Service Tests

**File**: `src/lib/layers/services/__tests__/LayerFactory.test.ts`

**Hypothesis 1**: createLayer generates unique IDs for each layer.
- **Test**: Create 100 layers with same config; assert all IDs unique
- **Proves**: IdGenerator integration works; no ID collisions

**Hypothesis 2**: createLayer starts XState machine in correct initial state.
- **Test**: Create layer with visible=false; assert machine.getSnapshot().value === "hidden"
- **Proves**: Machine initialization respects config (LATENT assumption about immediate start)

**Hypothesis 3**: createLayer fails for invalid z-index.
- **Test**: Attempt layer with zIndex=-2000; assert Effect.runSync throws with error message
- **Proves**: Validation rejects out-of-bounds z-index

**Hypothesis 4**: createLayer fails for invalid opacity.
- **Test**: Attempt layers with opacity=-0.5 and opacity=1.5; assert both fail
- **Proves**: Validation enforces [0, 1] range

**Hypothesis 5**: createLayer fails for empty name.
- **Test**: Attempt layer with name="  "; assert fails with "cannot be empty" message
- **Proves**: Validation rejects whitespace-only names

**Hypothesis 6**: createLayer attaches onResort closure to metadata.
- **Test**: Create layer with onResort closure; assert metadata.onResort is function
- **Proves**: Closure storage mechanism works

**Hypothesis 7**: createLayer merges user metadata with internal metadata.
- **Test**: Create layer with metadata={custom: "value"}; assert layer.metadata.custom === "value" && layer.metadata.onResort exists
- **Proves**: User metadata preserved alongside internal metadata

**Hypothesis 8**: createLayer with metadata key "onResort" doesn't overwrite closure.
- **Test**: Create layer with metadata={onResort: "user-value"}; assert closure still callable
- **Proves**: Internal metadata takes precedence (or test should fail, revealing design issue)

**Hypothesis 9**: Default config values applied when optional fields omitted.
- **Test**: Create layer with minimal config; assert visible===true, opacity===1, locked===false, pointerEvents==="auto"
- **Proves**: Defaults match documented behavior

---

### 3.3 LayerManager Service Tests

**File**: `src/lib/layers/services/__tests__/LayerManager.test.ts`

**Hypothesis 1**: getAllLayers returns unsorted layers.
- **Test**: Add layers with z-indices [50, 10, 30]; assert getAllLayers preserves insertion order
- **Proves**: getAllLayers is unsorted view

**Hypothesis 2**: getLayerIndex returns layers sorted by z-index ascending.
- **Test**: Add layers with z-indices [50, 10, 30]; assert getLayerIndex returns [10, 30, 50]
- **Proves**: LayerIndex is sorted derived view

**Hypothesis 3**: getLayer returns correct layer by ID.
- **Test**: Add 3 layers; assert getLayer(id2) returns second layer
- **Proves**: ID-based lookup works

**Hypothesis 4**: getLayer returns undefined for non-existent ID.
- **Test**: Query getLayer("nonexistent"); assert returns undefined
- **Proves**: Graceful handling of missing layers

**Hypothesis 5**: addLayer increases layer count.
- **Test**: Add layer; assert getAllLayers.length increases by 1
- **Proves**: Registration works

**Hypothesis 6**: removeLayer decreases layer count.
- **Test**: Add layer, then remove it; assert getAllLayers.length returns to original
- **Proves**: Unregistration works

**Hypothesis 7**: removeLayer doesn't stop XState machine.
- **Test**: Add layer, assert machine.getSnapshot().status === "active", remove layer, assert machine still active
- **Proves**: LATENT assumption - memory leak exists

**Hypothesis 8**: bringToFront moves layer to highest z-index.
- **Test**: Add layers [10, 20, 30]; bringToFront(id1); assert getLayerIndex last element is id1
- **Proves**: Front operation works

**Hypothesis 9**: bringToFront creates gap above current max.
- **Test**: Add layers [10, 20]; bringToFront(id1); assert id1.zIndex === 30 (20 + 10)
- **Proves**: Smart algorithm creates ±10 gap

**Hypothesis 10**: sendToBack moves layer to lowest z-index.
- **Test**: Add layers [10, 20, 30]; sendToBack(id3); assert getLayerIndex first element is id3
- **Proves**: Back operation works

**Hypothesis 11**: sendToBack creates gap below current min.
- **Test**: Add layers [10, 20]; sendToBack(id2); assert id2.zIndex === 0 (10 - 10)
- **Proves**: Smart algorithm creates gap

**Hypothesis 12**: bringToFront on non-existent layer silently fails.
- **Test**: Call bringToFront("nonexistent"); assert no error thrown, getAllLayers unchanged
- **Proves**: LATENT assumption - silent failure behavior

**Hypothesis 13**: Repeated bringToFront operations don't exceed bounds.
- **Test**: Add layer at z=9000; call bringToFront 200 times; assert z-index stays ≤ 10000
- **Proves**: Z-index bounds enforced (or test fails, revealing LATENT bug)

**Hypothesis 14**: Multiple layers can have same z-index.
- **Test**: Manually create layers with zIndex=10; add both; assert both present in getAllLayers
- **Proves**: No uniqueness constraint on z-index

**Hypothesis 15**: layerIndex sort is stable for duplicate z-indices.
- **Test**: Add layers L1(z=10), L2(z=10), L3(z=10); assert getLayerIndex preserves [L1, L2, L3] order
- **Proves**: Array.sort stability (or lack thereof)

**Hypothesis 16**: setVisible updates layer state and sends XState event.
- **Test**: Create layer, setVisible(id, false), assert layer.visible===false && machine.state==="hidden"
- **Proves**: State sync between Effect.Ref and XState machine

**Hypothesis 17**: setVisible with invalid transition still updates state.
- **Test**: Create locked layer, setVisible(id, false), assert visible===false even though locked state may not allow HIDE
- **Proves**: LATENT assumption - state may desync if machine rejects transition

**Hypothesis 18**: setOpacity clamps to [0, 1].
- **Test**: setOpacity(id, -0.5), assert opacity===0; setOpacity(id, 1.5), assert opacity===1
- **Proves**: Clamping behavior (LATENT assumption)

**Hypothesis 19**: setLocked updates state and sends XState event.
- **Test**: setLocked(id, true), assert layer.locked===true && machine.state==="locked"
- **Proves**: State sync for lock operation

**Hypothesis 20**: setPointerEvents updates layer config.
- **Test**: setPointerEvents(id, "none"), assert layer.pointerEvents==="none"
- **Proves**: Pointer-events mutation works

**Hypothesis 21**: onResort closure executes after z-index change.
- **Test**: Create layer with onResort that pushes to array; bringToFront; assert array contains updated layer
- **Proves**: Closure execution and updated layer passed to closure

**Hypothesis 22**: onResort closure receives layer with new z-index.
- **Test**: Create layer z=10 with onResort capturing zIndex; bringToFront; assert captured zIndex > 10
- **Proves**: Closure sees updated state

**Hypothesis 23**: onResort closure errors don't crash LayerManager.
- **Test**: Create layer with onResort that throws; bringToFront; assert operation completes and error logged
- **Proves**: Error handling for closures (or test fails, revealing LATENT bug)

---

### 3.4 Service Integration Tests

**File**: `src/lib/layers/__tests__/integration.test.ts`

**Hypothesis 1**: LayerFactory and LayerManager compose via Effect.provide.
- **Test**: Create layer via factory, add to manager, retrieve by ID; assert same layer
- **Proves**: Service composition works

**Hypothesis 2**: Custom IdGenerator config affects factory-created layers.
- **Test**: Provide custom ID generator (prefix "TEST-"), create layer, assert ID starts with "TEST-"
- **Proves**: Dependency injection works across service boundary

**Hypothesis 3**: Multiple managers don't share state.
- **Test**: Create two LayerManager instances, add layer to each, assert independent state
- **Proves**: Effect.Ref scope isolation

**Hypothesis 4**: Layer lifecycle: create → add → modify → remove.
- **Test**: Full lifecycle with all operations; assert final state is empty
- **Proves**: End-to-end layer management

**Hypothesis 5**: Concurrent bringToFront operations are safe.
- **Test**: Add 10 layers, call bringToFront on all concurrently, assert all have distinct z-indices
- **Proves**: Ref.update atomicity (or lack thereof)

---

### 3.5 Atom Integration Tests

**File**: `src/lib/layers/atoms/__tests__/atoms.test.ts`

**Hypothesis 1**: layersAtom syncs with LayerManager.getAllLayers.
- **Test**: Use Registry, get layersAtom, add layer via ops, assert atom updates
- **Proves**: Effect.Ref → Atom synchronization

**Hypothesis 2**: layerIndexAtom returns sorted layers.
- **Test**: Add layers [50, 10, 30], get layerIndexAtom, assert order [10, 30, 50]
- **Proves**: Sorted atom derivation

**Hypothesis 3**: layerAtom family provides per-layer access.
- **Test**: Add layer, get layerAtom(id), assert returns correct layer
- **Proves**: Family pattern works

**Hypothesis 4**: layerAtom returns undefined for missing layer.
- **Test**: Get layerAtom("nonexistent"), assert result is Result.Success(undefined) or Result.Failure
- **Proves**: Atom failure handling (tests LATENT assumption)

**Hypothesis 5**: layerOpsAtom.bringToFront updates layerIndexAtom.
- **Test**: Subscribe to layerIndexAtom, call bringToFront, assert subscriber notified
- **Proves**: Operations trigger atom updates

**Hypothesis 6**: layerSortedAtom visualHash changes only on visible layer z-index change.
- **Test**: Get visualHash, change opacity, assert hash unchanged; change visible layer z-index, assert hash changes
- **Proves**: LATENT assumption about hash composition

**Hypothesis 7**: layerSortedAtom visualHash ignores hidden layers.
- **Test**: Add visible layer (z=10) and hidden layer (z=20), assert hash excludes hidden layer
- **Proves**: Filtering logic

**Hypothesis 8**: Atom operations return Results (Success/Failure).
- **Test**: Trigger error condition (invalid layer creation), assert atom.get returns Result.Failure
- **Proves**: Effect error propagation through atoms (or reveals LATENT assumption)

---

### 3.6 React Integration Tests

**File**: `src/lib/layers/__tests__/react.test.tsx`

**Hypothesis 1**: withLayering registers layer on mount.
- **Test**: Render wrapped component, assert layersAtom.length === 1
- **Proves**: Auto-registration works

**Hypothesis 2**: withLayering unregisters layer on unmount.
- **Test**: Render, then unmount, assert layersAtom.length === 0
- **Proves**: Cleanup works

**Hypothesis 3**: withLayering applies z-index style.
- **Test**: Render with zIndex=42, assert wrapper style.zIndex === 42
- **Proves**: Style application

**Hypothesis 4**: withLayering applies pointer-events style.
- **Test**: Render with pointerEvents="none", assert wrapper style.pointerEvents === "none"
- **Proves**: Pointer-events application

**Hypothesis 5**: withLayering pass-through sets container to none.
- **Test**: Render with pointerEvents="pass-through", assert container style.pointerEvents === "none"
- **Proves**: Pass-through logic

**Hypothesis 6**: withLayering sets data attributes.
- **Test**: Render, assert wrapper has data-layer-name and data-layer-id
- **Proves**: Debug attributes present

**Hypothesis 7**: withLayering doesn't leak fibers on unmount.
- **Test**: Mount/unmount 100 times, monitor fiber count (if possible)
- **Proves**: Tests LATENT assumption about Effect.runPromise cleanup

**Hypothesis 8**: useLayer returns layer state.
- **Test**: Render component with useLayer(id), assert layer object returned
- **Proves**: Hook integration

**Hypothesis 9**: useLayer operations are bound to layer ID.
- **Test**: const { bringToFront } = useLayer(id); bringToFront(); assert correct layer moved
- **Proves**: Operation binding

**Hypothesis 10**: useLayer without ID returns all layers.
- **Test**: const { allLayers } = useLayer(); assert allLayers is array
- **Proves**: Multi-mode hook

---

### 3.7 XState Machine Tests

**File**: `src/lib/layers/machines/__tests__/layerMachine.test.ts`

**Hypothesis 1**: Machine starts in "visible" state by default.
- **Test**: Create actor, assert getSnapshot().value === "visible"
- **Proves**: Default initial state

**Hypothesis 2**: Machine starts in custom state if provided.
- **Test**: Create actor with initial="hidden", assert state === "hidden"
- **Proves**: Initial state customization

**Hypothesis 3**: SHOW transitions hidden → visible.
- **Test**: Create hidden actor, send SHOW, assert state === "visible"
- **Proves**: Show transition

**Hypothesis 4**: HIDE transitions visible → hidden.
- **Test**: Send HIDE, assert state === "hidden"
- **Proves**: Hide transition

**Hypothesis 5**: LOCK transitions visible → locked.
- **Test**: Send LOCK, assert state === "locked"
- **Proves**: Lock transition

**Hypothesis 6**: UNLOCK transitions locked → visible.
- **Test**: Create locked actor, send UNLOCK, assert state === "visible"
- **Proves**: Unlock transition

**Hypothesis 7**: BRING_TO_FRONT doesn't change state.
- **Test**: Send BRING_TO_FRONT, assert state === "visible" before and after
- **Proves**: Self-transition

**Hypothesis 8**: Invalid transitions are ignored.
- **Test**: Send LOCK from hidden state, assert state remains "hidden"
- **Proves**: Transition guards (or lack thereof)

**Hypothesis 9**: Machine can transition locked → hidden.
- **Test**: Create locked actor, send HIDE, assert state === "hidden"
- **Proves**: Hidden state accessible from locked

---

## 4. Test Execution Plan

### 4.1 Test Organization

```
src/lib/layers/
├── services/
│   └── __tests__/
│       ├── IdGenerator.test.ts
│       ├── LayerFactory.test.ts
│       └── LayerManager.test.ts
├── machines/
│   └── __tests__/
│       └── layerMachine.test.ts
├── atoms/
│   └── __tests__/
│       └── atoms.test.ts
└── __tests__/
    ├── integration.test.ts
    └── react.test.tsx
```

### 4.2 Test Infrastructure

**Dependencies**:
- `@effect/vitest` - Effect-aware test runner
- `vitest` - Base test framework
- `@testing-library/react` - React component testing
- `@testing-library/react-hooks` - Hook testing

**Setup**:
- Vitest config at `packages/tmnl/vitest.config.ts`
- Test environment: node for services, jsdom for React
- Coverage target: 90%+ for services, 80%+ for React integration

### 4.3 Coverage Goals

| Module | Unit Tests | Integration Tests | Coverage Target |
|--------|-----------|------------------|----------------|
| IdGenerator | 5 | - | 100% |
| LayerFactory | 9 | 2 | 95% |
| LayerManager | 23 | 5 | 95% |
| Atoms | 8 | 2 | 90% |
| React (HOC/Hook) | 10 | 2 | 85% |
| XState Machine | 9 | - | 100% |
| **Total** | **64** | **11** | **92%** |

---

## 5. Critical Issues to Validate

### Priority 1 (Must Fix if Test Fails)
1. ❗ **Z-index bounds checking** - Verify no unbounded growth
2. ❗ **XState machine cleanup** - Verify no memory leaks on removeLayer
3. ❗ **Effect fiber cleanup in withLayering** - Verify no leaked fibers
4. ❗ **onResort error handling** - Verify Effect.runPromise errors don't crash app

### Priority 2 (Should Fix)
5. ⚠️ **Silent failures in LayerManager** - Replace `if (!target) return` with `Effect.fail()`
6. ⚠️ **Result handling in atoms** - Document that atoms return Result types
7. ⚠️ **XState event synchronization** - Verify machine state sync or remove machine dependency

### Priority 3 (Document or Accept)
8. ℹ️ **Metadata collision** - Document "onResort" as reserved metadata key
9. ℹ️ **Duplicate z-indices** - Document sort stability behavior
10. ℹ️ **Opacity clamping** - Document validation vs clamping strategy difference

---

## 6. Success Criteria

### Tests Pass If:
1. All hypotheses are either **proven** or **disproven with documented rationale**
2. All Priority 1 issues are validated and fixed if broken
3. Coverage targets met
4. No silent failures (all errors are either Effect.fail() or logged)
5. No memory leaks (machine cleanup, fiber cleanup)

### Tests Fail If:
1. Any hypothesis reveals undocumented behavior that breaks documented API
2. Z-index bounds violated
3. Memory leaks detected
4. Race conditions in concurrent operations
5. Atom/Effect.Ref synchronization breaks

---

## 7. Next Steps

1. ✅ Create test files (IdGenerator → LayerFactory → LayerManager → integration)
2. ✅ Implement all hypotheses as actual tests
3. ✅ Run tests, document failures
4. ✅ Fix Priority 1 issues
5. ✅ Re-run tests until all pass
6. ✅ Update CLAUDE.md with validated behaviors and known limitations
7. ✅ Update this document with test results

---

*This audit document serves as the specification for the test suite. Each hypothesis must map to at least one test case. Tests should be named after their hypothesis for traceability.*
