# Result Pattern Analysis — Collaboration Editor

**Date**: 2025-12-26  
**Context**: Analyzing where `Result<A, E>` pattern applies in collaboration editor

---

## Architecture Summary

### State Atoms (Plain Values)

**Location**: `src/lib/editor/v3/atoms/documents.ts`

All state atoms use `Atom.make(value)` with **plain values** (not Effects):

```typescript
// Plain atoms — direct access ✅
documentsAtom: Atom.make<Map<DocumentId, DocumentMetadata>>(new Map())
currentDocumentIdAtom: Atom.make<DocumentId | null>(null)
documentsLoadingAtom: Atom.make<boolean>(false)
documentsErrorAtom: Atom.make<string | null>(null)

// Derived atoms — computed synchronously ✅
documentListAtom: Atom.make((get) => {
  const docs = get(documentsAtom)
  return Array.from(docs.values()).sort(...)
})
```

**Result Pattern**: ❌ NOT APPLICABLE  
**Reason**: Plain values, not Effects. Components use `useAtomValue()` directly.

---

### Operation Atoms (Effect-Based)

**Location**: `src/lib/editor/v3/atoms/documents.ts` lines 206-529

All operations use `runtimeAtom.fn<Args>()((args, ctx) => Effect.gen(...))`:

```typescript
documentOps.create: runtimeAtom.fn<{payload, createdBy}>()
documentOps.load: runtimeAtom.fn<DocumentId>()
documentOps.update: runtimeAtom.fn<{documentId, payload, updatedBy}>()
documentOps.delete: runtimeAtom.fn<{documentId, deletedBy}>()
documentOps.loadList: runtimeAtom.fn<void>()

documentQueries.getClientToken: runtimeAtom.fn<DocumentId>()
```

**Result Pattern**: ⚠️ CONDITIONALLY APPLICABLE  
**If** components called `useAtomValue(documentOps.create)` → Would return `Result<A, E>`  
**But** they DON'T. They use `useAtomSet()` instead.

---

### Hook Layer (Exit Pattern Migration ✅)

**Location**: `src/lib/editor/v3/hooks/useDocuments.ts` lines 145-346

All hooks use `useAtomSet(..., { mode: 'promiseExit' })`:

```typescript
// Pattern (already migrated):
const createOp = useAtomSet(documentOps.create, { mode: 'promiseExit' });

const create = useCallback(
  async (payload, createdBy) => {
    const exit = await createOp({ payload, createdBy });

    if (Exit.isSuccess(exit)) {
      return exit.value;
    } else {
      throw exit.cause; // Unwrap for compatibility
    }
  },
  [createOp]
);
```

**Result Pattern**: ✅ USING EXIT (equivalent pattern)  
**Status**: Already migrated. Operations use typed `Exit<A, E>` internally.

---

## Current Component Usage

### AutonomousEditorPanel.tsx (lines 138-145)

```typescript
const {
  documentList, // ← Plain atom (readonly DocumentListItem[])
  isLoading, // ← Plain atom (boolean)
  loadList, // ← async function that unwraps Exit internally
  error, // ← Plain atom (string | null)
} = useDocuments();

const {
  create: createDocument, // ← async function that unwraps Exit internally
  delete: deleteDocument, // ← async function that unwraps Exit internally
} = useDocumentOps();
```

**What components see**:

- Plain values for state atoms (direct access)
- Async functions for operations (Exit handled inside hook)
- **No `Result<A, E>` types exposed** to component layer

---

## Where Result Pattern WOULD Apply

### Hypothetical: Direct Operation Consumption

If components tried to read operation atoms directly (WRONG pattern):

```typescript
// WRONG — treating operation as readable state
const createResult = useAtomValue(documentOps.create);

// Would need Result.match:
Result.match(createResult, {
  onInitial: () => <div>Not called yet</div>,
  onFailure: (error) => <div>Error: {error.message}</div>,
  onSuccess: (result) => <div>Created: {result.value.metadata.id}</div>,
});
```

**But this is an anti-pattern!** Operations are **write-only** (via `useAtomSet`), not readable state.

---

## Correct Patterns in Use

### Pattern 1: State Atoms → Direct Access ✅

```typescript
const documentList = useAtomValue(documentListAtom); // readonly DocumentListItem[]
const isLoading = useAtomValue(documentsLoadingAtom); // boolean
const error = useAtomValue(documentsErrorAtom); // string | null
```

**No Result needed** — atoms contain plain values.

### Pattern 2: Operations → useAtomSet + Exit Unwrap ✅

