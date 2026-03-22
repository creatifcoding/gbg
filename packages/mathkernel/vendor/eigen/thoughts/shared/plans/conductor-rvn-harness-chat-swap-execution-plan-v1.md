# Conductor RVN Harness Chat Swap Execution Plan v1

Date: 2026-02-11  
Owner: Val  
Status: Ready for execution (planning only, no code changes in this document)

## Objective

Swap the mounted Conductor chat surface from legacy `ConductorAgentChat` composition to an RVN harness-native surface, while preserving existing harness chat behavior.

## Hard Constraints (locked)

1. **Final mounted surface must not reuse `ConductorAgentChat`**.
2. **`HarnessRuntime` boundary remains untouched** (no contract/service edits in `src/lib/harness/**`).
3. Keep stream-first chat-v2 behavior intact (`openSession/resumeSession/getSnapshot` path).
4. Use small, coherent commit slices with explicit rollback points.

---

## Acceptance Gates (define first, check every slice)

| Gate | Requirement | Conformance check |
|---|---|---|
| G1 | Mounted chat in `ConductorTestbed` no longer imports/renders `ConductorAgentChat` | static assertion test + source grep check |
| G2 | Harness boundary untouched | `git diff --name-only -- src/lib/harness` is empty for swap PR |
| G3 | Node chat runtime path unchanged | `chat-v2-hardcut.test.ts` assertions remain green (`openSession/resumeSession/getSnapshot`, no `PiRemoteChatV2Client`) |
| G4 | RVN chat compound contract intact | `RvnConductorChat.contract.test.tsx` green |
| G5 | UX parity for core controls (send/reconnect/pause/reset/exit) | new swap regression tests green |
| G6 | No hidden fallback mount | source contract test ensures no `ConductorAgentChat.Root` in `ConductorTestbed.tsx` |

---

## Dependency Order (strict)

```text
Slice-01 -> Slice-02 -> Slice-03 -> Slice-04 -> Slice-05
```

- **No parallelization** for these slices; each one introduces contracts the next depends on.

---

## Slice-01 — Contract decoupling + swap seam scaffolding

**Depends on:** none  
**Goal:** remove type/API coupling that forces `ConductorTestbed` to import from `ConductorAgentChat`.

### Files (exact)

- **Create** `src/components/testbed/conductor/chat-surface-types.ts`
- **Edit** `src/components/testbed/conductor/ConductorAgentChat.tsx`
- **Edit** `src/components/testbed/ConductorTestbed.tsx`

### Work

1. Move shared UI-only chat surface types (e.g. expansion-level shape) into `chat-surface-types.ts`.
2. Repoint both legacy and RVN surfaces to that shared type module.
3. Keep runtime callbacks and `agent-chat-stx` usage unchanged.

### Tests

```bash
bunx vitest run src/components/testbed/conductor/__tests__/ConductorAgentChat.regression.test.tsx
bunx vitest run src/components/testbed/conductor/__tests__/RvnConductorChat.contract.test.tsx
bunx vitest run src/components/testbed/conductor/__tests__/chat-v2-hardcut.test.ts
```

### Rollback point

- **RP-01**: `swap-s01-contract-seam` (commit immediately after tests pass)

---

## Slice-02 — Build RVN harness-mounted composition surface

**Depends on:** Slice-01  
**Goal:** create the RVN-mounted chat composition that can replace the legacy mounted surface without touching runtime boundary.

### Files (exact)

- **Create** `src/components/testbed/conductor/RvnHarnessChatSurface.tsx`
- **Create** `src/components/testbed/conductor/rvn-harness-chat-view-model.ts`
- **Edit** `src/components/testbed/conductor/RvnConductorChat.tsx`
- **Create** `src/components/testbed/conductor/__tests__/RvnHarnessChatSurface.contract.test.tsx`

### Work

1. Implement a mountable RVN harness surface that composes `RvnConductorChat.*` compounds.
2. Map existing `ConductorTestbed` chat props into RVN slots via a pure mapper (`rvn-harness-chat-view-model.ts`).
3. Preserve callback signatures used by `ConductorTestbed` (`onSend`, `onReconnect`, `onPause`, `onResetSession`, `onExitChat`).
4. Do not import `HarnessRuntime` directly from this new UI layer (runtime remains in `agent-chat-stx`).

### Tests

```bash
bunx vitest run src/components/testbed/conductor/__tests__/RvnConductorChat.contract.test.tsx
bunx vitest run src/components/testbed/conductor/__tests__/RvnHarnessChatSurface.contract.test.tsx
bunx vitest run src/components/testbed/conductor/__tests__/chat-v2-hardcut.test.ts
```

### Rollback point

- **RP-02**: `swap-s02-rvn-harness-surface`

---

