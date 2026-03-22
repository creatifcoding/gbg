#!/usr/bin/env bash
# Session restart/replay smoke drill (non-destructive)
#
# Validates three reliability invariants for harness WS session management:
#  1) Session survives harness WS server restart
#  2) Resume/get_snapshot returns complete history without duplication
#  3) Reconnect + resume + open_session race window does not create split sessions
#
# Artifacts are written under:
#   artifacts/session-restart-replay/<timestamp>/

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
ARTIFACT_DIR="${ROOT_DIR}/artifacts/session-restart-replay/${STAMP}"
mkdir -p "${ARTIFACT_DIR}"

WS_URL="${HARNESS_WS_URL:-ws://127.0.0.1:8787/api/harness/ws}"
ROLE="${SESSION_DRILL_ROLE:-general}"
NODE_ID="${SESSION_DRILL_NODE_ID:-restart-replay-${STAMP}}"
MANAGE_SERVER="${SESSION_DRILL_MANAGE_SERVER:-1}" # 1=start/stop server in this script; 0=operator manages restart manually
SERVER_PID=""
SERVER_LOG="${ARTIFACT_DIR}/harness-remote-ws.log"
BASELINE_JSON="${ARTIFACT_DIR}/baseline.json"
RESULT_JSON="${ARTIFACT_DIR}/result.json"
CHECKPOINT_LOG="${ARTIFACT_DIR}/checkpoints.log"

log() {
  printf '[session-restart-replay] %s\n' "$*"
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

  log "WS endpoint did not become reachable in time"
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
  wait_for_ws
}

restart_server() {
  if [[ "${MANAGE_SERVER}" == "1" ]]; then
    log "restarting managed harness server"
    if [[ -n "${SERVER_PID}" ]] && kill -0 "${SERVER_PID}" >/dev/null 2>&1; then
      kill "${SERVER_PID}" >/dev/null 2>&1 || true
      wait "${SERVER_PID}" 2>/dev/null || true
    fi
    SERVER_PID=""
    start_server
    return 0
  fi

  cat <<'TXT'

[manual checkpoint] restart the harness WS server now.
  Suggested command:
    bun run harness:remote-ws

After restart is complete and endpoint is up, press Enter to continue.
TXT
  read -r _
  wait_for_ws
}

