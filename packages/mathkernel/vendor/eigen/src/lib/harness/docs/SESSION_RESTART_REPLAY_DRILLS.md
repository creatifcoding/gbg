# Session Restart + Replay Drills

Date: 2026-02-25  
Scope: Harness remote WS session reliability (restart/replay)

## Purpose

Operationally validate that chat-v2 session continuity is stable across restart/reconnect paths, specifically:

1. sessions survive harness WS/server restart,
2. resume returns complete history without duplication,
3. reconnect/new-session/resume race windows do not split session state.

This drill is non-destructive (no delete/fork/mutation outside opening and replaying sessions).

## Canonical Command Surface

```bash
# from packages/tmnl
bun run harness:remote-ws
bunx tsc --noEmit
bash scripts/spikes/session-restart-replay-smoke.sh
bash scripts/spikes/session-dual-panel-stress.sh
```

Optional: operator-managed server mode

```bash
SESSION_DRILL_MANAGE_SERVER=0 bash scripts/spikes/session-restart-replay-smoke.sh
SESSION_DRILL_MANAGE_SERVER=0 bash scripts/spikes/session-dual-panel-stress.sh
```

## Preconditions

- Run from: `packages/tmnl`
- `bun`/`bunx` available
- Port `8787` available if script-managed server mode is used (`SESSION_DRILL_MANAGE_SERVER=1`, default)
- No destructive migration scripts running concurrently

---

## Drill D1 — Session survives WS/server restart

### Procedure

1. Run `bash scripts/spikes/session-restart-replay-smoke.sh`.
2. Script captures baseline snapshot (`baseline.json`) for a unique drill node/session.
3. Script restarts harness WS server.
4. Script issues `remote:chat_v2_resume_session` for the same `sessionId`.

### Pass criteria

- `resume full history headSeq matches baseline` (check `R1`) passes.
- `resume full history event count matches baseline` (check `R2`) passes.
- `result.json.pass === true`.

### Fail criteria

- Any of `R1`, `R2` fails.
- Resume request fails after restart.

### Rollback actions

1. Stop drill execution.
2. Keep artifacts (`baseline.json`, `result.json`, `harness-remote-ws.log`).
3. Run containment lane:
   - restart WS server cleanly,
   - block release/cutover for restart reliability,
   - open incident using failure matrix IDs `F-01` or `F-02`.

---

## Drill D2 — Resume returns complete history without duplication

### Procedure

1. Use same drill run from D1.
2. Compare baseline snapshot signature to resumed full snapshot signature.
3. Request incremental replay from `fromSeq=baseline.headSeq`.

### Pass criteria

- `R3` passes (full signature equality, no truncation/reordering).
- `R4` passes (incremental replay returns `0` events at head).

### Fail criteria

- Signature mismatch (`R3` false).
- Incremental replay returns events when `fromSeq=headSeq` (`R4` false).

### Rollback actions

1. Freeze restart/resume rollout.
2. Switch operator guidance to “open fresh session + explicit resync note” mode until fixed.
3. Capture failing signatures and sequence tails in incident notes.

---

## Drill D3 — Reconnect/new-session/resume race window

### Procedure

1. Script executes `Promise.all` race:
   - `remote:chat_v2_resume_session(sessionId, fromSeq=headSeq)`
   - `remote:chat_v2_open_session(nodeId=<same node>)`
2. Script reads `remote:list_sessions` and filters by `nodeId`.

### Pass criteria

- `R5` passes: race `open_session` resolves to existing `sessionId`.
- `R6` passes: exactly one session remains for node.
- `R7` passes: race resume from head remains empty (no duplicate replay).

### Fail criteria

- New session id minted for same node under race (`R5` false).
- Multiple sessions for node (`R6` false).
- Race resume replays duplicate events (`R7` false).

### Rollback actions

1. Disable auto-open-on-reconnect path; enforce serialized resume-before-open in client orchestration.
2. Mark race reliability gate failed in release checklist.
3. Preserve artifact bundle and assign to session mapping owner.

---

## Drill D4 — Dual-panel concurrent stress (cross-session + stale-stream suppression)

### Procedure

1. Run `bash scripts/spikes/session-dual-panel-stress.sh`.
2. Script opens two concurrent sessions (`panel A`, `panel B`) on unique node IDs.
3. Script interleaves in parallel:
   - `remote:chat_v2_open_session` (idempotency under race)
   - `remote:chat_v2_resume_session` (`fromSeq=head` probes)
   - `remote:chat_v2_send` (distinct clientMessageId prefixes per panel)
