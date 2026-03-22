# Annotation Popover Close Policy Matrix

## Contract

Popover closure is machine-driven and explicit. Close reason is retained in machine context for diagnostics.

| Trigger/Event | Condition | Result | Close Reason |
|---|---|---|---|
| `CLOSE` | always | `closed` | provided reason or `manual` |
| `OUTSIDE_CLICK` | not pinned | `closed` | `outside` |
| `ESCAPE` | always | `closed` | `escape` |
| `SELECTION_INVALIDATED` | always | `closed` | `selection-change` |
| `blur` lifecycle event | only when not pinned | `closed` | `blur` |
| anchor refresh failure | missing range + missing DOM | `closed` | `invalid-anchor` |
| `SAVE_EDIT` | editing note | `closed` | `save` |
| `CANCEL_EDIT` | editing note | `closed` | `cancel` |

---

## Non-closing transitions

| Trigger/Event | Result |
|---|---|
| `PIN` | `open.pinned` |
| `UNPIN` | `open.hover` |
| `UPDATE_DRAFT` | remains `open.editing` |
| `ANCHOR_UPDATED` | remains in current open state |

---

## Notes

- Open policy is explicit via `OPEN_HOVER`, `OPEN_CLICK`, `OPEN_MANUAL`.
- Pinned state prevents passive close paths (e.g., outside interactions can be blocked at UI layer).
- Close reasons are preserved through context reset to support traceability and debugging.
