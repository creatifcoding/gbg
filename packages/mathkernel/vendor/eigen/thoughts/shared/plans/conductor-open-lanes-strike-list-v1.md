# Conductor Open Lanes — Strike List v1 (Do-This-Next)

Owner: Val  
Date: 2026-02-11  
Scope: Remaining open lanes for governed Conductor Chat UX/runtime closure.

---

## 0) Operating Rule

- This file is the **single execution reference** for remaining open lanes.
- Every agent/PR/update must cite this file path:
  - `thoughts/shared/plans/conductor-open-lanes-strike-list-v1.md`
- Package runner discipline: **bun only**.

---

## 1) Critical Path (in order)

1. **P0 hard-cut tasks** `#726-#732`
2. **Governance unlock** `#754`
3. **Runtime checkpoint lane** `#773`, `#774`, `#775`
4. Final gate review on `#F208`

---

## 2) Task-by-Task Strike Plan (with command-level evidence)

## #726 — Remove old prompt timeout/poll runtime path

### Objective
Eliminate legacy poll/settle flow from Conductor chat send path.

### Execute
```bash
bunx tsc --noEmit -p tsconfig.json
bunx vitest run src/components/testbed/conductor/__tests__/chat-v2-hardcut.test.ts
```

### Evidence expectations
- Test green proving hard-cut invariants.
- No active usage of legacy settle/poll helpers in Conductor send flow.
- File references include:
  - `src/components/testbed/ConductorTestbed.tsx`
  - `src/components/testbed/conductor/ConductorAgentChatService.ts`
  - `src/components/testbed/conductor/__tests__/chat-v2-hardcut.test.ts`

---

## #727 — Finalize reconnect + resumeFromSeq + snapshot resync

### Objective
Reconnect must restore continuity from node-local last sequence without cross-node bleed.

### Execute
```bash
bunx tsc --noEmit -p tsconfig.json
bun run pi-orchestrator:chat-v2:reliability
```

### Evidence expectations
- Reliability suite passes.
- Replay/resume evidence present in report:
  - `/tmp/tmnl/pi-chat-v2-reliability-report.json`
- Node-local reconnect path and resync flow verified in chat surface.
- File references include:
  - `src/components/testbed/conductor/agent-chat-stx.ts`
  - `src/components/testbed/ConductorTestbed.tsx`

---

## #728 — Emit V2 lifecycle JSONL logs end-to-end

### Objective
Capture full lifecycle observability with correlation identifiers.

### Execute
```bash
bun run pi-orchestrator:remote-ws
# in a separate shell during activity:
rg -n "chat-v2\.session|chat-v2\.send|chat-v2\.snapshot|router\.command|ws\.inbound\.request" /tmp/tmnl -g "*.log" -g "*.jsonl" -g "*.txt"
```

### Evidence expectations
- JSONL includes chat-v2 lifecycle events and correlation context.
- Router + WS request/response coverage visible.
- Documented event map remains aligned with:
  - `src/lib/pi-orchestrator/NETWORK_SEQUENCE.md`

---

## #729 — Add reliability metrics

### Objective
Track and surface ack/delta/replay/reconnect health signals.

### Execute
```bash
bunx tsc --noEmit -p tsconfig.json
bun run pi-orchestrator:chat-v2:reliability
```

### Evidence expectations
- Metrics included in reliability report (`ackLatencyMs`, `firstDeltaLagMs`, `replayDepth`).
- Node-local reliability state bound into UI status rows.
- File references include:
  - `src/components/testbed/conductor/agent-chat-stx.ts`
  - `src/components/testbed/ConductorTestbed.tsx`
  - `scripts/pi-chat-v2-reliability-suite.ts`

---

## #730 — Run/automate 20-turn + reconnect replay suite

### Objective
Establish repeatable automated stability run.

### Execute
```bash
bun run pi-orchestrator:chat-v2:reliability
```

### Evidence expectations
- PASS output from suite.
- Report persisted at:
  - `/tmp/tmnl/pi-chat-v2-reliability-report.json`
- Includes replay checkpoints (not only happy-path send).

---

## #731 — Execute Tauri Conductor manual checklist

### Objective
Manual operator verification in real Conductor surface.

### Execute
```bash
bun run pi-orchestrator:remote-ws
bun run tauri:dev
```

### Evidence expectations
- Checklist completed and signed:
  - `src/lib/pi-orchestrator/TAURI_CONDUCTOR_MANUAL_CHECKLIST.md`
- Include PASS/FAIL + environment + notes.
- Must cover reconnect/replay and L3 UX regression subsection.

---

## #732 — Promote V2 as only active Conductor runtime path

### Objective
Conductor active path is stream-first V2; legacy path non-operational.

### Execute
```bash
bunx tsc --noEmit -p tsconfig.json
bunx vitest run src/components/testbed/conductor/__tests__/chat-v2-hardcut.test.ts src/lib/pi-orchestrator/__tests__/chat-v2-client.test.ts src/lib/pi-orchestrator/__tests__/remote-command-router.test.ts
```

### Evidence expectations
- Hard-cut tests pass.
- Client serialization + router command coverage pass.
- No active legacy runtime fallback in Conductor send path.

---

## #754 — Governance unlock task for runtime expansion scope

### Objective
Unlock runtime-expansion merge scope.

### Prerequisites
- `#726`, `#727`, `#728`, `#729`, `#730`, `#731`, `#732` complete with indexed evidence.

### Required evidence bundle (all present)
1. Automated reliability report (`/tmp/tmnl/pi-chat-v2-reliability-report.json`)
2. JSONL correlation artifacts proving lifecycle visibility
3. Metrics coverage proof (ack/delta/replay/reconnect)
4. Completed Tauri manual checklist with signoff
5. Hard-cut test proof that legacy polling path is non-active

---

## 3) Post-Unlock Runtime Checkpoint Lane

## #773 — Validate JSONL correlation + runtime metrics coverage

### Execute
```bash
bun run pi-orchestrator:remote-ws
bun run pi-orchestrator:chat-v2:reliability
```

### Evidence expectations
- Correlation join across ws/router/chat-v2 events.
- Metrics values populated and stable in report + UI surfacing.

---

## #774 — Validate reconnect/resume/replay under disruption

### Execute
```bash
bun run pi-orchestrator:chat-v2:reliability
# plus manual disruption in Tauri run (stop/restart backend mid-session)
```

### Evidence expectations
- Replay continuity after disruption.
- No cross-node state mutation.
- Deterministic recovery copy states (`reconnecting`/`resyncing`).

---

## #775 — PR checkpoint 05 (runtime integration ready)

### Gate to close
- #773 and #774 complete with evidence indexed.
- Governance lock policy satisfied.

---

## 4) Release-Hardening Lane (already progressed)

- #776 regression matrix ✅
- #777 handoff + runbook ✅
- #778 PR-06 checkpoint ✅

Reference artifacts:
- `thoughts/shared/plans/conductor-chat-regression-matrix-run-v1.md`
- `thoughts/shared/plans/conductor-chat-ux-implementation-handoff-v1.md`

---

## 5) Definition of Done for Open Lanes

Open lanes are done only when:
1. P0 tasks `#726-#732` are complete with evidence,
2. `#754` unlock is complete,
3. Runtime checkpoint tasks `#773-#775` are complete,
4. `#F208` manual gates are marked resolved with linked artifacts.
