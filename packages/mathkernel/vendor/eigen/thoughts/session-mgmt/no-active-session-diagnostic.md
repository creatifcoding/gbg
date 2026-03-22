# No Active Session Diagnostic (bg-diagnostics)

## Scope
Read-only diagnostic across:
- `src/lib/morphchat/hooks/useHarnessAdapter.ts`
- `src/lib/floating/visitors/morphchat-visitor.tsx`
- `src/lib/morphchat/adapters/harness-adapter.ts`

No reserved source files were modified.

---

## 1) Confirmed race paths leading to `sid = null` at send time

### Race A — UI can send before `connectOp$` commits `sessionId$`
**Location:** `useHarnessAdapter.ts` → `connectOp$` and `sendOp$`

Flow:
1. `connectOp$` sets `connection$(id)` to `connecting`.
2. `openSession(...)` is async.
3. `sendOp$` reads `sessionId$(id)` synchronously (`const sid = morphChatRegistry.get(sessionId$(id))`).
4. If send is triggered before `openSession` resolves and `sessionId$` is set, `sid` is null.
5. `sendOp$` fails with `No active session`.

Why confirmed: `sendOp$` hard-fails on `!sid`, no in-flight connect gate and no session-open await.

---

### Race B — `newSessionOp$` intentionally nulls `sessionId$` before opening the next one
**Location:** `useHarnessAdapter.ts` → `newSessionOp$`, `sendOp$`

Flow:
1. `newSessionOp$` interrupts fibers, aborts old session.
2. Clears state and explicitly does `sessionId$(id) = null`.
3. Starts async `openSession(...)` for fresh session.
4. Any send in this gap reads null sid and fails.

Why confirmed: explicit nulling precedes async open; send has no guard/retry path.

---

### Race C — `hardReconnect` clears sid immediately and reconnect is deferred by timer
**Location:** `useHarnessAdapter.ts` → `hardReconnect(...)`, `sendOp$`

Flow:
1. `hardReconnect` sets `sessionId$(id)=null`, resets connection/messages.
2. Calls `morphChatRegistry.refresh(harnessRuntimeAtom)`.
3. Reconnect occurs on `setTimeout(..., 100)` via `doConnect`.
4. Sends in this window fail with null sid.

Why confirmed: deterministic null window by design + delayed reconnect.

---

### Race D — panel status reactivity and sessionId derivation are decoupled
**Location:** `morphchat-visitor.tsx` → `MorphChatHarnessPanel`

Flow:
1. UI status is driven by `useHarnessAdapter` local state tracking `connection$(panelId)`.
2. `currentSessionId` is derived via `useMemo` reading registry directly, keyed on `[panelId, status]`.
3. Status may render as connected while session derivation can be stale/lagging for one render turn (or vice versa).
4. User can hit controls in transition windows.

Why confirmed: session id is not subscribed as atom state in panel; it is ad-hoc derivation tied to status changes.

---

### Additional note: old adapter implementation has same class of issue
**Location:** `harness-adapter.ts` → `send()`

- If `sessionId` is null, it calls `startEventStream()` then immediately checks `sessionId` again.
- Session is expected to be set by `openSession`, but this still relies on async sequencing and can fail with `No active session` on failed/slow open.

This file is not the current panel path but confirms the systemic pattern.

---

## 2) Why status can be connected while sid is missing (and vice versa)

`connection$` and `sessionId$` are separate atoms with separate write sites and no invariant enforcement.

- `connectOp$` writes `connection=connected` and `sessionId=<sid>` as separate mutations.
- `newSessionOp$` and `hardReconnect` can set `sessionId=null` before status transitions complete.
- UI consumes `status` via subscription to `connection$`, but does not subscribe to `sessionId$` in the same reactive frame.

Result: transiently inconsistent state snapshots are possible:
- `connected + sid null` (clear/reconnect/new-session gaps)
- `sid set + non-connected` (during updates/failover sequencing)

This is expected under split-atom, multi-step mutation unless explicitly serialized behind a unified state machine or atomic commit pattern.

---

## 3) Minimal safe patch plan (3 options)

