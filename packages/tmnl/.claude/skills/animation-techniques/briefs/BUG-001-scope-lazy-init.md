# BUG-001: anime.js v4 Scope Not Created for Conditional Elements

> React ref stability + conditional rendering = silent scope initialization failure

---

## Summary

| Field | Value |
|-------|-------|
| **ID** | BUG-001 |
| **Type** | Bug Brief |
| **Severity** | Critical (silent failure) |
| **Library** | anime.js v4 |
| **Pattern** | React scope integration |
| **Status** | Resolved |

---

## Symptom

Animation does not trigger. No errors in console. `morph()` called but nothing happens.

---

## Root Cause

**React refs are stable objects.** Their `.current` property changes, but the ref object itself doesn't change.

When using `useLayoutEffect` with a ref as dependency:

```typescript
// BROKEN: Effect doesn't re-run when element appears
useLayoutEffect(() => {
  if (!containerRef.current) return
  scopeRef.current = createScope({ root: containerRef })
}, [containerRef])  // ← containerRef is STABLE, never changes
```

For conditionally rendered elements (`{isActive && <span ref={labelRef} />}`), the element appears **after** initial mount. The ref starts as `null`, becomes non-null when element renders, but `useLayoutEffect` **never re-runs** because `containerRef` (the ref object) didn't change.

---

## Incorrect Mental Model

```
1. Component mounts
2. useLayoutEffect runs
3. containerRef.current is null
4. Scope NOT created (early return)
5. Element renders (containerRef.current becomes non-null)
6. useLayoutEffect does NOT re-run ← THE BUG
7. morph() called, scopeRef.current is still null
8. No animation, no error
```

---

## Solution: Lazy Initialization

Initialize scope at usage time, not mount time:

```typescript
const morph = useCallback((fromText, toText, options) => {
  const container = containerRef.current
  if (!container) return

  // LAZY INIT: Create scope when element exists
  if (!scopeRef.current) {
    scopeRef.current = createScope({ root: containerRef })
  }

  // Now scope is guaranteed to exist
  scopeRef.current.add(() => { /* animation */ })
}, [containerRef])
```

---

## Detection Pattern

Watch for this pattern combination:

1. ✗ `useLayoutEffect` or `useEffect` with ref dependency
2. ✗ Conditional rendering of ref target (`{condition && <el ref={ref} />}`)
3. ✗ Early return on `!ref.current`
4. ✗ Resource initialization inside effect (scope, observer, etc.)

---

## Prevention

| Do | Don't |
|----|-------|
| Initialize resources at usage time (lazy) | Initialize in mount effects for conditional elements |
| Check `ref.current` at call site | Assume effect runs when element appears |
| Add state dependency if element visibility changes | Rely solely on ref for conditional element detection |

---

## Related

- **Technique**: `../techniques/text-morph-animation.md`
- **Implementation**: `src/lib/chat-shell/text-morph.ts:424-427`
- **anime.js docs**: Scope system requires root element to exist
- **React docs**: Refs are stable objects, not reactive values

---

## Timeline

| Date | Event |
|------|-------|
| 2026-01-17 | Bug discovered - animation not triggering |
| 2026-01-17 | Root cause identified - scope never created |
| 2026-01-17 | Fix applied - lazy initialization in morph() |
