# Result Type Migration Plan

## Status: ✅ PHASE 1 COMPLETE

**Date**: 2025-12-26  
**Goal**: Migrate all atom consumers to use typed `Exit<A, E>` pattern instead of `mode: 'promise'`

**Completed**: `src/lib/editor/v3/hooks/useDocuments.ts` - All operations now use `mode: 'promiseExit'`

---

## Why This Migration?

According to [effect-atom documentation](https://github.com/tim-smart/effect-atom?tab=readme-ov-file#working-with-streams):

> When atoms return Effects or Streams, `useAtomValue` returns `Result<A, E>` with states:
>
> - `Initial` - Not yet executed
> - `Success<A>` - Completed successfully with value
> - `Failure<E>` - Failed with typed error

Using `mode: 'promise'` bypasses this type safety and loses:

- Typed error handling
- Loading state tracking
- Cancellation support
- Effect-based observability

---

## Files Requiring Migration

### 1. `src/lib/editor/v3/hooks/useDocuments.ts`

**Current**: Uses `{ mode: 'promise' }` for all operations

**Operations to migrate**:

- `documentOps.create` (line 242)
- `documentOps.load` (line 243)
- `documentOps.update` (line 244)
- `documentOps.delete` (line 245)
- `documentOps.loadList` (line 140)
- `documentQueries.getClientToken` (line 246)

**Strategy**: Keep hook API promise-based, but handle Result internally

### 2. `src/lib/table-service/hooks/useTableService.ts`

**Current**: Uses `{ mode: 'promise' }` (needs audit)

**Strategy**: TBD after audit

---

## Migration Strategy

### Option 1: Result-Aware Hook API (RECOMMENDED)

Change hook signatures to return `Result<T, E>`, push Result handling to components:

```typescript
// Before
export function useDocumentOps() {
  const createOp = useAtomSet(documentOps.create, { mode: 'promise' });

  const create = useCallback(
    async (payload, createdBy) => {
      return createOp({ payload, createdBy }); // Returns Promise
    },
    [createOp]
  );

  return { create };
}

// After
export function useDocumentOps() {
  const createOp = useAtomSet(documentOps.create); // No mode

  const create = useCallback(
    async (payload, createdBy) => {
      return createOp({ payload, createdBy }); // Returns Promise<Result<...>>
    },
    [createOp]
  );

  return { create };
}

// Component usage
function CreateButton() {
  const { create } = useDocumentOps();

  const handleCreate = async () => {
    const result = await create(payload, userId);

    if (Result.isSuccess(result)) {
      console.log('Created:', result.value.metadata.id);
    } else {
      console.error('Failed:', result.error);
    }
  };

  return <button onClick={handleCreate}>Create</button>;
}
```

### Option 2: Unwrap Result in Hook (EASIER MIGRATION)

Keep promise-based API, unwrap Result internally and throw on error:

```typescript
export function useDocumentOps() {
  const createOp = useAtomSet(documentOps.create); // No mode

  const create = useCallback(
    async (payload, createdBy) => {
      const result = await createOp({ payload, createdBy });

      if (Result.isSuccess(result)) {
        return result.value;
      } else {
        throw result.error; // Preserve error throwing
      }
    },
    [createOp]
  );

  return { create };
}

// Component usage stays the same
function CreateButton() {
  const { create } = useDocumentOps();

  const handleCreate = async () => {
    try {
      const { metadata } = await create(payload, userId);
      console.log('Created:', metadata.id);
    } catch (error) {
      console.error('Failed:', error);
    }
  };

  return <button onClick={handleCreate}>Create</button>;
}
```

**Chosen**: Option 2 for immediate compatibility, migrate to Option 1 incrementally

---

## Implementation Steps

### Phase 1: useDocuments Hook ✅ COMPLETE

- [x] Changed `{ mode: 'promise' }` to `{ mode: 'promiseExit' }` for all operations
- [x] Wrap operations to unwrap `Exit<A, E>` and throw on failure
- [x] Update imports to include `Exit` from `effect`
- [x] Updated operations: create, load, update, delete, loadList, getClientToken
- [ ] Test all CRUD operations in AutonomousEditorPanel
- [ ] Verify DocumentDrawer still works

### Phase 2: Component Migration (NEXT)

- [ ] Audit all components using `useDocuments`/`useDocumentOps`
- [ ] Add explicit error handling for operations
- [ ] Consider migrating high-value components to Option 1 (Result-aware)

### Phase 3: useTableService (LATER)

- [ ] Audit current usage
- [ ] Apply same migration pattern

---

## Testing Requirements

### Unit Tests

```typescript
import { describe, it, expect } from 'bun:test';
import { Result } from 'effect';

describe('useDocumentOps with Result types', () => {
  it('create unwraps success Result', async () => {
    const { create } = useDocumentOps();
    const result = await create(payload, userId);

    expect(result.metadata).toBeDefined();
    expect(result.clientToken).toBeDefined();
  });

  it('create throws on failure Result', async () => {
    const { create } = useDocumentOps();

    await expect(create(invalidPayload, userId)).rejects.toThrow();
  });
});
```

### Integration Tests

- [ ] DocumentDrawer create → verify UI updates
- [ ] DocumentDrawer delete → verify UI updates
- [ ] Error states render correctly

---

## Benefits After Migration

1. **Type Safety**: Compiler catches missing error handling
2. **Observability**: Effect spans track all operations
3. **Cancellation**: Can cancel in-flight operations
4. **Loading States**: Built-in Initial/Loading tracking
5. **Error Types**: Typed errors (DocumentNotFoundError, etc.)

---

## Related Documentation

- [effect-atom Working with Streams](https://github.com/tim-smart/effect-atom?tab=readme-ov-file#working-with-streams)
- `.edin/EFFECT_PATTERNS.md` - Atom-as-State pattern
- `DELETE_BUTTON_BUG_REPORT.md` - Fixed via derived atom

---

**Next Action**: Implement Phase 1 migration for `useDocuments.ts`