4. Script captures:
   - final snapshots for both sessions,
   - incremental replay-at-head checks,
   - replay re-application idempotency simulation,
   - stream instrumentation counters (`droppedCross`, `droppedDuplicate`).

### Pass criteria

- `DP1..DP2`: open-session remains idempotent for each panel under interleave.
- `DP3..DP4`: incremental replay at final head returns zero events for each panel.
- `DP5..DP6`: no clientMessageId contamination across panel snapshots.
- `DP7..DP8`: panel apply-path suppresses cross-session events and duplicate replay events.
- `DP9..DP10`: snapshot sequence is monotonic + unique.
- `DP11..DP12`: one session per node after stress window.

### Fail criteria

- Any `DP*` check fails.
- Missing evidence payload (`result.json`, `evidence.md`, `events.ndjson`).

### Rollback actions

1. Disable parallel reconnect/open orchestration for panelized clients.
2. Force serialized path: `resume -> verify sessionId/headSeq -> enable send`.
3. Preserve artifact bundle and map failure to matrix IDs (`F-03`, `F-04`, `F-05`, `F-08`).

### Stale-stream suppression invariants (explicit)

These are the invariants that must hold in adapter/runtime apply boundaries:

1. **Session gate first**: apply only if `event.sessionId === activeSessionId`.
2. **Monotonic dedupe**: do not apply if `seq` already seen for active session.
3. **Replay idempotency**: applying the same replay payload repeatedly must not mutate visible state after first application.
4. **Cross-session isolation**: panel A and panel B must never surface each other’s `clientMessageId` lineage.

`session-dual-panel-stress.sh` records counters/evidence for all four invariants.

---

## Evidence Capture Table (fill per run)

| Run Timestamp | Operator | Git SHA | Command | Artifact Directory | Key Checks | Result | Notes |
|---|---|---|---|---|---|---|---|
| 2026-02-25T00:00:00Z | `<name>` | `<sha>` | `bash scripts/spikes/session-restart-replay-smoke.sh` | `artifacts/session-restart-replay/<stamp>` | `R1..R7` | PASS/FAIL | `link to incident / issue` |
| 2026-02-25T00:00:00Z | `<name>` | `<sha>` | `bash scripts/spikes/session-dual-panel-stress.sh` | `artifacts/session-dual-panel-stress/<stamp>` | `DP1..DP12` | PASS/FAIL | `stale-stream suppression + contamination` |
| 2026-02-25T05:28:41-05:00 | forge | `b529eb3b` | `bash scripts/spikes/session-dual-panel-stress.sh` | `artifacts/session-dual-panel-stress/20260225-052841` | `DPX` | FAIL | `timeout waiting for remote:chat_v2_open_session; see result.json + harness-remote-ws.log` |
| 2026-02-25T05:36:40-05:00 | Val | `local-run` | `bash scripts/spikes/session-dual-panel-stress.sh` | `artifacts/session-dual-panel-stress/20260225-053640` | `DP1..DP12` | PASS | `post-fix run after HarnessSessionStoreError cause Option.none() patch` |
| 2026-02-25T05:40:46-05:00 | Val | `local-run` | `bash scripts/spikes/session-restart-replay-smoke.sh` | `artifacts/session-restart-replay/20260225-054046` | `R1..R7` | PASS | `resume hydration fallback validated after server restart` |

### Required Evidence Files

For restart/replay (`session-restart-replay-smoke.sh`):

- `baseline.json` — pre-restart session baseline (`sessionId`, `headSeq`, signature)
- `result.json` — pass/fail evaluation for checks `R1..R7`
- `checkpoints.log` — timeline markers
- `harness-remote-ws.log` — server-side startup/runtime logs

For dual-panel stress (`session-dual-panel-stress.sh`):

- `result.json` — pass/fail evaluation for checks `DP1..DP12`
- `evidence.md` — human-readable assertion table and stale-stream counters
- `events.ndjson` — raw observed `remote:chat_v2_event` stream evidence
- `checkpoints.log` — timeline markers
- `harness-remote-ws.log` — server-side startup/runtime logs (managed mode)

---

## Recovery Escalation Rules

Escalate immediately if any of these are true:

- Restart causes missing history (`R1/R2/R3` failure)
- Duplicate replay appears at head (`R4/R7` or `DP3/DP4/DP7/DP8` failure)
- Race mints split sessions (`R5/R6` or `DP11/DP12` failure)
- Cross-session contamination observed (`DP5/DP6/DP7/DP8` failure)

Recovery default posture:

1. contain (disable risky reconnect/open path),
2. preserve evidence,
3. rollback to known-safe serialized resume flow,
4. retest until two consecutive PASS runs are captured.
