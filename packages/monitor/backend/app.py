"""getbymonitor local RCA API.

Dev-only Flask service for the bespoke RCA scripts in /tmp. It adapts the actual
SQLite shape produced by /tmp/perf_rca_graph_tools.py and /tmp/getbymonitor_watchdog.py
instead of inventing a generic monitor schema.

Workflow harness (/api/workflow/*): frontend-facing routes for Mastra / AG-UI /
CopilotKit consumers.  Response shapes:

  WorkflowRun   { id, session_id, prompt, workflow, status,
                  created_at, finished_at, error, result, events[] }
  WorkflowEvent { id, run_id, type, timestamp, payload }

Persists run + event records in HARNESS_DB (default /tmp/monitor_harness.sqlite),
fully independent from RCA_DB.  /api/harness/* paths are kept as internal aliases.

If MASTRA_URL is unset, POST /api/workflow/runs records the run with
status="disabled" and a clear explanation — no fake success, no stub.
"""

from __future__ import annotations

import json
import os
import sqlite3
import time
import urllib.error
import urllib.request
import uuid
from typing import Any

import networkx as nx
from flask import Flask, Response, g, jsonify, request

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

RCA_DB = os.environ.get("RCA_DB", "/tmp/perf_rca_getbyzenbook.sqlite")
RCA_JSON = os.environ.get("RCA_JSON", "/tmp/perf_rca_getbyzenbook.json")
# Separate harness DB so it never contends with / corrupts RCA data.
HARNESS_DB = os.environ.get("HARNESS_DB", "/tmp/monitor_harness.sqlite")
HOST = os.environ.get("MONITOR_HOST", "127.0.0.1")
PORT = int(os.environ.get("MONITOR_PORT", "8765"))
# Remote Mastra endpoint (e.g. http://localhost:4111).  Absent → disabled.
MASTRA_URL = os.environ.get("MASTRA_URL", "").rstrip("/")
# AG-UI / CopilotKit thread prefix forwarded to Mastra.
AGUI_THREAD_PREFIX = os.environ.get("AGUI_THREAD_PREFIX", "monitor-")

_TERMINAL_STATUSES = frozenset({"completed", "error", "disabled"})

app = Flask(__name__)

# ---------------------------------------------------------------------------
# RCA DB helpers
# ---------------------------------------------------------------------------