run_client_phase() {
  local phase="$1"

  WS_URL="${WS_URL}" \
  ROLE="${ROLE}" \
  NODE_ID="${NODE_ID}" \
  BASELINE_JSON="${BASELINE_JSON}" \
  RESULT_JSON="${RESULT_JSON}" \
  PHASE="${phase}" \
  bun --eval '
    import fs from "node:fs";

    const WS_URL = process.env.WS_URL ?? "ws://127.0.0.1:8787/api/harness/ws";
    const ROLE = process.env.ROLE ?? "general";
    const NODE_ID = process.env.NODE_ID ?? `restart-replay-${Date.now()}`;
    const BASELINE_JSON = process.env.BASELINE_JSON;
    const RESULT_JSON = process.env.RESULT_JSON;
    const PHASE = process.env.PHASE;

    if (!BASELINE_JSON || !RESULT_JSON || !PHASE) {
      throw new Error("Missing BASELINE_JSON, RESULT_JSON, or PHASE");
    }

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

    const request = (ws, command, timeoutMs = 12000) => {
      const requestId = `drill-${Date.now()}-${Math.random().toString(16).slice(2)}`;

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
        ws.send(
          JSON.stringify({
            _tag: "remote:ws_request",
            requestId,
            command,
          }),
        );
      });
    };

    const eventSignature = (events) =>
      events
        .map((event) => `${typeof event.seq === "number" ? event.seq : "?"}:${event._tag ?? "unknown"}`)
        .join("|");

    if (PHASE === "baseline") {
      const ws = await connect();
      try {
        const opened = await request(ws, {
          _tag: "remote:chat_v2_open_session",
          nodeId: NODE_ID,
          role: ROLE,
        });

        const snapshot = await request(ws, {
          _tag: "remote:chat_v2_get_snapshot",
          sessionId: opened.sessionId,
        });

        const baseline = {
          capturedAt: new Date().toISOString(),
          wsUrl: WS_URL,
          nodeId: NODE_ID,
          role: ROLE,
          sessionId: opened.sessionId,
          headSeq: snapshot.headSeq,
          eventCount: Array.isArray(snapshot.events) ? snapshot.events.length : 0,
          eventSignature: eventSignature(Array.isArray(snapshot.events) ? snapshot.events : []),
        };

        fs.writeFileSync(BASELINE_JSON, JSON.stringify(baseline, null, 2));
        console.log(JSON.stringify({ phase: "baseline", baseline }, null, 2));
      } finally {
        ws.close();
      }
      process.exit(0);
    }

    if (PHASE === "replay") {
      const baseline = JSON.parse(fs.readFileSync(BASELINE_JSON, "utf8"));
      const ws = await connect();

      try {
        const resumedFull = await request(ws, {
          _tag: "remote:chat_v2_resume_session",
          sessionId: baseline.sessionId,
        });

        const resumedIncremental = await request(ws, {
          _tag: "remote:chat_v2_resume_session",
          sessionId: baseline.sessionId,
          fromSeq: baseline.headSeq,
        });

        const [raceResume, raceOpenSameNode] = await Promise.all([
          request(ws, {
            _tag: "remote:chat_v2_resume_session",
            sessionId: baseline.sessionId,
            fromSeq: baseline.headSeq,
          }),
          request(ws, {
            _tag: "remote:chat_v2_open_session",
            nodeId: baseline.nodeId,
            role: baseline.role,
          }),
        ]);

        const listSessions = await request(ws, {
          _tag: "remote:list_sessions",
        });

        const sameNodeSessions = Array.isArray(listSessions.sessions)
          ? listSessions.sessions.filter((session) => session.nodeId === baseline.nodeId)
          : [];

        const checks = [
          {
            id: "R1",
            description: "resume full history headSeq matches baseline",
            pass: resumedFull.headSeq === baseline.headSeq,
            observed: { expectedHeadSeq: baseline.headSeq, actualHeadSeq: resumedFull.headSeq },
          },
          {
            id: "R2",
            description: "resume full history event count matches baseline",
            pass: (Array.isArray(resumedFull.events) ? resumedFull.events.length : 0) === baseline.eventCount,
            observed: {
              expectedEventCount: baseline.eventCount,
              actualEventCount: Array.isArray(resumedFull.events) ? resumedFull.events.length : 0,
            },
          },
          {
            id: "R3",
            description: "resume full history signature matches baseline (no truncation/reordering)",
            pass: eventSignature(Array.isArray(resumedFull.events) ? resumedFull.events : []) === baseline.eventSignature,
            observed: {
              expectedSignature: baseline.eventSignature,
              actualSignature: eventSignature(Array.isArray(resumedFull.events) ? resumedFull.events : []),
            },
          },
          {
            id: "R4",
            description: "incremental resume from headSeq returns zero events (no duplication)",
            pass: (Array.isArray(resumedIncremental.events) ? resumedIncremental.events.length : 0) === 0,
            observed: {
              fromSeq: baseline.headSeq,
              incrementalEvents: Array.isArray(resumedIncremental.events) ? resumedIncremental.events.length : 0,
            },
          },
          {
            id: "R5",
            description: "race open_session for same node resolves to existing sessionId",
            pass: raceOpenSameNode.sessionId === baseline.sessionId,
            observed: {
              expectedSessionId: baseline.sessionId,
              raceOpenSessionId: raceOpenSameNode.sessionId,
            },
          },
          {
            id: "R6",
            description: "node has exactly one session after race window",
            pass: sameNodeSessions.length === 1,
            observed: {
              sameNodeSessionCount: sameNodeSessions.length,
              sameNodeSessionIds: sameNodeSessions.map((session) => session.sessionId),
            },
          },
          {
            id: "R7",
            description: "race resume from headSeq remains empty (no duplicate replay under race)",
            pass: (Array.isArray(raceResume.events) ? raceResume.events.length : 0) === 0,
            observed: {
              raceResumeEvents: Array.isArray(raceResume.events) ? raceResume.events.length : 0,
            },
          },
        ];

        const failed = checks.filter((check) => !check.pass);

        const result = {
          capturedAt: new Date().toISOString(),
          wsUrl: WS_URL,
          baseline,
          checks,
          pass: failed.length === 0,
          failedChecks: failed,
        };

        fs.writeFileSync(RESULT_JSON, JSON.stringify(result, null, 2));
        console.log(JSON.stringify({ phase: "replay", pass: result.pass, failedChecks: failed }, null, 2));

        if (!result.pass) {
          process.exit(1);
        }
      } finally {
        ws.close();
      }

      process.exit(0);
    }

    throw new Error(`Unsupported PHASE=${PHASE}`);
  '
}

log "artifacts: ${ARTIFACT_DIR}"
log "mode: MANAGE_SERVER=${MANAGE_SERVER}"
log "node: ${NODE_ID}"
log "role: ${ROLE}"

start_server

log "checkpoint 1/3: baseline capture"
run_client_phase "baseline"
printf '%s\n' "$(date --iso-8601=seconds) baseline captured" >>"${CHECKPOINT_LOG}"

log "checkpoint 2/3: server restart"
restart_server
printf '%s\n' "$(date --iso-8601=seconds) server restarted" >>"${CHECKPOINT_LOG}"

log "checkpoint 3/3: replay + race validation"
if run_client_phase "replay"; then
  printf '%s\n' "$(date --iso-8601=seconds) replay+races PASS" >>"${CHECKPOINT_LOG}"
  log "PASS: restart/replay smoke checks passed"
  log "evidence: ${RESULT_JSON}"
else
  printf '%s\n' "$(date --iso-8601=seconds) replay+races FAIL" >>"${CHECKPOINT_LOG}"
  log "FAIL: one or more replay checks failed"
  log "review evidence: ${RESULT_JSON} and ${SERVER_LOG}"
  exit 1
fi

cat <<TXT

Checklist complete.
Artifacts:
  - ${BASELINE_JSON}
  - ${RESULT_JSON}
  - ${CHECKPOINT_LOG}
  - ${SERVER_LOG}

Next step:
  Attach artifacts to src/lib/harness/docs/SESSION_RESTART_REPLAY_DRILLS.md evidence table.
TXT
