# Annotation Popover Anchor Model (Source of Truth)

## Objective

Define deterministic anchor ownership for annotation popovers in TipTap/ProseMirror.

---

## Anchor source hierarchy

1. **Primary**: `AnchorRange` (`from`, `to`) tracked for active annotation mark ID.
2. **Derived**: virtual anchor rect computed from `posToDOMRect(editor.view, from, to)`.
3. **Fallback**: DOM lookup by `[data-annotation-id]` only when range cannot be resolved.
4. **Failure mode**: if neither range nor DOM target resolves, close with `invalid-anchor`.

---

## Lifecycle rules

### On OPEN_* event

- Resolve initial annotation range from current editor state by mark ID.
- Store range in local anchor range ref.
- Emit open event with virtual anchor to controller.

### On transaction

- Map existing `AnchorRange` through transaction `StepMap`:
  - `mappedFrom = tr.mapping.map(from, -1)`
  - `mappedTo = tr.mapping.map(to, 1)`
- Validate mapped range still contains target annotation mark.
- If invalid, re-scan doc for mark ID to recover current range.
- If unresolved, close popover (`invalid-anchor`).
- If resolved, emit `ANCHOR_UPDATED` with virtual anchor from mapped/recovered range.

### On scroll/resize

- Recompute virtual anchor from current `AnchorRange`.
- If no current range, attempt re-scan by annotation ID.
- If unresolved, close (`invalid-anchor`).

### On selection-change

- Popover closes (`selection-change`) by policy.
- Anchor range ref is cleared.

---

## Why this model

- ProseMirror positions are canonical for editor content identity.
- DOM nodes are transient under collaboration/transactions.
- Range mapping preserves anchor continuity across document edits.

---

## Integration boundary

- Range tracking + anchor recomputation happens in popover controller/hook layer.
- `popoverOps.updateAnchor` remains the mutation boundary to atom/service layer.