def db() -> sqlite3.Connection:
    conn = g.get("db")
    if conn is None:
        conn = sqlite3.connect(RCA_DB, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        g.db = conn
    return conn


@app.teardown_appcontext
def close_db(_exc: Any) -> None:
    for key in ("db", "harness_db"):
        conn = g.pop(key, None)
        if conn is not None:
            conn.close()


@app.after_request
def cors(response: Response) -> Response:
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response


def rows(sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    return [dict(row) for row in db().execute(sql, params).fetchall()]


def one(sql: str, params: tuple[Any, ...] = (), default: Any = None) -> Any:
    row = db().execute(sql, params).fetchone()
    return row[0] if row is not None else default


def table(name: str) -> bool:
    return bool(one("select count(*) from sqlite_master where type='table' and name=?", (name,), 0))


def decode(value: Any, fallback: Any) -> Any:
    if value is None:
        return fallback
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return fallback


def require_db() -> None:
    if not os.path.exists(RCA_DB):
        raise FileNotFoundError(RCA_DB)


def session_id() -> str | None:
    return request.args.get("session_id") or None


def actual_nodes(sid: str | None = None) -> list[dict[str, Any]]:
    require_db()
    if not table("nodes"):
        return []
    if sid:
        data = rows("select * from nodes where session_id=? order by id", (sid,))
    else:
        data = rows("select * from nodes order by id")
    for n in data:
        n["data"] = decode(n.pop("data_json", None), {})
        n["confidence"] = float(n.get("confidence") or 0)
    return data


def actual_edges(sid: str | None = None) -> list[dict[str, Any]]:
    require_db()
    if not table("edges"):
        return []
    if sid:
        data = rows("select * from edges where session_id=? order by id", (sid,))
    else:
        data = rows("select * from edges order by id")
    for e in data:
        e["data"] = decode(e.pop("data_json", None), {})
        e["confidence"] = float(e.get("confidence") or 0)
        e["source"] = e.get("src")
        e["target"] = e.get("dst")
    return data


def graph_payload(sid: str | None = None) -> dict[str, Any]:
    nodes = actual_nodes(sid)
    edges = actual_edges(sid)
    graph = nx.MultiDiGraph()
    for n in nodes:
        graph.add_node(n["id"], **n)
    for e in edges:
        graph.add_edge(e["src"], e["dst"], key=e["id"], **e)

    simple = nx.DiGraph()
    for n in nodes:
        simple.add_node(n["id"])
    for e in edges:
        simple.add_edge(e["src"], e["dst"], weight=max(float(e.get("confidence") or 0.01), 0.01))

    centrality: dict[str, float] = {}
    pagerank: dict[str, float] = {}
    if simple.number_of_nodes():
        try:
            centrality = nx.betweenness_centrality(simple, weight="weight")
        except Exception:
            centrality = {}
        try:
            pagerank = nx.pagerank(simple, weight="weight")
        except Exception:
            pagerank = {}

    for n in nodes:
        n["betweenness"] = centrality.get(n["id"], 0.0)
        n["pagerank"] = pagerank.get(n["id"], 0.0)
        n["in_degree"] = simple.in_degree(n["id"]) if n["id"] in simple else 0
        n["out_degree"] = simple.out_degree(n["id"]) if n["id"] in simple else 0

    metrics: dict[str, Any] = {"nodes": graph.number_of_nodes(), "edges": graph.number_of_edges()}
    if simple.number_of_nodes():
        metrics["density"] = nx.density(simple)
        metrics["weak_components"] = nx.number_weakly_connected_components(simple)
        if nx.is_directed_acyclic_graph(simple):
            metrics["topo_sort"] = list(nx.topological_sort(simple))[:200]

    return {
        "nodes": nodes,
        "edges": edges,
        "graph_metrics": metrics,
        "node_count": len(nodes),
        "edge_count": len(edges),
    }


# ---------------------------------------------------------------------------
# RCA data helpers – extracted so routes don't need test_request_context
# ---------------------------------------------------------------------------

def _evidence_data(sid: str | None, limit: int) -> dict[str, Any]:
    require_db()
    if not table("evidence"):
        return {"rows": [], "total": 0}
    if sid:
        data = rows(
            "select * from evidence where session_id=? order by created_at desc limit ?",
            (sid, limit),
        )
        total = one("select count(*) from evidence where session_id=?", (sid,), 0)
    else:
        data = rows("select * from evidence order by created_at desc limit ?", (limit,))
        total = one("select count(*) from evidence", default=0)
    for item in data:
        item["payload"] = decode(item.pop("payload_json", None), {})
    return {"rows": data, "total": total}


def _models_data(sid: str | None) -> dict[str, Any]:
    require_db()
    if not table("model_views"):
        return {"rows": [], "total": 0}
    if sid:
        data = rows(
            "select * from model_views where session_id=? order by created_at desc", (sid,)
        )
        total = one("select count(*) from model_views where session_id=?", (sid,), 0)
    else:
        data = rows("select * from model_views order by created_at desc")
        total = one("select count(*) from model_views", default=0)
    for item in data:
        item["content"] = decode(item.pop("content_json", None), {})
    return {"rows": data, "total": total}


def _questionnaires_data(sid: str | None) -> dict[str, Any]:
    require_db()
    if not table("questionnaires"):
        return {"rows": [], "total": 0}
    if sid:
        data = rows(
            "select * from questionnaires where session_id=? order by sequence", (sid,)
        )
        total = one("select count(*) from questionnaires where session_id=?", (sid,), 0)
    else:
        data = rows("select * from questionnaires order by sequence")
        total = one("select count(*) from questionnaires", default=0)
    for item in data:
        item["answer"] = decode(item.pop("answer_json", None), {})
        item["inference"] = decode(item.pop("inference_json", None), {})
    return {"rows": data, "total": total}


# ---------------------------------------------------------------------------
# Harness DB helpers
# ---------------------------------------------------------------------------

def harness_db() -> sqlite3.Connection:
    conn = g.get("harness_db")
    if conn is None:
        conn = sqlite3.connect(HARNESS_DB, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        _ensure_harness_tables(conn)
        g.harness_db = conn
    return conn


def _ensure_harness_tables(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS harness_runs (
            run_id        TEXT PRIMARY KEY,
            session_id    TEXT,
            prompt        TEXT NOT NULL,
            workflow      TEXT NOT NULL DEFAULT 'default',
            status        TEXT NOT NULL DEFAULT 'pending',
            result_json   TEXT,
            error         TEXT,
            mastra_run_id TEXT,
            finished_at   TEXT,
            created_at    TEXT NOT NULL,
            updated_at    TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS harness_events (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id      TEXT NOT NULL REFERENCES harness_runs(run_id),
            type        TEXT NOT NULL,
            data_json   TEXT,
            ts          REAL NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_harness_events_run ON harness_events(run_id, ts);
        """
    )
    # Idempotent migration: add finished_at if the table predates this column.
    try:
        conn.execute("ALTER TABLE harness_runs ADD COLUMN finished_at TEXT")
    except Exception:
        pass
    conn.commit()


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _append_event(
    hconn: sqlite3.Connection, run_id: str, etype: str, payload: dict[str, Any]
) -> None:
    hconn.execute(
        "INSERT INTO harness_events(run_id, type, data_json, ts) VALUES (?,?,?,?)",
        (run_id, etype, json.dumps(payload), time.time()),
    )


def _set_run_status(
    hconn: sqlite3.Connection,
    run_id: str,
    status: str,
    result: Any = None,
    error: str | None = None,
    mastra_run_id: str | None = None,
) -> None:
    finished_at = _now() if status in _TERMINAL_STATUSES else None
    hconn.execute(
        """UPDATE harness_runs
           SET status=?, result_json=?, error=?,
               mastra_run_id=COALESCE(?, mastra_run_id),
               finished_at=COALESCE(?, finished_at),
               updated_at=?
           WHERE run_id=?""",
        (
            status,
            json.dumps(result) if result is not None else None,
            error,
            mastra_run_id,
            finished_at,
            _now(),
            run_id,
        ),
    )


def _workflow_run_shape(row: sqlite3.Row) -> dict[str, Any]:
    """Produce the agreed WorkflowRun JSON shape from a harness_runs row."""
    rec = dict(row)
    return {
        "id": rec["run_id"],
        "session_id": rec.get("session_id"),
        "prompt": rec["prompt"],
        "workflow": rec.get("workflow", "default"),
        "status": rec["status"],
        "created_at": rec["created_at"],
        "finished_at": rec.get("finished_at"),
        "error": rec.get("error"),
        "result": decode(rec.get("result_json"), None),
        "mastra_run_id": rec.get("mastra_run_id"),
    }


def _workflow_events_shape(
    run_id: str, hconn: sqlite3.Connection, after_ts: float = 0.0
) -> list[dict[str, Any]]:
    """Return events as agreed WorkflowEvent JSON objects."""
    raw = hconn.execute(
        "SELECT id, run_id, type, data_json, ts FROM harness_events"
        " WHERE run_id=? AND ts>? ORDER BY ts",
        (run_id, after_ts),
    ).fetchall()
    return [
        {
            "id": r["id"],
            "run_id": r["run_id"],
            "type": r["type"],
            "timestamp": r["ts"],
            "payload": decode(r["data_json"], {}),
        }
        for r in raw
    ]


# ---------------------------------------------------------------------------
# Mastra remote client
# ---------------------------------------------------------------------------

_MASTRA_DISABLED_MSG = (
    "Mastra remote not configured. "
    "Set MASTRA_URL env var (e.g. MASTRA_URL=http://localhost:4111)."
)


def _call_mastra_workflow(workflow: str, payload: dict[str, Any]) -> dict[str, Any]:
    """POST to {MASTRA_URL}/api/workflows/{workflow}/run and return the parsed response.

    Raises RuntimeError so callers can record the failure on the run
    without Flask propagating an unhandled exception.
    """
    if not MASTRA_URL:
        raise RuntimeError(_MASTRA_DISABLED_MSG)
    url = f"{MASTRA_URL}/api/workflows/{workflow}/run"
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"Mastra HTTP {exc.code}: {raw}") from exc
    except OSError as exc:
        raise RuntimeError(f"Mastra connection error: {exc}") from exc


def _normalize_mastra_events(resp: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    """Translate a Mastra response into (type, payload) pairs for _append_event.

    Mastra returns { runId, status, result?, output?, steps?, error? }.
    Emits STEP_RESULT per step, then RUN_FINISHED or RUN_ERROR.
    Does NOT emit RUN_STARTED — _harness_create appends that before calling Mastra.
    """
    pairs: list[tuple[str, dict[str, Any]]] = []
    for step_name, step in (resp.get("steps") or {}).items():
        pairs.append((
            "STEP_RESULT",
            {"step": step_name, "status": step.get("status"), "output": step.get("output")},
        ))
    status = (resp.get("status") or "").lower()
    if status in ("completed", "success", "succeeded"):
        pairs.append(("RUN_FINISHED", {"result": resp.get("result") or resp.get("output")}))
    elif status == "failed":
        pairs.append(("RUN_ERROR", {"error": resp.get("error") or "Mastra workflow reported failure"}))
    return pairs


# ---------------------------------------------------------------------------
# RCA routes (unchanged external behavior)
# ---------------------------------------------------------------------------

@app.route("/api/health", methods=["GET", "OPTIONS"])
def health() -> Response:
    if request.method == "OPTIONS":
        return Response(status=204)
    ok = os.path.exists(RCA_DB)
    counts: dict[str, int] = {}
    if ok:
        for name in [
            "sessions", "nodes", "edges", "evidence",
            "questionnaires", "model_views", "script_runs", "samples",
        ]:
            counts[name] = one(f"select count(*) from {name}", default=0) if table(name) else 0
    return (
        jsonify({"status": "ok" if ok else "missing-db", "db": RCA_DB, "json": RCA_JSON, "counts": counts, "ts": time.time()}),
        200 if ok else 503,
    )


@app.route("/api/summary", methods=["GET", "OPTIONS"])
def summary() -> Response:
    if request.method == "OPTIONS":
        return Response(status=204)
    require_db()
    counts = {
        name: (one(f"select count(*) from {name}", default=0) if table(name) else 0)
        for name in ["sessions", "nodes", "edges", "evidence", "questionnaires", "model_views", "script_runs", "samples"]
    }
    latest_samples = (
        rows("select t, kind, payload_json from samples order by t desc limit 5")
        if table("samples") else []
    )
    for sample in latest_samples:
        sample["payload"] = decode(sample.pop("payload_json", None), {})
    latest_runs = (
        rows("select * from script_runs order by started_at desc limit 10")
        if table("script_runs") else []
    )
    for run in latest_runs:
        run["command"] = decode(run.pop("command_json", None), [])
        run["payload"] = decode(run.pop("payload_json", None), {})
    return jsonify({
        "counts": counts,
        "latest_samples": latest_samples,
        "latest_runs": latest_runs,
        "graph": graph_payload().get("graph_metrics", {}),
    })


@app.route("/api/sessions", methods=["GET"])
def sessions() -> Response:
    require_db()
    data = rows("select * from sessions order by created_at desc") if table("sessions") else []
    return jsonify(data)


@app.route("/api/graph", methods=["GET"])
def graph() -> Response:
    return jsonify(graph_payload(session_id()))


@app.route("/api/sessions/<sid>/graph", methods=["GET"])
def session_graph(sid: str) -> Response:
    return jsonify(graph_payload(sid))


@app.route("/api/evidence", methods=["GET"])
def evidence() -> Response:
    limit = min(int(request.args.get("limit", "500")), 5000)
    return jsonify(_evidence_data(session_id(), limit))


@app.route("/api/sessions/<sid>/evidence", methods=["GET"])
def session_evidence(sid: str) -> Response:
    limit = min(int(request.args.get("limit", "500")), 5000)
    return jsonify(_evidence_data(sid, limit))


@app.route("/api/models", methods=["GET"])
def models() -> Response:
    return jsonify(_models_data(session_id()))


@app.route("/api/sessions/<sid>/model_views", methods=["GET"])
def session_models(sid: str) -> Response:
    return jsonify(_models_data(sid))


@app.route("/api/questionnaires", methods=["GET"])
def questionnaires() -> Response:
    return jsonify(_questionnaires_data(session_id()))


@app.route("/api/sessions/<sid>/questionnaires", methods=["GET"])
def session_questionnaires(sid: str) -> Response:
    return jsonify(_questionnaires_data(sid))


@app.route("/api/runs", methods=["GET"])
def runs() -> Response:
    require_db()
    data = (
        rows("select * from script_runs order by started_at desc limit 200")
        if table("script_runs") else []
    )
    for item in data:
        item["command"] = decode(item.pop("command_json", None), [])
        item["payload"] = decode(item.pop("payload_json", None), {})
    return jsonify({"rows": data, "total": len(data)})


@app.route("/api/samples", methods=["GET"])
def samples() -> Response:
    require_db()
    limit = min(int(request.args.get("limit", "120")), 2000)
    data = (
        rows("select * from samples order by t desc limit ?", (limit,))
        if table("samples") else []
    )
    for item in data:
        item["payload"] = decode(item.pop("payload_json", None), {})
    return jsonify({"rows": data, "total": len(data)})


@app.route("/api/incident", methods=["POST", "OPTIONS"])
def incident() -> Response:
    if request.method == "OPTIONS":
        return Response(status=204)
    body = request.get_json(silent=True) or {}
    label = str(body.get("label") or body.get("title") or "manual incident")
    payload = body.get("payload") if isinstance(body.get("payload"), dict) else body
    eid = f"E-ui-incident-{int(time.time())}"
    sid = body.get("session_id") or one(
        "select session_id from sessions order by created_at desc limit 1",
        default="perf-rca-2026-07-08-getbyzenbook",
    )
    conn = db()
    conn.execute(
        "insert or replace into evidence(id, session_id, kind, summary, source, payload_json, created_at) values (?,?,?,?,?,?,?)",
        (eid, sid, "user-marker", label, "getbymonitor://ui", json.dumps(payload), _now()),
    )
    conn.commit()
    return jsonify({"id": eid, "session_id": sid, "label": label}), 201


# ---------------------------------------------------------------------------
# Workflow routes – frontend-facing  (/api/workflow/*)
# ---------------------------------------------------------------------------

@app.route("/api/workflow/runs", methods=["GET", "POST", "OPTIONS"])
def workflow_runs_collection() -> Response:
    """List (GET) or create (POST) workflow runs.

    POST body : { prompt, session_id?, workflow?, metadata? }
    Response  : WorkflowRun with embedded events[]
    """
    if request.method == "OPTIONS":
        return Response(status=204)
    if request.method == "POST":
        return _harness_create()
    return _harness_list()


@app.route("/api/workflow/runs/<run_id>", methods=["GET", "OPTIONS"])
def workflow_run_detail(run_id: str) -> Response:
    """WorkflowRun with embedded events[]."""
    if request.method == "OPTIONS":
        return Response(status=204)
    hconn = harness_db()
    row = hconn.execute("SELECT * FROM harness_runs WHERE run_id=?", (run_id,)).fetchone()
    if row is None:
        return jsonify({"error": f"run not found: {run_id}"}), 404
    rec = _workflow_run_shape(row)
    rec["events"] = _workflow_events_shape(run_id, hconn)
    return jsonify(rec)


@app.route("/api/sessions/<sid>/workflow/runs", methods=["GET", "OPTIONS"])
def session_workflow_runs(sid: str) -> Response:
    """All WorkflowRuns for a session (no embedded events – use detail route for those)."""
    if request.method == "OPTIONS":
        return Response(status=204)
    hconn = harness_db()
    limit = min(int(request.args.get("limit", "100")), 500)
    offset = int(request.args.get("offset", "0"))
    raw = hconn.execute(
        "SELECT * FROM harness_runs WHERE session_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?",
        (sid, limit, offset),
    ).fetchall()
    total: int = hconn.execute(
        "SELECT COUNT(*) FROM harness_runs WHERE session_id=?", (sid,)
    ).fetchone()[0]
    return jsonify({
        "runs": [_workflow_run_shape(r) for r in raw],
        "total": total,
    })


@app.route("/api/workflow/runs/<run_id>/events/stream", methods=["GET"])
def workflow_run_events_stream(run_id: str) -> Response:
    """SSE stream of WorkflowEvent frames for a run.

    Emits `data: <JSON>\\n\\n` per event, then `data: {"type":"DONE"}\\n\\n` once
    the run reaches a terminal status.  Uses its own SQLite connection so the
    generator can run outside Flask's request context teardown.

    For already-terminal runs (the common case with our sync Mastra call) the
    stream flushes all events and closes immediately.
    """
    hconn = harness_db()
    exists = hconn.execute(
        "SELECT 1 FROM harness_runs WHERE run_id=?", (run_id,)
    ).fetchone()
    if exists is None:
        return jsonify({"error": f"run not found: {run_id}"}), 404

    db_path = HARNESS_DB  # capture before generator closes over it

    def generate():
        conn = sqlite3.connect(db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        try:
            sent_ids: set[int] = set()
            for _ in range(120):  # max ~60 s polling window
                status_row = conn.execute(
                    "SELECT status FROM harness_runs WHERE run_id=?", (run_id,)
                ).fetchone()
                if status_row is None:
                    break
                evts = conn.execute(
                    "SELECT id, run_id, type, data_json, ts FROM harness_events"
                    " WHERE run_id=? ORDER BY ts",
                    (run_id,),
                ).fetchall()
                for evt in evts:
                    if evt["id"] not in sent_ids:
                        sent_ids.add(evt["id"])
                        frame = {
                            "id": evt["id"],
                            "run_id": evt["run_id"],
                            "type": evt["type"],
                            "timestamp": evt["ts"],
                            "payload": decode(evt["data_json"], {}),
                        }
                        yield f"data: {json.dumps(frame)}\n\n"
                if status_row["status"] in _TERMINAL_STATUSES:
                    yield f'data: {json.dumps({"type": "DONE", "run_id": run_id})}\n\n'
                    break
                time.sleep(0.5)
            else:
                yield f'data: {json.dumps({"type": "TIMEOUT", "run_id": run_id})}\n\n'
        finally:
            conn.close()

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# Harness internal routes (/api/harness/*) – aliases kept for back-compat
# ---------------------------------------------------------------------------

@app.route("/api/harness/status", methods=["GET"])
def harness_status() -> Response:
    """Configuration health for the harness seam (Mastra connectivity)."""
    mastra_ok = bool(MASTRA_URL)
    hconn = harness_db()
    run_count: int = hconn.execute("SELECT COUNT(*) FROM harness_runs").fetchone()[0]
    return jsonify({
        "harness_db": HARNESS_DB,
        "mastra_configured": mastra_ok,
        "mastra_url": MASTRA_URL or None,
        "mastra_disabled_reason": None if mastra_ok else _MASTRA_DISABLED_MSG,
        "run_count": run_count,
    })


@app.route("/api/harness/runs", methods=["GET", "POST", "OPTIONS"])
def harness_runs_collection() -> Response:
    if request.method == "OPTIONS":
        return Response(status=204)
    if request.method == "POST":
        return _harness_create()
    return _harness_list()


@app.route("/api/harness/runs/<run_id>", methods=["GET", "OPTIONS"])
def harness_run_detail(run_id: str) -> Response:
    if request.method == "OPTIONS":
        return Response(status=204)
    hconn = harness_db()
    row = hconn.execute("SELECT * FROM harness_runs WHERE run_id=?", (run_id,)).fetchone()
    if row is None:
        return jsonify({"error": f"run not found: {run_id}"}), 404
    rec = _workflow_run_shape(row)
    rec["events"] = _workflow_events_shape(run_id, hconn)
    return jsonify(rec)


@app.route("/api/harness/runs/<run_id>/events", methods=["GET", "OPTIONS"])
def harness_run_events(run_id: str) -> Response:
    """Polling-friendly events list.  Optional `after_ts` (float epoch)."""
    if request.method == "OPTIONS":
        return Response(status=204)
    hconn = harness_db()
    status_row = hconn.execute(
        "SELECT status FROM harness_runs WHERE run_id=?", (run_id,)
    ).fetchone()
    if status_row is None:
        return jsonify({"error": f"run not found: {run_id}"}), 404
    after_ts = float(request.args.get("after_ts", "0"))
    evts = _workflow_events_shape(run_id, hconn, after_ts)
    return jsonify({
        "run_id": run_id,
        "run_status": status_row["status"],
        "events": evts,
        "count": len(evts),
    })


# ---------------------------------------------------------------------------
# Shared harness create/list helpers (not routes)
# ---------------------------------------------------------------------------

def _harness_list() -> Response:
    hconn = harness_db()
    limit = min(int(request.args.get("limit", "100")), 500)
    offset = int(request.args.get("offset", "0"))
    status_filter = request.args.get("status")
    if status_filter:
        raw = hconn.execute(
            "SELECT * FROM harness_runs WHERE status=? ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (status_filter, limit, offset),
        ).fetchall()
        total: int = hconn.execute(
            "SELECT COUNT(*) FROM harness_runs WHERE status=?", (status_filter,)
        ).fetchone()[0]
    else:
        raw = hconn.execute(
            "SELECT * FROM harness_runs ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (limit, offset),
        ).fetchall()
        total = hconn.execute("SELECT COUNT(*) FROM harness_runs").fetchone()[0]
    return jsonify({"runs": [_workflow_run_shape(r) for r in raw], "total": total})


def _harness_create() -> Response:
    body = request.get_json(silent=True) or {}
    prompt = str(body.get("prompt") or "").strip()
    if not prompt:
        return jsonify({"error": "prompt is required"}), 400

    workflow = str(body.get("workflow") or "default")
    sid = str(body.get("session_id") or "").strip() or None
    metadata: dict[str, Any] = body.get("metadata") if isinstance(body.get("metadata"), dict) else {}

    run_id = f"hr-{int(time.time())}-{uuid.uuid4().hex[:8]}"
    created_at = _now()
    hconn = harness_db()

    # ── Mastra not configured: record as disabled immediately ───────────────
    if not MASTRA_URL:
        hconn.execute(
            """INSERT INTO harness_runs
               (run_id, session_id, prompt, workflow, status, error, finished_at, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (run_id, sid, prompt, workflow, "disabled", _MASTRA_DISABLED_MSG, created_at, created_at, created_at),
        )
        _append_event(hconn, run_id, "RUN_DISABLED", {"reason": _MASTRA_DISABLED_MSG})
        hconn.commit()
        rec = _workflow_run_shape(
            hconn.execute("SELECT * FROM harness_runs WHERE run_id=?", (run_id,)).fetchone()
        )
        rec["events"] = _workflow_events_shape(run_id, hconn)
        return jsonify(rec), 201

    # ── Mastra configured: insert as running, call synchronously ───────────
    hconn.execute(
        """INSERT INTO harness_runs
           (run_id, session_id, prompt, workflow, status, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?)""",
        (run_id, sid, prompt, workflow, "running", created_at, created_at),
    )
    _append_event(hconn, run_id, "RUN_STARTED", {
        "workflow": workflow,
        "session_id": sid,
        "thread_id": f"{AGUI_THREAD_PREFIX}{run_id}",
    })
    hconn.commit()

    mastra_payload = {
        "runId": run_id,
        "input": {"prompt": prompt, "session_id": sid, "metadata": metadata},
        "thread_id": f"{AGUI_THREAD_PREFIX}{run_id}",
    }

    try:
        mastra_resp = _call_mastra_workflow(workflow, mastra_payload)

        for etype, epayload in _normalize_mastra_events(mastra_resp):
            _append_event(hconn, run_id, etype, epayload)

        mastra_status = (mastra_resp.get("status") or "").lower()
        if mastra_status in ("completed", "success", "succeeded"):
            final_status = "completed"
            result: Any = mastra_resp.get("result") or mastra_resp.get("output")
            error_val: str | None = None
        elif mastra_status == "failed":
            final_status = "error"
            result = None
            error_val = str(mastra_resp.get("error") or "Mastra workflow reported failure")
        else:
            # Ambiguous status (e.g. async "running") — record as completed with raw resp
            final_status = "completed"
            result = mastra_resp.get("result") or mastra_resp.get("output") or mastra_resp
            error_val = None

        _set_run_status(
            hconn, run_id, final_status,
            result=result,
            error=error_val,
            mastra_run_id=str(mastra_resp.get("runId") or ""),
        )
        hconn.commit()

    except RuntimeError as exc:
        err_msg = str(exc)
        _append_event(hconn, run_id, "RUN_ERROR", {"error": err_msg})
        _set_run_status(hconn, run_id, "error", error=err_msg)
        hconn.commit()

    rec = _workflow_run_shape(
        hconn.execute("SELECT * FROM harness_runs WHERE run_id=?", (run_id,)).fetchone()
    )
    rec["events"] = _workflow_events_shape(run_id, hconn)
    return jsonify(rec), 201


# ---------------------------------------------------------------------------

if __name__ == "__main__":
    app.run(host=HOST, port=PORT, debug=False)
