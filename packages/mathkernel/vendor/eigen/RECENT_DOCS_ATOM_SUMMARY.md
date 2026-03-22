# Recent Documents - Panel-Scoped Derived Atom

## What Changed

Added panel-specific derived atom for recent documents in the autonomous editor panels.

## Pattern: Derived Atom within Family

### File: `panel-stx.ts`

**New Atom (line 159-166):**

```typescript
/**
 * Recent documents specific to this panel.
 * Derived from shared recentDocsAtom, showing only docs accessed by this panel.
 *
 * NOTE: For now, returns all recent docs (shared).
 * Future: track panel-specific access history.
 */
export const panelRecentDocsAtom = Atom.family((panelId: string) =>
  Atom.make((get) => {
    const allRecent = get(recentDocsAtom);
    // For now, show all recent docs (shared pool)
    // Future: filter by panelId-specific access tracking
    return allRecent;
  })
);
```

**Why This Pattern?**

- `Atom.family` creates stable atom instances keyed by `panelId`
- `Atom.make((get) => ...)` creates a **computed/derived** atom
- Derived atom automatically updates when `recentDocsAtom` changes
- Each panel gets its own isolated subscription to the derived value

## Integration

### 1. Added to `getPanelAtoms()` (line 407)

```typescript
export function getPanelAtoms(panelId: string) {
  return {
    // ... existing atoms
    recentDocs: panelRecentDocsAtom(panelId), // ← New
  } as const;
}
```

### 2. Consumed in `AutonomousEditorPanel` (line 121)

```typescript
const recentDocs = useAtomValue(
  atoms.recentDocs as any
) as readonly RecentDoc[];
```

### 3. Passed to `ContextualToolbar` (line 381)

```typescript
<ContextualToolbar
  // ... other props
  recentDocs={recentDocs} // ← Was hardcoded to []
/>
```

### 4. Tracked on Connection (line 169)

```typescript
const handleConnect = useCallback(
  (docId: string, title?: string) => {
    const name = title ?? generatePetName();
    doCloseDrawer(args.closeDrawer());
    doSetPetName(args.setPetName(name));
    doConnect(args.connect(docId));

    // Add to recent docs ← NEW
    doAddToRecent({ docId, petName: name });
  },
  [doConnect, doCloseDrawer, doSetPetName, doAddToRecent, args]
);
```

## How It Works

```
User clicks document
    ↓
handleConnect(docId, title)
    ↓
doAddToRecent({ docId, petName })
    ↓
panelOps.addToRecentDocs (panel-stx.ts:340)
    ↓
Updates recentDocsAtom (shared)
    ↓
panelRecentDocsAtom derives from recentDocsAtom
    ↓
AutonomousEditorPanel re-renders
    ↓
ContextualToolbar shows recent docs dropdown
```

## UI Behavior

**ContextualToolbar - Document Breadcrumb Dropdown:**

- Shows current document name as button
- Clicking opens dropdown with:
  - "New Document" option
  - "Document Picker" option
  - "Recent Documents" section (up to 5 most recent)
- Each recent doc shows its pet name
- Clicking a recent doc connects to that document

**Before:**

```tsx
recentDocs={[]} // Always empty
```

**After:**

```tsx
recentDocs = { recentDocs }; // Derived from panel-specific atom
```

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────┐
│         Shared State (localStorage-backed)          │
│                                                      │
│  recentDocsAtom: readonly RecentDoc[]               │
│  - Shared across all panels                         │
│  - Persisted to localStorage                        │
│  - Max 10 documents                                 │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│      Panel-Scoped Derived Atoms (per panelId)       │
│                                                      │
│  panelRecentDocsAtom(panelId)                       │
│  - Computed from recentDocsAtom                     │
│  - Future: filter by panel-specific access          │
│  - Auto-updates when shared atom changes            │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│              React Component                         │
│                                                      │
│  const recentDocs = useAtomValue(                   │
│    atoms.recentDocs                                 │
│  )                                                   │
│                                                      │
│  <ContextualToolbar recentDocs={recentDocs} />     │
└─────────────────────────────────────────────────────┘
```

## Future Enhancement Ideas

### Panel-Specific Access Tracking

Currently all panels see the same recent docs. To make it panel-specific:

```typescript
// Add panel access tracking
export const panelDocAccessAtom = Atom.family((panelId: string) =>
  Atom.make<Set<string>>(new Set())
);

// Filter recent docs by panel access
export const panelRecentDocsAtom = Atom.family((panelId: string) =>
  Atom.make((get) => {
    const allRecent = get(recentDocsAtom);
    const panelAccess = get(panelDocAccessAtom(panelId));

    // Only show docs this panel has accessed
    return allRecent.filter((doc) => panelAccess.has(doc.docId));
  })
);
```

### Sort by Panel-Specific Access Time

```typescript
export const panelRecentDocsAtom = Atom.family((panelId: string) =>
  Atom.make((get) => {
    const allRecent = get(recentDocsAtom);
    const panelAccessTimes = get(panelDocAccessTimesAtom(panelId));

    return allRecent
      .map((doc) => ({
        ...doc,
        lastAccessedByPanel: panelAccessTimes.get(doc.docId) ?? 0,
      }))
      .sort((a, b) => b.lastAccessedByPanel - a.lastAccessedByPanel);
  })
);
```

## Key Takeaways

1. **Derived atoms are computed values** — Use `Atom.make((get) => ...)` pattern
2. **Atom.family enables per-key isolation** — Each panel gets its own atom instance
3. **Derived atoms auto-update** — When dependencies change, derived atoms recompute
4. **Keep shared state minimal** — Only `recentDocsAtom` is shared, rest is derived
5. **localStorage persistence happens at the shared level** — Individual panels just read

---

**Date:** 2025-12-26  
**Pattern:** Derived Atom within Atom.family  
**Files Modified:** 2 (`panel-stx.ts`, `AutonomousEditorPanel.tsx`)