```typescript
// Hook layer unwraps Exit<A, E> → Promise<A> or throws
const createOp = useAtomSet(documentOps.create, { mode: 'promiseExit' });

const create = async (payload, createdBy) => {
  const exit = await createOp({ payload, createdBy });
  if (Exit.isSuccess(exit)) return exit.value;
  else throw exit.cause;
};

// Component layer uses async/await + try/catch
const handleCreate = async () => {
  try {
    const { metadata } = await create({ title: 'New Doc' }, userId);
    console.log('Created:', metadata.id);
  } catch (error) {
    console.error('Failed:', error);
  }
};
```

**Exit pattern** (equivalent to Result) used internally, unwrapped at hook boundary.

---

## Panel Atoms (panel-stx.ts)

**Location**: `src/components/testbed/collaboration/v2/panel-stx.ts` lines 77-166

```typescript
panelStatusAtom: Atom.make<ConnectionStatus>('disconnected'); // Plain string
panelDocIdAtom: Atom.make<string | null>(null); // Plain value
panelClientTokenAtom: Atom.make<ClientToken | null>(null); // Plain value
panelUsersAtom: Atom.make<readonly CollaborationUser[]>([]); // Plain array
```

**Result Pattern**: ❌ NOT APPLICABLE  
**Reason**: All plain values. Direct access is correct.

---

## Type Assertion Issue (Separate from Result Pattern)

### AutonomousEditorPanel.tsx lines 112-124

```typescript
const status = useAtomValue(atoms.status as any) as ConnectionStatus;
const clientToken = useAtomValue(
  atoms.clientToken as any
) as ClientToken | null;
```

**Issue**: Type mismatch between atom definitions and hook return types.  
**Fix**: Align types in `getPanelAtoms()` return value, not Result pattern migration.

---

## Migration Status

### ✅ Already Done

1. **Hook layer** — All operations use `{ mode: 'promiseExit' }`
2. **State atoms** — Correctly use plain values (no Effects)
3. **Derived atoms** — Correctly use synchronous `(get) => ...` functions

### ❌ Not Applicable

1. **State atoms** — Plain values, not Effects → No Result needed
2. **Panel atoms** — Plain values, not Effects → No Result needed
3. **Operation atoms** — Write-only (useAtomSet), not read → No Result.match needed

### ⚠️ Future Consideration

If we want to expose **operation status as reactive state** (e.g., show "Creating document..." spinner):

```typescript
// Hypothetical: Operation status atom
const createStatusAtom = Atom.make(
  Effect.gen(function* () {
    const result = yield* documentOps.create({ payload, createdBy });
    return result;
  })
);

// Would need Result.match:
const result = useAtomValue(createStatusAtom);
Result.match(result, {
  onInitial: () => <div>Ready to create</div>,
  onFailure: (error) => <div>Failed: {error.message}</div>,
  onSuccess: (data) => <div>Created: {data.value.metadata.id}</div>,
});
```

**But** we already have `documentsLoadingAtom` for this use case (boolean flag).

---

## Conclusion

### No Action Needed for AutonomousEditorPanel ✅

The component correctly uses:

- **Plain atoms** → Direct `useAtomValue()` access
- **Operations** → Wrapped in hooks that handle Exit internally
- **Error handling** → Via `documentsErrorAtom` (plain string | null)

### Type Assertions Issue (Separate)

The `as any` casts are a **type safety issue**, not a Result pattern issue. Fix by:

1. Verifying `getPanelAtoms()` return types
2. Ensuring atom types match component expectations
3. Removing casts once types align

### Result Pattern Is Correctly Applied ✅

- **State atoms** — Plain values (no Result)
- **Operation atoms** — Exit pattern inside hooks (equivalent to Result)
- **Components** — See unwrapped values + async functions

**Architecture is sound.** No migration needed.

---

## Reference: When to Use Result Pattern

### ✅ Use Result.match When:

1. **Atom contains Effect** — `Atom.make(Effect.gen(...))`
2. **Component reads atom** — `useAtomValue(effectAtom)`
3. **Need to handle Initial/Failure/Success** — Not just success case

### ❌ Don't Use Result When:

1. **Atom contains plain value** — `Atom.make(value)`
2. **Operation is write-only** — `useAtomSet(opAtom)`
3. **Hook unwraps Exit** — Component sees `Promise<A>`, not `Result<A, E>`

---

**Last Updated**: 2025-12-26  
**Author**: Val  
**Status**: Analysis complete — No migration needed
