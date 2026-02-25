#!/usr/bin/env bash
# Dual-panel concurrent session stress drill (non-destructive)
#
# Validates harness chat-v2 behavior under concurrent panel-style operations:
#  1) Two concurrent sessions can interleave open/resume/send without split mapping
#  2) Cross-session events are suppressed at panel apply boundary (no contamination)
#  3) Replay application remains idempotent (duplicate replay is suppressed)
#
# Artifacts are written under:
#   artifacts/session-dual-panel-stress/<timestamp>/

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
ARTIFACT_DIR="${ROOT_DIR}/artifacts/session-dual-panel-stress/${STAMP}"
mkdir -p "${ARTIFACT_DIR}"

WS_URL="${HARNESS_WS_URL:-ws://127.0.0.1:8787/api/harness/ws}"
ROLE="${SESSION_DRILL_ROLE:-general}"
PANEL_A_NODE_ID="${SESSION_DUAL_PANEL_NODE_A:-dual-panel-a-${STAMP}}"
PANEL_B_NODE_ID="${SESSION_DUAL_PANEL_NODE_B:-dual-panel-b-${STAMP}}"
MANAGE_SERVER="${SESSION_DRILL_MANAGE_SERVER:-1}" # 1=start/stop server in this script; 0=operator-managed
SERVER_PID=""

RESULT_JSON="${ARTIFACT_DIR}/result.json"
EVIDENCE_MD="${ARTIFACT_DIR}/evidence.md"
EVENTS_NDJSON="${ARTIFACT_DIR}/events.ndjson"
CHECKPOINT_LOG="${ARTIFACT_DIR}/checkpoints.log"
SERVER_LOG="${ARTIFACT_DIR}/harness-remote-ws.log"

log() {
  printf '[session-dual-panel-stress] %s\n' "$*"
}

cleanup() {
  if [[ -n "${SERVER_PID}" ]] && kill -0 "${SERVER_PID}" >/dev/null 2>&1; then
    log "stopping managed harness server pid=${SERVER_PID}"
    kill "${SERVER_PID}" >/dev/null 2>&1 || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

wait_for_ws() {
  local attempts=30
  local sleep_s=1

  log "waiting for WS endpoint: ${WS_URL}"
  for ((i = 1; i <= attempts; i++)); do
    if WS_URL="${WS_URL}" bun --eval '
      const url = process.env.WS_URL;
      if (!url) process.exit(2);
      const ws = new WebSocket(url);
      const timeout = setTimeout(() => {
        ws.close();
        process.exit(3);
      }, 2000);
      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        process.exit(0);
      };
      ws.onerror = () => {
        clearTimeout(timeout);
        process.exit(4);
      };
    ' >/dev/null 2>&1; then
      log "WS endpoint is reachable"
      return 0
    fi
    sleep "${sleep_s}"
  done

  return 1
}

start_server() {
  if [[ "${MANAGE_SERVER}" != "1" ]]; then
    return 0
  fi

  log "starting managed harness server (bun run harness:remote-ws)"
  (
    cd "${ROOT_DIR}"
    bun run harness:remote-ws
  ) >"${SERVER_LOG}" 2>&1 &

  SERVER_PID="$!"
  log "managed harness server pid=${SERVER_PID}"
}

ensure_ws_or_fail() {
  if wait_for_ws; then
    return 0
  fi

  cat <<TXT

[session-dual-panel-stress] FAIL: harness WS endpoint unreachable.
  expected: ${WS_URL}
  mode: MANAGE_SERVER=${MANAGE_SERVER}

If running operator-managed mode, start server first:
  bun run harness:remote-ws

Artifacts (partial):
  ${ARTIFACT_DIR}
TXT
  exit 2
}

