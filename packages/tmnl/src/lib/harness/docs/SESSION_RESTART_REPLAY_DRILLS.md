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
```

Optional: operator-managed server restart mode

```bash
SESSION_DRILL_MANAGE_SERVER=0 bash scripts/spikes/session-restart-replay-smoke.sh
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

## Evidence Capture Table (fill per run)

| Run Timestamp | Operator | Git SHA | Command | Artifact Directory | Key Checks | Result | Notes |
|---|---|---|---|---|---|---|---|
| 2026-02-25T00:00:00Z | `<name>` | `<sha>` | `bash scripts/spikes/session-restart-replay-smoke.sh` | `artifacts/session-restart-replay/<stamp>` | `R1..R7` | PASS/FAIL | `link to incident / issue` |

### Required Evidence Files

- `baseline.json` — pre-restart session baseline (`sessionId`, `headSeq`, signature)
- `result.json` — pass/fail evaluation for checks `R1..R7`
- `checkpoints.log` — timeline markers
- `harness-remote-ws.log` — server-side startup/runtime logs

---

## Recovery Escalation Rules

Escalate immediately if any of these are true:

- Restart causes missing history (`R1/R2/R3` failure)
- Duplicate replay appears at head (`R4/R7` failure)
- Race mints split sessions (`R5/R6` failure)

Recovery default posture:

1. contain (disable risky reconnect/open path),
2. preserve evidence,
3. rollback to known-safe serialized resume flow,
4. retest until two consecutive PASS runs are captured.
