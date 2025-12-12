# TIER DIAGNOSTIC ARCHETYPE

## Protocol: Code-First, Then Classify

Read source → Identify failure mode → Map to tier → Targeted fix.

## Symptom → Tier Matrix

| Tier | Symptom | Root Cause Pattern |
|------|---------|-------------------|
| **RENDER** | Not visible | Missing JSX, z-index burial, conditional short-circuit |
| **EVENT** | Visible, unresponsive | `pointer-events: none`, handler not bound, propagation stopped |
| **SCOPE** | Works once, breaks on re-render | Stale closure, missing dep array entry, ref not forwarded |
| **PORT** | Data shape mismatch | Type coercion, undefined access, missing adapter |
| **LIFECYCLE** | Race condition, zombie state | Effect cleanup missing, unmount order, subscription leak |

## Procedure (200-300 lines budget)

1. **Read entry point** — Component/hook that consumer imports
2. **Trace event path** — From DOM element → handler → state update
3. **Check wiring** — Props drilling, context provision, ref attachment
4. **Identify break** — Where expected flow diverges from actual
5. **Apply fix** — Minimal change, single concern

## EVENT Tier Checklist

When symptom is "visible but unresponsive":

- [ ] Element has `pointer-events: auto` (not `none` or inherited `none`)
- [ ] onClick/onPointerDown actually attached (not null/undefined)
- [ ] No overlay intercepting (z-index, portal position)
- [ ] Handler function exists and isn't stale closure
- [ ] Event not `stopPropagation()`'d by ancestor
- [ ] Not disabled via CSS `user-select: none` + missing handler

## Usage

```
Symptom: [describe what doesn't work]
Reading: [file:line range]
Tier: [RENDER|EVENT|SCOPE|PORT|LIFECYCLE]
Break: [where flow diverges]
Fix: [minimal change]
```