run_stress_phase() {
  WS_URL="${WS_URL}" \
  ROLE="${ROLE}" \
  PANEL_A_NODE_ID="${PANEL_A_NODE_ID}" \
  PANEL_B_NODE_ID="${PANEL_B_NODE_ID}" \
  RESULT_JSON="${RESULT_JSON}" \
  EVIDENCE_MD="${EVIDENCE_MD}" \
  EVENTS_NDJSON="${EVENTS_NDJSON}" \
  bun --eval '
    import fs from "node:fs";

    const WS_URL = process.env.WS_URL ?? "ws://127.0.0.1:8787/api/harness/ws";
    const ROLE = process.env.ROLE ?? "general";
    const PANEL_A_NODE_ID = process.env.PANEL_A_NODE_ID ?? `dual-panel-a-${Date.now()}`;
    const PANEL_B_NODE_ID = process.env.PANEL_B_NODE_ID ?? `dual-panel-b-${Date.now()}`;
    const RESULT_JSON = process.env.RESULT_JSON;
    const EVIDENCE_MD = process.env.EVIDENCE_MD;
    const EVENTS_NDJSON = process.env.EVENTS_NDJSON;

    if (!RESULT_JSON || !EVIDENCE_MD || !EVENTS_NDJSON) {
      throw new Error("Missing RESULT_JSON, EVIDENCE_MD, or EVENTS_NDJSON");
    }

    const nowIso = () => new Date().toISOString();
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const makeRequestId = () => `dual-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const makeClientMessageId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

    const connect = async () => {
      const ws = new WebSocket(WS_URL);
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("ws connect timeout")), 5000);
        ws.onopen = () => {
          clearTimeout(timeout);
          resolve(undefined);
        };
        ws.onerror = (event) => {
          clearTimeout(timeout);
          reject(new Error(`ws open failed: ${String(event)}`));
        };
      });
      return ws;
    };

    const request = (ws, command, timeoutMs = 20000) => {
      const requestId = makeRequestId();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          ws.removeEventListener("message", onMessage);
          reject(new Error(`timeout waiting for ${command._tag}`));
        }, timeoutMs);

        const onMessage = (event) => {
          try {
            const parsed = JSON.parse(String(event.data));
            if (parsed?._tag !== "remote:ws_response" || parsed.requestId !== requestId) return;

            clearTimeout(timer);
            ws.removeEventListener("message", onMessage);

            if (!parsed.response?.ok) {
              reject(new Error(`${command._tag} failed: ${parsed.response?.message ?? "unknown"}`));
              return;
            }

            resolve(parsed.response.data ?? {});
          } catch (error) {
            clearTimeout(timer);
            ws.removeEventListener("message", onMessage);
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        };

        ws.addEventListener("message", onMessage);
        ws.send(JSON.stringify({
          _tag: "remote:ws_request",
          requestId,
          command,
        }));
      });
    };

    const eventLog = [];

    const panelState = {
      A: {
        activeSessionId: "",
        headSeq: undefined,
        seenSeqs: new Set(),
        applied: [],
        droppedCross: 0,
        droppedDuplicate: 0,
      },
      B: {
        activeSessionId: "",
        headSeq: undefined,
        seenSeqs: new Set(),
        applied: [],
        droppedCross: 0,
        droppedDuplicate: 0,
      },
    };

    const bindPanelSession = (panel, sessionId) => {
      panelState[panel].activeSessionId = sessionId;
    };

    const applyEvent = (panel, event) => {
      const state = panelState[panel];
      if (!state.activeSessionId) return false;

      if (event.sessionId !== state.activeSessionId) {
        state.droppedCross += 1;
        return false;
      }

      const seq = typeof event.seq === "number" ? event.seq : undefined;
      if (seq != null && state.seenSeqs.has(seq)) {
        state.droppedDuplicate += 1;
        return false;
      }

      if (seq != null) {
        state.seenSeqs.add(seq);
      }

      state.applied.push({
        sessionId: event.sessionId,
        seq: seq ?? null,
        _tag: event._tag ?? "unknown",
      });
      return true;
    };

    const applySnapshot = (panel, events) => {
      for (const event of events) {
        applyEvent(panel, event);
      }
    };

    const syncPanel = async (ws, panel) => {
      const state = panelState[panel];
      const command = {
        _tag: "remote:chat_v2_get_snapshot",
        sessionId: state.activeSessionId,
      };

      if (typeof state.headSeq === "number") {
        command.fromSeq = state.headSeq;
      }

      const snapshot = await request(ws, command);
      const events = Array.isArray(snapshot.events) ? snapshot.events : [];
      applySnapshot(panel, events);
      state.headSeq = snapshot.headSeq;
      return snapshot;
    };

    const extractSendAcceptedClientIds = (snapshot) =>
      (Array.isArray(snapshot.events) ? snapshot.events : [])
        .filter((event) => event?._tag === "chat:v2/send_accepted" && typeof event.clientMessageId === "string")
        .map((event) => event.clientMessageId);

    const validateSnapshotSeq = (snapshot) => {
      const events = Array.isArray(snapshot.events) ? snapshot.events : [];
      const seqs = events
        .map((event) => (typeof event.seq === "number" ? event.seq : null))
        .filter((seq) => seq != null);

      const unique = new Set(seqs).size === seqs.length;
      const monotonic = seqs.every((seq, idx) => idx === 0 || seq > seqs[idx - 1]);
      const terminalSeq = seqs.length === 0 ? 0 : seqs[seqs.length - 1];
      const headMatch = terminalSeq <= (snapshot.headSeq ?? terminalSeq);

      return { unique, monotonic, headMatch, seqCount: seqs.length, terminalSeq, headSeq: snapshot.headSeq };
    };

    const checks = [];

    const ws = await connect();

    ws.addEventListener("message", (message) => {
      try {
        const parsed = JSON.parse(String(message.data));
        if (parsed?._tag !== "remote:ws_event") return;

        const eventEnvelope = parsed.event;
        if (eventEnvelope?._tag !== "remote:chat_v2_event") return;

        const event = eventEnvelope.event;
        if (!event || typeof event !== "object") return;

        eventLog.push({ observedAt: nowIso(), event });

        applyEvent("A", event);
        applyEvent("B", event);
      } catch {
        // ignore malformed stream payloads in stress collector
      }
    });

    try {
      // Phase 1: Open two concurrent panel sessions
      const [openedA, openedB] = await Promise.all([
        request(ws, { _tag: "remote:chat_v2_open_session", nodeId: PANEL_A_NODE_ID, role: ROLE }),
        request(ws, { _tag: "remote:chat_v2_open_session", nodeId: PANEL_B_NODE_ID, role: ROLE }),
      ]);

      bindPanelSession("A", openedA.sessionId);
      bindPanelSession("B", openedB.sessionId);

      // Prime panel-state from snapshots so replay-idempotency checks are deterministic.
      await syncPanel(ws, "A");
      await syncPanel(ws, "B");

      // Phase 2: Interleave send operations across both panels
      const sent = { A: [], B: [] };
      const sendA1 = makeClientMessageId("dualA");
      const sendB1 = makeClientMessageId("dualB");
      sent.A.push(sendA1);
      sent.B.push(sendB1);

      await Promise.all([
        request(ws, {
          _tag: "remote:chat_v2_send",
          sessionId: openedA.sessionId,
          clientMessageId: sendA1,
          text: `dual-panel stress A1 ${sendA1}`,
        }),
        request(ws, {
          _tag: "remote:chat_v2_send",
          sessionId: openedB.sessionId,
          clientMessageId: sendB1,
          text: `dual-panel stress B1 ${sendB1}`,
        }),
      ]);

      await sleep(100);
      await syncPanel(ws, "A");
      await syncPanel(ws, "B");

      const preInterleaveHeadA = panelState.A.headSeq;
      const preInterleaveHeadB = panelState.B.headSeq;

      const sendA2 = makeClientMessageId("dualA");
      const sendB2 = makeClientMessageId("dualB");
      sent.A.push(sendA2);
      sent.B.push(sendB2);

      // Phase 3: true interleave window (resume/open/send in parallel)
      const interleaved = await Promise.all([
        request(ws, {
          _tag: "remote:chat_v2_resume_session",
          sessionId: openedA.sessionId,
          fromSeq: preInterleaveHeadA,
        }),
        request(ws, {
          _tag: "remote:chat_v2_open_session",
          nodeId: PANEL_A_NODE_ID,
          role: ROLE,
        }),
        request(ws, {
          _tag: "remote:chat_v2_send",
          sessionId: openedA.sessionId,
          clientMessageId: sendA2,
          text: `dual-panel stress A2 ${sendA2}`,
        }),
        request(ws, {
          _tag: "remote:chat_v2_resume_session",
          sessionId: openedB.sessionId,
          fromSeq: preInterleaveHeadB,
        }),
        request(ws, {
          _tag: "remote:chat_v2_open_session",
          nodeId: PANEL_B_NODE_ID,
          role: ROLE,
        }),
        request(ws, {
          _tag: "remote:chat_v2_send",
          sessionId: openedB.sessionId,
          clientMessageId: sendB2,
          text: `dual-panel stress B2 ${sendB2}`,
        }),
      ]);

      await sleep(150);
      await syncPanel(ws, "A");
      await syncPanel(ws, "B");

      const finalSnapshotA = await request(ws, {
        _tag: "remote:chat_v2_get_snapshot",
        sessionId: openedA.sessionId,
      });
      const finalSnapshotB = await request(ws, {
        _tag: "remote:chat_v2_get_snapshot",
        sessionId: openedB.sessionId,
      });

      const finalResumeFromHeadA = await request(ws, {
        _tag: "remote:chat_v2_resume_session",
        sessionId: openedA.sessionId,
        fromSeq: finalSnapshotA.headSeq,
      });
      const finalResumeFromHeadB = await request(ws, {
        _tag: "remote:chat_v2_resume_session",
        sessionId: openedB.sessionId,
        fromSeq: finalSnapshotB.headSeq,
      });

      // Phase 4: Replay application idempotency simulation (stale-stream suppression)
      const fullResumeA = await request(ws, {
        _tag: "remote:chat_v2_resume_session",
        sessionId: openedA.sessionId,
      });
      const fullResumeB = await request(ws, {
        _tag: "remote:chat_v2_resume_session",
        sessionId: openedB.sessionId,
      });

      const beforeReplayA = {
        applied: panelState.A.applied.length,
        droppedDuplicate: panelState.A.droppedDuplicate,
      };
      const beforeReplayB = {
        applied: panelState.B.applied.length,
        droppedDuplicate: panelState.B.droppedDuplicate,
      };

      applySnapshot("A", Array.isArray(fullResumeA.events) ? fullResumeA.events : []);
      const afterReplayAFirst = {
        applied: panelState.A.applied.length,
        droppedDuplicate: panelState.A.droppedDuplicate,
      };
      applySnapshot("A", Array.isArray(fullResumeA.events) ? fullResumeA.events : []);
      const afterReplayASecond = {
        applied: panelState.A.applied.length,
        droppedDuplicate: panelState.A.droppedDuplicate,
      };

      applySnapshot("B", Array.isArray(fullResumeB.events) ? fullResumeB.events : []);
      const afterReplayBFirst = {
        applied: panelState.B.applied.length,
        droppedDuplicate: panelState.B.droppedDuplicate,
      };
      applySnapshot("B", Array.isArray(fullResumeB.events) ? fullResumeB.events : []);
      const afterReplayBSecond = {
        applied: panelState.B.applied.length,
        droppedDuplicate: panelState.B.droppedDuplicate,
      };

      const listed = await request(ws, { _tag: "remote:list_sessions" });
      const listedSessions = Array.isArray(listed.sessions) ? listed.sessions : [];
      const sessionsForNodeA = listedSessions.filter((session) => session.nodeId === PANEL_A_NODE_ID);
      const sessionsForNodeB = listedSessions.filter((session) => session.nodeId === PANEL_B_NODE_ID);

      const snapshotAIds = extractSendAcceptedClientIds(finalSnapshotA);
      const snapshotBIds = extractSendAcceptedClientIds(finalSnapshotB);

      const seqA = validateSnapshotSeq(finalSnapshotA);
      const seqB = validateSnapshotSeq(finalSnapshotB);

      checks.push(
        {
          id: "DP1",
          description: "open_session for panel A remains idempotent during interleave",
          pass: interleaved[1]?.sessionId === openedA.sessionId,
          observed: {
            expectedSessionId: openedA.sessionId,
            actualSessionId: interleaved[1]?.sessionId,
          },
        },
        {
          id: "DP2",
          description: "open_session for panel B remains idempotent during interleave",
          pass: interleaved[4]?.sessionId === openedB.sessionId,
          observed: {
            expectedSessionId: openedB.sessionId,
            actualSessionId: interleaved[4]?.sessionId,
          },
        },
        {
          id: "DP3",
          description: "incremental resume at final head returns zero events for panel A",
          pass: (Array.isArray(finalResumeFromHeadA.events) ? finalResumeFromHeadA.events.length : 0) === 0,
          observed: {
            fromSeq: finalSnapshotA.headSeq,
            eventCount: Array.isArray(finalResumeFromHeadA.events) ? finalResumeFromHeadA.events.length : 0,
          },
        },
        {
          id: "DP4",
          description: "incremental resume at final head returns zero events for panel B",
          pass: (Array.isArray(finalResumeFromHeadB.events) ? finalResumeFromHeadB.events.length : 0) === 0,
          observed: {
            fromSeq: finalSnapshotB.headSeq,
            eventCount: Array.isArray(finalResumeFromHeadB.events) ? finalResumeFromHeadB.events.length : 0,
          },
        },
        {
          id: "DP5",
          description: "panel A snapshot has only panel-A client message IDs",
          pass:
            sent.A.every((id) => snapshotAIds.includes(id))
            && snapshotAIds.every((id) => !id.startsWith("dualB-")),
          observed: {
            expectedPanelAIds: sent.A,
            observedSendAcceptedIds: snapshotAIds,
          },
        },
        {
          id: "DP6",
          description: "panel B snapshot has only panel-B client message IDs",
          pass:
            sent.B.every((id) => snapshotBIds.includes(id))
            && snapshotBIds.every((id) => !id.startsWith("dualA-")),
          observed: {
            expectedPanelBIds: sent.B,
            observedSendAcceptedIds: snapshotBIds,
          },
        },
        {
          id: "DP7",
          description: "panel A apply path suppresses cross-session and duplicate replay events",
          pass:
            panelState.A.applied.every((event) => event.sessionId === openedA.sessionId)
            && panelState.A.droppedCross > 0
            && afterReplayASecond.applied === afterReplayAFirst.applied
            && afterReplayASecond.droppedDuplicate > afterReplayAFirst.droppedDuplicate,
          observed: {
            appliedCount: panelState.A.applied.length,
            droppedCross: panelState.A.droppedCross,
            droppedDuplicate: panelState.A.droppedDuplicate,
            replay: {
              before: beforeReplayA,
              afterFirst: afterReplayAFirst,
              afterSecond: afterReplayASecond,
            },
          },
        },
        {
          id: "DP8",
          description: "panel B apply path suppresses cross-session and duplicate replay events",
          pass:
            panelState.B.applied.every((event) => event.sessionId === openedB.sessionId)
            && panelState.B.droppedCross > 0
            && afterReplayBSecond.applied === afterReplayBFirst.applied
            && afterReplayBSecond.droppedDuplicate > afterReplayBFirst.droppedDuplicate,
          observed: {
            appliedCount: panelState.B.applied.length,
            droppedCross: panelState.B.droppedCross,
            droppedDuplicate: panelState.B.droppedDuplicate,
            replay: {
              before: beforeReplayB,
              afterFirst: afterReplayBFirst,
              afterSecond: afterReplayBSecond,
            },
          },
        },
        {
          id: "DP9",
          description: "session A snapshot sequence is unique + monotonic",
          pass: seqA.unique && seqA.monotonic && seqA.headMatch,
          observed: seqA,
        },
        {
          id: "DP10",
          description: "session B snapshot sequence is unique + monotonic",
          pass: seqB.unique && seqB.monotonic && seqB.headMatch,
          observed: seqB,
        },
        {
          id: "DP11",
          description: "node A maps to exactly one session after stress interleave",
          pass: sessionsForNodeA.length === 1,
          observed: {
            nodeId: PANEL_A_NODE_ID,
            sessionCount: sessionsForNodeA.length,
            sessions: sessionsForNodeA.map((session) => session.sessionId),
          },
        },
        {
          id: "DP12",
          description: "node B maps to exactly one session after stress interleave",
          pass: sessionsForNodeB.length === 1,
          observed: {
            nodeId: PANEL_B_NODE_ID,
            sessionCount: sessionsForNodeB.length,
            sessions: sessionsForNodeB.map((session) => session.sessionId),
          },
        },
      );

      const failedChecks = checks.filter((check) => !check.pass);
      const pass = failedChecks.length === 0;

      const result = {
        capturedAt: nowIso(),
        wsUrl: WS_URL,
        role: ROLE,
        nodes: {
          panelA: PANEL_A_NODE_ID,
          panelB: PANEL_B_NODE_ID,
        },
        sessions: {
          panelA: openedA.sessionId,
          panelB: openedB.sessionId,
        },
        sent,
        checks,
        pass,
        failedChecks,
        instrumentation: {
          panelA: {
            activeSessionId: panelState.A.activeSessionId,
            appliedCount: panelState.A.applied.length,
            droppedCross: panelState.A.droppedCross,
            droppedDuplicate: panelState.A.droppedDuplicate,
            headSeq: panelState.A.headSeq,
          },
          panelB: {
            activeSessionId: panelState.B.activeSessionId,
            appliedCount: panelState.B.applied.length,
            droppedCross: panelState.B.droppedCross,
            droppedDuplicate: panelState.B.droppedDuplicate,
            headSeq: panelState.B.headSeq,
          },
        },
      };

      fs.writeFileSync(RESULT_JSON, JSON.stringify(result, null, 2));
      fs.writeFileSync(EVENTS_NDJSON, `${eventLog.map((entry) => JSON.stringify(entry)).join("\n")}\n`);

      const lines = [];
      lines.push("# Session Dual-Panel Stress Evidence");
      lines.push("");
      lines.push(`- Captured: ${result.capturedAt}`);
      lines.push(`- WS URL: ${result.wsUrl}`);
      lines.push(`- Node A / Session A: ${PANEL_A_NODE_ID} / ${openedA.sessionId}`);
      lines.push(`- Node B / Session B: ${PANEL_B_NODE_ID} / ${openedB.sessionId}`);
      lines.push(`- Result: ${pass ? "PASS" : "FAIL"}`);
      lines.push("");
      lines.push("## Assertions");
      lines.push("");
      lines.push("| ID | Assertion | Result |");
      lines.push("|---|---|---|");
      for (const check of checks) {
        lines.push(`| ${check.id} | ${check.description} | ${check.pass ? "PASS" : "FAIL"} |`);
      }
      lines.push("");
      lines.push("## Stale-Stream Suppression Counters");
      lines.push("");
      lines.push(`- Panel A droppedCross: ${panelState.A.droppedCross}`);
      lines.push(`- Panel A droppedDuplicate: ${panelState.A.droppedDuplicate}`);
      lines.push(`- Panel B droppedCross: ${panelState.B.droppedCross}`);
      lines.push(`- Panel B droppedDuplicate: ${panelState.B.droppedDuplicate}`);
      lines.push("");
      lines.push("## Replay Idempotency Probe");
      lines.push("");
      lines.push(`- Panel A replay apply size: first=${afterReplayAFirst.applied}, second=${afterReplayASecond.applied}`);
      lines.push(`- Panel B replay apply size: first=${afterReplayBFirst.applied}, second=${afterReplayBSecond.applied}`);
      if (!pass) {
        lines.push("");
        lines.push("## Failed Checks");
        lines.push("");
        for (const failure of failedChecks) {
          lines.push(`- ${failure.id}: ${failure.description}`);
          lines.push(`  - observed: ${JSON.stringify(failure.observed)}`);
        }
      }

      fs.writeFileSync(EVIDENCE_MD, `${lines.join("\n")}\n`);

      console.log(JSON.stringify({
        phase: "dual-panel-stress",
        pass,
        failedChecks: failedChecks.map((check) => check.id),
        resultJson: RESULT_JSON,
        evidenceMd: EVIDENCE_MD,
      }, null, 2));

      if (!pass) {
        process.exit(1);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const failureResult = {
        capturedAt: nowIso(),
        wsUrl: WS_URL,
        role: ROLE,
        nodes: {
          panelA: PANEL_A_NODE_ID,
          panelB: PANEL_B_NODE_ID,
        },
        pass: false,
        checks,
        failedChecks: [
          {
            id: "DPX",
            description: "script execution completed without transport/runtime failure",
            pass: false,
            observed: { message: errorMessage },
          },
        ],
        error: {
          message: errorMessage,
        },
        instrumentation: {
          panelA: {
            activeSessionId: panelState.A.activeSessionId,
            appliedCount: panelState.A.applied.length,
            droppedCross: panelState.A.droppedCross,
            droppedDuplicate: panelState.A.droppedDuplicate,
            headSeq: panelState.A.headSeq,
          },
          panelB: {
            activeSessionId: panelState.B.activeSessionId,
            appliedCount: panelState.B.applied.length,
            droppedCross: panelState.B.droppedCross,
            droppedDuplicate: panelState.B.droppedDuplicate,
            headSeq: panelState.B.headSeq,
          },
        },
      };

      fs.writeFileSync(RESULT_JSON, JSON.stringify(failureResult, null, 2));
      fs.writeFileSync(EVENTS_NDJSON, `${eventLog.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
      fs.writeFileSync(
        EVIDENCE_MD,
        `# Session Dual-Panel Stress Evidence\n\n- Captured: ${failureResult.capturedAt}\n- Result: FAIL\n- Error: ${errorMessage}\n- WS URL: ${WS_URL}\n`,
      );

      console.error(JSON.stringify({
        phase: "dual-panel-stress",
        pass: false,
        error: errorMessage,
        resultJson: RESULT_JSON,
        evidenceMd: EVIDENCE_MD,
      }, null, 2));

      process.exit(1);
    } finally {
      ws.close();
    }
  '
}

