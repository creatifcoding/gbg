# Delete Button Bug Report

## Status: ✅ FIXED (Derived Atom Pattern)

**Fixed:** 2025-12-26  
**Solution:** Refactored `documentListAtom` to be a derived atom from `documentsAtom`

### What Was Changed

1. **`src/lib/editor/v3/atoms/documents.ts`**
   - Line ~109-111: Changed `documentListAtom` from primitive atom to derived atom
   - Now computes list from `documentsAtom` on every read
   - Auto-sorts by `updatedAt` descending
2. **`src/lib/editor/v3/atoms/documents.ts`**
   - Line ~436-441: Updated `documentOps.loadList` to populate `documentsAtom` instead of `documentListAtom`
   - List atom auto-derives from map
3. **`src/components/testbed/collaboration/v2/AutonomousEditorPanel.tsx`**
   - Line ~243-245: Removed `await loadList()` workaround from `handleDeleteDoc`
   - Removed `loadList` from dependency array

### Result

- ✅ Delete operations auto-update UI (no manual refresh needed)
- ✅ Single source of truth (`documentsAtom`)
- ✅ No state synchronization bugs possible
- ✅ Create/Update/Delete all work correctly

---

## Original Bug Report

## Symptom

When clicking the delete button on a document in the DocumentDrawer, the document doesn't disappear from the list.

## Root Cause

**File:** `src/lib/editor/v3/atoms/documents.ts`  
**Operation:** `documentOps.delete`  
**Line:** ~385-420

The delete operation updates `documentsAtom` but **NOT** `documentListAtom`:

```typescript
// Remove from local state
Effect.tap(() =>
  Effect.sync(() => {
    const current = ctx(documentsAtom);
    const updated = new Map<DocumentId, DocumentMetadata>(current);
    updated.delete(documentId);
    ctx.set(documentsAtom, updated);  // ✅ Updates map

    // ❌ MISSING: Does NOT update documentListAtom

    // Clear current if deleted
    if (ctx(currentDocumentIdAtom) === documentId) {
      ctx.set(currentDocumentIdAtom, null);
    }
  })
),
```

## Data Flow

```
User clicks delete
    ↓
DocumentDrawer.onDelete()
    ↓
AutonomousEditorPanel.handleDeleteDoc()
    ↓
deleteDocument(docId, userId)  [useDocumentOps hook]
    ↓
documentOps.delete({ documentId, deletedBy })
    ↓
DocumentRegistryService.delete()  [Calls NATS/y-sweet]
    ↓
Updates documentsAtom ✅
    BUT
Doesn't update documentListAtom ❌
    ↓
UI still shows deleted document (reads from documentListAtom)
```

## State Atoms

The documents system maintains TWO separate atoms:

1. **`documentsAtom`** - Map<DocumentId, DocumentMetadata>

   - Updated by delete ✅
   - Used by: Internal state, currentDocumentAtom derived atom

2. **`documentListAtom`** - readonly DocumentListItem[]
   - NOT updated by delete ❌
   - Used by: DocumentDrawer UI, document browser
   - **This is what the user sees!**

## Fix Required

Update `documentOps.delete` to also remove from `documentListAtom`:

```typescript
// Remove from local state
Effect.tap(() =>
  Effect.sync(() => {
    const current = ctx(documentsAtom);
    const updated = new Map<DocumentId, DocumentMetadata>(current);
    updated.delete(documentId);
    ctx.set(documentsAtom, updated);

    // FIX: Also remove from list atom
    const currentList = ctx(documentListAtom);
    const updatedList = currentList.filter(item => item.id !== documentId);
    ctx.set(documentListAtom, updatedList);

    // Clear current if deleted
    if (ctx(currentDocumentIdAtom) === documentId) {
      ctx.set(currentDocumentIdAtom, null);
    }
  })
),
```

## Why This Happened

**Dual state without synchronization:**

- `documentsAtom` is the "source of truth" (map)
- `documentListAtom` is a "view" for the UI (array)
- Operations update the map but forget to update the array
- The array is only refreshed on `loadList()` call

**Current workaround in AutonomousEditorPanel:**

```typescript
const handleDeleteDoc = useCallback(
  async (docId: string) => {
    if (useNatsPersistence) {
      try {
        await deleteDocument(docId as DocumentId, user.name as IdentityId);
        // Refresh list after delete ← This works around the bug
        await loadList();
      } catch (err) {
        console.error(
          '[AutonomousEditorPanel] Failed to delete document:',
          err
        );
      }
    }
  },
  [useNatsPersistence, deleteDocument, user.name, loadList]
);
```

The `await loadList()` call masks the bug by re-fetching the entire list from the server.

## Better Fix: Derived Atom Pattern

Instead of maintaining two separate atoms, make `documentListAtom` a **derived atom**:

```typescript
// Make documentListAtom derive from documentsAtom
export const documentListAtom = Atom.make((get) => {
  const documentsMap = get(documentsAtom);
  return Array.from(documentsMap.values())
    .map((metadata) => ({
      id: metadata.id,
      title: metadata.title,
      status: metadata.status,
      visibility: metadata.visibility,
      tags: metadata.tags,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
    }))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
});
```

**Benefits:**

- Single source of truth (documentsAtom)
- documentListAtom auto-updates when documentsAtom changes
- No manual synchronization needed
- Delete operations only update one atom

## Testing Requirements

### Unit Test: documentOps.delete

```typescript
import { describe, it, expect } from '@effect/vitest';
import { documentOps, documentsAtom, documentListAtom } from '../documents';

describe('documentOps.delete', () => {
  it.effect('removes document from documentsAtom AND documentListAtom', () =>
    Effect.gen(function* () {
      const registry = yield* Registry.make();

      // Setup: Add a document
      const doc = { id: 'doc-1', title: 'Test' /* ... */ };
      registry.set(documentsAtom, new Map([['doc-1', doc]]));
      registry.set(documentListAtom, [
        { id: 'doc-1', title: 'Test' /* ... */ },
      ]);

      // Act: Delete
      yield* documentOps.delete({ documentId: 'doc-1', deletedBy: 'user-1' });

      // Assert: Both atoms updated
      const documentsMap = registry.get(documentsAtom);
      const documentList = registry.get(documentListAtom);

      expect(documentsMap.has('doc-1')).toBe(false);
      expect(documentList.find((d) => d.id === 'doc-1')).toBeUndefined();
    })
  );
});
```

### Integration Test: DocumentDrawer + Delete

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentDrawer } from '../DocumentDrawer';

describe('DocumentDrawer delete button', () => {
  it('removes document from list when delete clicked', async () => {
    const onDeleteDoc = vi.fn().mockResolvedValue(undefined);
    const documents = [
      { id: 'doc-1', title: 'Test Doc' /* ... */ },
      { id: 'doc-2', title: 'Other Doc' /* ... */ },
    ];

    const { rerender } = render(
      <DocumentDrawer
        isOpen={true}
        documents={documents}
        onDeleteDoc={onDeleteDoc}
        /* ... */
      />
    );

    // Find and click delete button for doc-1
    const deleteButton = screen.getAllByRole('button', { name: /trash/i })[0];
    fireEvent.click(deleteButton);

    // Verify delete was called
    await waitFor(() => {
      expect(onDeleteDoc).toHaveBeenCalledWith('doc-1');
    });

    // Simulate parent removing doc from list
    rerender(
      <DocumentDrawer
        isOpen={true}
        documents={documents.filter((d) => d.id !== 'doc-1')}
        onDeleteDoc={onDeleteDoc}
        /* ... */
      />
    );

    // Verify doc-1 is gone from UI
    expect(screen.queryByText('Test Doc')).not.toBeInTheDocument();
    expect(screen.getByText('Other Doc')).toBeInTheDocument();
  });
});
```

### E2E Test: Full Delete Flow

```typescript
describe('Document deletion E2E', () => {
  it('deletes document and removes from list', async () => {
    // 1. Create document
    const { metadata } = await createDocument({ title: 'To Delete' }, 'user-1');

    // 2. Load list and verify it's there
    const listBefore = await loadList();
    expect(listBefore.find((d) => d.id === metadata.id)).toBeDefined();

    // 3. Delete
    await deleteDocument(metadata.id, 'user-1');

    // 4. Verify removed from list (without manual loadList call)
    const listAtom = Atom.get(documentListAtom);
    expect(listAtom.find((d) => d.id === metadata.id)).toBeUndefined();

    // 5. Verify removed from map
    const mapAtom = Atom.get(documentsAtom);
    expect(mapAtom.has(metadata.id)).toBe(false);
  });
});
```

## Recommended Fix Strategy

1. **Immediate Fix** (maintains current architecture):

   - Update `documentOps.delete` to also update `documentListAtom`
   - Write unit test to prevent regression

2. **Better Fix** (refactor to derived atom):

   - Make `documentListAtom` a computed atom derived from `documentsAtom`
   - All operations only touch `documentsAtom`
   - UI automatically updates

3. **Add Tests**:
   - Unit: documentOps.delete updates both atoms
   - Integration: DocumentDrawer delete button flow
   - E2E: Full delete → list update → UI refresh

## Related Files

- `src/lib/editor/v3/atoms/documents.ts` - **BUG HERE** (line ~395)
- `src/lib/editor/v3/hooks/useDocuments.ts` - Hook that exposes delete
- `src/components/testbed/collaboration/v2/AutonomousEditorPanel.tsx` - handleDeleteDoc (has workaround)
- `src/components/testbed/collaboration/v2/DocumentDrawer.tsx` - UI (works correctly)

---

**Date:** 2025-12-26  
**Reporter:** User observation during testing  
**Priority:** High (breaks core UX)  
**Impact:** Users can't see deleted documents removed from list without refresh