## Slice-03 — Mounted surface swap in ConductorTestbed (no legacy mount)

**Depends on:** Slice-02  
**Goal:** perform the actual mount swap so final surface no longer reuses `ConductorAgentChat`.

### Files (exact)

- **Edit** `src/components/testbed/ConductorTestbed.tsx`
- **Create** `src/components/testbed/conductor/__tests__/ConductorTestbed.chat-swap.contract.test.ts`
- **Edit** `src/components/testbed/conductor/__tests__/chat-v2-hardcut.test.ts`

### Work

1. Replace `ConductorAgentChat.Root` mount tree with `RvnHarnessChatSurface` mount.
2. Remove `ConductorAgentChat` import from `ConductorTestbed.tsx`.
3. Add explicit source-level guard test asserting:
   - `ConductorTestbed.tsx` does **not** import/render `ConductorAgentChat`
   - `ConductorTestbed.tsx` **does** mount RVN harness chat surface.
4. Preserve existing `NodeChatAtomAccessors` and all `run*` callback wiring.

### Tests

```bash
bunx vitest run src/components/testbed/conductor/__tests__/ConductorTestbed.chat-swap.contract.test.ts
bunx vitest run src/components/testbed/conductor/__tests__/chat-v2-hardcut.test.ts
bunx vitest run src/components/testbed/conductor/__tests__/RvnHarnessChatSurface.contract.test.tsx
```

### Rollback point

- **RP-03**: `swap-s03-mounted-surface-cutover`

---

## Slice-04 — Swap-path regression parity

**Depends on:** Slice-03  
**Goal:** move behavior regression confidence from legacy component tests to mounted RVN swap path tests.

### Files (exact)

- **Create** `src/components/testbed/conductor/__tests__/RvnHarnessChatSurface.regression.test.tsx`
- **Edit** `src/components/testbed/conductor/__tests__/ConductorAgentChat.regression.test.tsx`
- **Edit** `src/components/testbed/conductor/__tests__/RvnConductorChat.contract.test.tsx`

### Work

1. Port critical behavior checks (escape precedence, reconnect focus, slash insertion, mode controls, inline task row render) to RVN harness swap-path regression test.
2. Keep legacy `ConductorAgentChat.regression` as legacy-only smoke (or mark skipped with rationale) so future failures point to mounted path first.
3. Maintain explicit a11y roles for textbox/listbox/button controls.

### Tests

```bash
bunx vitest run src/components/testbed/conductor/__tests__/RvnHarnessChatSurface.regression.test.tsx
bunx vitest run src/components/testbed/conductor/__tests__/RvnConductorChat.contract.test.tsx
bunx vitest run src/components/testbed/conductor/__tests__/chat-v2-hardcut.test.ts
```

### Rollback point

- **RP-04**: `swap-s04-regression-parity`

---

## Slice-05 — Boundary audit + closure checks

**Depends on:** Slice-04  
**Goal:** close swap with explicit proof of constraints.

### Files (exact)

- **Edit** `thoughts/shared/plans/conductor-chat-rvn-acceptance-checklist-v1.md`
- **Create** `thoughts/shared/plans/conductor-rvn-harness-chat-swap-execution-note-v1.md`

### Work

1. Record gate outcomes G1–G6 with exact test command output references.
2. Record boundary audit confirming no edits to `src/lib/harness/**`.
3. Record rollback references RP-01..RP-04 and final merge recommendation.

### Tests

```bash
bunx vitest run src/components/testbed/conductor/__tests__/ConductorTestbed.chat-swap.contract.test.ts
bunx vitest run src/components/testbed/conductor/__tests__/RvnHarnessChatSurface.regression.test.tsx
bunx vitest run src/components/testbed/conductor/__tests__/chat-v2-hardcut.test.ts
```

### Rollback point

- **RP-05**: `swap-s05-closure-evidence`

---

## Explicit Non-Edit Boundary (swap lane)

The following are **out of scope for edits** during this swap:

- `src/lib/harness/**`
- `src/components/testbed/conductor/agent-chat-stx.ts`

If a slice appears to require edits there, stop and open a separate boundary-change RFC.

---

## Commit Slicing Plan

1. `swap-s01-contract-seam`
2. `swap-s02-rvn-harness-surface`
3. `swap-s03-mounted-surface-cutover`
4. `swap-s04-regression-parity`
5. `swap-s05-closure-evidence`

Each commit must be independently green on its slice test set.

---

## Ready-to-execute Checklist

- [ ] G1 defined and test harness created
- [ ] G2 boundary diff check scripted in execution notes
- [ ] Slices 01–05 queued in dependency order
- [ ] Rollback points RP-01..RP-05 captured during execution
- [ ] Final mounted surface confirmed RVN-only (no `ConductorAgentChat` mount)