log "artifacts: ${ARTIFACT_DIR}"
log "mode: MANAGE_SERVER=${MANAGE_SERVER}"
log "panel A node: ${PANEL_A_NODE_ID}"
log "panel B node: ${PANEL_B_NODE_ID}"

start_server
ensure_ws_or_fail

printf '%s\n' "$(date --iso-8601=seconds) start dual-panel stress" >>"${CHECKPOINT_LOG}"

if run_stress_phase; then
  printf '%s\n' "$(date --iso-8601=seconds) dual-panel stress PASS" >>"${CHECKPOINT_LOG}"
  log "PASS: dual-panel stress checks passed"
  log "evidence: ${RESULT_JSON}"
else
  printf '%s\n' "$(date --iso-8601=seconds) dual-panel stress FAIL" >>"${CHECKPOINT_LOG}"
  log "FAIL: one or more dual-panel checks failed"
  log "review evidence: ${RESULT_JSON}"
  if [[ -f "${SERVER_LOG}" ]]; then
    log "managed server log: ${SERVER_LOG}"
  fi
  exit 1
fi

cat <<TXT

Checklist complete.
Artifacts:
  - ${RESULT_JSON}
  - ${EVIDENCE_MD}
  - ${EVENTS_NDJSON}
  - ${CHECKPOINT_LOG}
  - ${SERVER_LOG} (if MANAGE_SERVER=1)

Do not commit artifact files.
TXT