### Option 1 (lowest blast radius): Send guard + queued retry until sid available
**Patch points:**
- `src/lib/morphchat/hooks/useHarnessAdapter.ts`
  - `sendOp$`
  - (optional helper) new `awaitActiveSession(id)` effect helper

**Change:**
- If `sid` is null:
  - If `connection.phase` is `connecting`/`reconnecting`, wait up to short timeout (e.g. 1–2s) for `sessionId$` to become non-null, then send.
  - If timeout expires, emit structured status row `[send] no active session after wait`.
- Do **not** hard-fail immediately in transient connect windows.

**Why safe:** localized to send path; no lifecycle refactor.

---

### Option 2 (state correctness): Introduce explicit session phase gate and disable send while transitioning
**Patch points:**
- `src/lib/morphchat/hooks/useHarnessAdapter.ts`
  - add `sessionPhase$` atom family (`idle|opening|ready|resetting`)
  - set in `connectOp$`, `newSessionOp$`, `hardReconnect`, `disposeOp$`
  - check in `sendOp$`
- `src/lib/floating/visitors/morphchat-visitor.tsx`
  - pass a `canSend`/`sessionReady` flag into surface controls (or disable NEW/RECONNECT send-adjacent controls while opening)

**Change:**
- Enforce `send` only when `sessionPhase=ready && sid!=null`.
- Avoid null-window sends instead of racing them.

**Why safe:** still localized, but adds explicit invariant.

---

### Option 3 (strongest correctness): Atomic session snapshot atom
**Patch points:**
- `src/lib/morphchat/hooks/useHarnessAdapter.ts`
  - create `sessionState$ = { phase, sid, endpoint, lastTransitionAt }` atom family
  - replace split writes in `connectOp$`, `newSessionOp$`, `hardReconnect`
  - `sendOp$` reads only `sessionState$`
- `src/lib/floating/visitors/morphchat-visitor.tsx`
  - derive status/session from single subscribed source

**Change:**
- One atom is source of truth for connection+session invariants.
- Remove dual-atom drift windows.

**Why safe:** moderate refactor but clean model; best long-term.

---

## 4) Suggested observability logs to keep/remove

### Keep (structured, temporary until fixed)
1. `sendOp$` preflight log with:
   - `instanceId`
   - `sid`
   - `connection.phase`
   - optional `sessionPhase` (if added)
   - monotonic timestamp
2. `connectOp$` successful session-open log (already present, keep but normalize shape).
3. `newSessionOp$` transition logs:
   - `oldSid`, `clearedAt`, `newSid`, `openDurationMs`
4. `hardReconnect` logs:
   - clear timestamp, runtime refresh completion, reconnect start/end.

### Remove / reduce after stabilization
- Repetitive per-send console spam once metrics confirm fix.
- Any raw payload dumps that include tool/event noise unrelated to session invariants.

### Preferred format
- Use single-line structured logs (JSON-ish), not free-form strings, to allow timeline reconstruction.

---

## 5) Repro checklist

1. Open `morphchat:harness` panel.
2. Immediately send a message while status is transitioning from idle/connecting.
   - Expect intermittent `[send] No active session` today.
3. Click `NEW` and send within ~0–300ms.
   - Hits `sessionId=null` window from `newSessionOp$`.
4. Click `RECONNECT` and send immediately.
   - Hits `hardReconnect` null+timer window.
5. Repeat with rapid NEW/RECONNECT alternation.
6. Capture logs from `sendOp`, `connectOp`, `newSessionOp`, `hardReconnect` with timestamps.
7. Validate mismatch cases:
   - UI status connected while sid null
   - sid set while status not yet connected

---

## Recommended minimal patch points (priority)
1. `useHarnessAdapter.ts` → `sendOp$` (add transient wait/gate) **first**
2. `useHarnessAdapter.ts` → `newSessionOp$` and `hardReconnect(...)` (explicit transition markers)
3. `morphchat-visitor.tsx` → panel control gating for session-ready only

These three are sufficient for a minimal, safe reduction of recurring `No active session` without re-architecting the adapter stack.
