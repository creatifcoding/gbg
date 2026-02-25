# Session Failure Matrix (Restart/Replay)

Date: 2026-02-25  
Scope: Harness chat-v2 session lifecycle under restart/reconnect/race pressure

## Usage

Use this matrix during incident triage and drill review. Pair with:

- `src/lib/harness/docs/SESSION_RESTART_REPLAY_DRILLS.md`
- `scripts/spikes/session-restart-replay-smoke.sh`

## Failure Matrix

| ID | Failure Mode | Typical Trigger | Detection Signal | Pass Criterion | Fail Criterion | Containment / Rollback | Evidence to Capture |
|---|---|---|---|---|---|---|---|
| F-01 | Session lost after WS/server restart | Server process restart during active node/session mapping | `remote:chat_v2_resume_session` fails or returns unknown session | Resume succeeds for original `sessionId` after restart | Resume fails or maps to different/empty session unexpectedly | Stop rollout; enforce manual reopen with explicit resync note; keep restart gate red | `result.json` (`R1/R2`), server log tail |
| F-02 | Replay is truncated (history incomplete) | Store/read regression, cursor mismatch, partial hydration | `headSeq` lower than baseline or fewer events than baseline | `headSeq`, event count, signature equal baseline (`R1/R2/R3`) | Any baseline mismatch on full resume | Freeze resume path; fallback to fresh session and incident escalation | `baseline.json`, `result.json`, signature diff |
| F-03 | Replay duplicates events | Incorrect `fromSeq` handling (`>=` vs `>`) or dedupe drift | Incremental replay from `headSeq` returns events | `fromSeq=headSeq` returns zero events (`R4`) | Non-zero incremental events at head | Disable incremental replay optimization; use full snapshot + strict client dedupe | `result.json` (`R4`/`R7`), reducer seq trace |
| F-04 | Reconnect/open race mints split sessions for same node | Concurrent reconnect handler + optimistic open path | Same `nodeId` has multiple sessions; open returns new `sessionId` | Race `open_session` resolves to existing session; one session for node (`R5/R6`) | New session id appears for same node or node has >1 session | Temporarily serialize reconnect path (`resume` must complete before `open`) | `result.json` (`R5/R6`), list_sessions payload |
| F-05 | Resume response races with stale client state and applies out-of-order | Parallel replay + stale local cursor write | Local state mutates with stale seq ordering or regression | Monotonic seq apply + no duplicate render mutation | Non-monotonic apply, duplicate visible messages | Gate client apply on active session + seq monotonic guard; block stale snapshot apply | client state diff, event seq timeline |
| F-06 | WS reconnect succeeds but replay request window times out | Transport recovers but command round-trip fails under load | Resume timeout with healthy socket connection | Resume command responds within drill timeout and returns snapshot | Timeout or repeated transient errors after reconnect | Backoff + bounded retry; if repeated, fallback to operator-driven resync and mark degraded mode | timeout traces, ws log, retry counters |
| F-07 | Recovery drill not reproducible | Non-canonical command usage or missing artifacts | Drill run cannot be audited from saved artifacts | All required artifacts present and linked in run table | Missing baseline/result/checkpoint/server logs | Re-run drill with canonical script; reject unverifiable PASS claims | artifact directory listing + evidence table row |

## Escalation Thresholds

Escalate to incident response if any single run shows:

- `F-01`, `F-02`, or `F-04` (high severity), or
- two consecutive failures for `F-03`, `F-05`, or `F-06`.

## Rollback Playbook (Operational)

1. **Contain**
   - Disable auto-open during reconnect paths.
   - Force serialized `resume -> verify -> allow send` flow.
2. **Stabilize**
   - Keep WS server on known-good release.
   - Avoid session migrations during active incident.
3. **Recover**
   - Run `bash scripts/spikes/session-restart-replay-smoke.sh` until two consecutive PASS runs.
4. **Exit Criteria**
   - PASS evidence attached for checks `R1..R7`.
   - Incident note includes root cause + prevention action.

## Evidence Capture Template

| Incident/Run ID | Matrix IDs | Operator | SHA | Artifact Dir | Recovery State | Notes |
|---|---|---|---|---|---|---|
| `<id>` | `F-01,F-04` | `<name>` | `<sha>` | `artifacts/session-restart-replay/<stamp>` | contained / recovering / resolved | `<summary>` |
