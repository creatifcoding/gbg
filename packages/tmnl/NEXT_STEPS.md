# Next Steps for Layer System Testing

## Immediate Actions

### 1. Fix Priority 1 Memory Leak

**File**: `src/lib/layers/services/LayerManager.ts`

```typescript
const removeLayer = (id: string): Effect.Effect<void> =>
  Effect.gen(function* () {
    // Get layer first to access machine
    const layer = yield* getLayer(id);
    
    // Stop the XState machine to prevent memory leak
    if (layer) {
      layer.machine.stop();
    }
    
    // Remove from registry
    yield* Ref.update(layersRef, (layers) => 
      Array.filter(layers, (l) => l.id !== id)
    );
  });
```

### 2. Fix Effect Runtime Issues in Tests

Study the effect submodule test patterns:
```bash
cd ../../submodules/effect
grep -r "it.effect\|Effect.runSync\|Effect.runPromise" packages/effect/test/
```

Key patterns to implement:
- Use `it.effect()` from @effect/vitest for Effect-based tests
- Provide layers correctly: `Effect.provide(testLayer)`
- Use `Effect.runSync()` for synchronous effects in tests

### 3. Fix Atom Testing

Study effect-atom test patterns:
```bash
cd ../../submodules/effect-atom
cat packages/atom/test/Atom.test.ts
```

Key findings:
- `Registry.make()` creates isolated test registry
- Use `registry.get(atom)` to read atom values
- Use `registry.set(atom, value)` to update atoms
- Atoms return `Result.Success` or `Result.Failure`

### 4. Complete React Test Setup

Add to `vitest.setup.ts`:
```typescript
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

afterEach(() => {
  cleanup();
});
```

## Documentation Tasks

### Update CLAUDE.md

Add section on known issues:
```markdown
## Known Limitations

### Memory Management

- **Machine Cleanup**: Must call `machine.stop()` when removing layers
- Currently: removeLayer() leaks XState actors
- Fix: Add machine cleanup (see TEST_RESULTS.md)

### Z-Index Bounds

- Factory validates z-index ∈ [-1000, 10000] on creation
- bringToFront/sendToBack do NOT enforce bounds
- Repeated operations can exceed limits
- Recommendation: Add bounds checking or document unbounded behavior
```

### Update TESTING_AUDIT.md

Add test results section:
```markdown
## Test Results (2025-11-27)

**Status**: 51/81 tests passing (63%)

### Confirmed Hypotheses
- [List all ✅ confirmed hypotheses from TEST_RESULTS.md]

### Disproven Hypotheses
- XState snapshot initialization
- [others]

### Unvalidated (Infrastructure Issues)
- [List tests that couldn't run due to test infrastructure]
```

## Future Work

### 1. Complete Test Suite (30 remaining tests)

Priority order:
1. Fix Effect runtime issues (18 tests)
2. Fix Atom/Registry integration (9 tests)
3. Fix React rendering tests (2 tests)
4. Add hook tests (1 test)

### 2. Add Performance Tests

```typescript
describe("Performance", () => {
  it("handles 1000 layers without performance degradation", () => {
    // Create 1000 layers
    // Measure bringToFront time
    // Assert < 100ms
  });

  it("doesn't leak memory with 1000 add/remove cycles", () => {
    // Monitor heap size
    // Add/remove 1000 times
    // Assert heap size stable
  });
});
```

### 3. Add E2E Tests

Test full React → Atom → Effect → Service flow:
```typescript
it("E2E: withLayering component controls layer via atoms", async () => {
  // Render component wrapped with withLayering
  // Access layer via layerAtom
  // Verify state sync
  // Call bringToFront via layerOpsAtom
  // Verify UI updates
});
```

## Commands

```bash
# Run all tests
bun test:run

# Run specific test file
bun test:run src/lib/layers/services/__tests__/LayerManager.test.ts

# Run with coverage
bun test:coverage

# Run with UI
bun test:ui

# Watch mode
bun test
```

## Success Criteria

- [ ] 75/81 tests passing (93%)
- [ ] All Priority 1 issues fixed
- [ ] Memory leak fixed and verified
- [ ] Z-index bounds enforced
- [ ] Error handling for onResort closures
- [ ] Documentation updated with findings
