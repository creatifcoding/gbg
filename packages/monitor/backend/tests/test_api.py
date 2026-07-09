"""Backend API tests for packages/monitor.

Covers:
  - health: success (db present) and missing-db (503) shapes
  - harness status endpoint
  - harness runs: disabled path, remote-error path, CRUD lifecycle
  - event ordering invariants (timestamp monotone, type sequence)
  - pure helpers: decode, _now, _normalize_mastra_events, _ensure_harness_tables

Run from packages/monitor/backend/:
    .venv/bin/python -m pytest tests/test_api.py -v

Or from repo root:
    packages/monitor/backend/.venv/bin/python -m pytest \\
        packages/monitor/backend/tests/test_api.py -v

Key implementation notes (verified against live app.py):
  - _normalize_mastra_events returns list[tuple[str, dict]] not list[dict].
  - Endpoint responses use the WorkflowRun shape from _workflow_run_shape:
      top-level "id" (not "run_id"), plus session_id/prompt/workflow/status/
      created_at/finished_at/error/result/mastra_run_id.
  - Events (from _workflow_events_shape) have: id, run_id, type, timestamp (float epoch), payload.
  - Listing endpoint: {"runs": [...], "total": N}.
  - Events polling endpoint: {"run_id", "run_status", "events", "count"}.
"""
from __future__ import annotations

import os
import sqlite3
import sys
import time

import pytest

# Ensure packages/monitor/backend/ is importable regardless of cwd.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import app as app_module  # noqa: E402  (after path fixup)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def tmp_harness_db(tmp_path, monkeypatch):
    """Point HARNESS_DB at a fresh temp path; the app creates it on first use."""
    hdb = str(tmp_path / "harness.sqlite")
    monkeypatch.setattr(app_module, "HARNESS_DB", hdb)
    return hdb


@pytest.fixture()
def tmp_rca_db(tmp_path, monkeypatch):
    """Create a minimal RCA SQLite file and point RCA_DB at it."""
    db_path = str(tmp_path / "rca.sqlite")
    conn = sqlite3.connect(db_path)
    conn.executescript(
        """
        CREATE TABLE sessions (
            id TEXT PRIMARY KEY, name TEXT, status TEXT,
            created_at TEXT, updated_at TEXT, metadata TEXT
        );
        CREATE TABLE nodes (
            id TEXT PRIMARY KEY, session_id TEXT, label TEXT,
            node_type TEXT, data_json TEXT, confidence REAL, created_at TEXT
        );
        CREATE TABLE edges (
            id TEXT PRIMARY KEY, session_id TEXT,
            src TEXT, dst TEXT, data_json TEXT, confidence REAL
        );
        CREATE TABLE evidence (
            id TEXT PRIMARY KEY, session_id TEXT, kind TEXT, summary TEXT,
            source TEXT, payload_json TEXT, created_at TEXT
        );
        """
    )
    conn.commit()
    conn.close()
    monkeypatch.setattr(app_module, "RCA_DB", db_path)
    return db_path


@pytest.fixture()
def client(tmp_path, tmp_harness_db, monkeypatch):
    """Test client: no RCA DB, Mastra disabled."""
    monkeypatch.setattr(app_module, "RCA_DB", str(tmp_path / "nonexistent.sqlite"))
    monkeypatch.setattr(app_module, "MASTRA_URL", "")
    app_module.app.config["TESTING"] = True
    with app_module.app.test_client() as c:
        yield c


@pytest.fixture()
def client_with_rca(tmp_harness_db, tmp_rca_db, monkeypatch):
    """Test client: minimal RCA DB present, Mastra disabled."""
    monkeypatch.setattr(app_module, "MASTRA_URL", "")
    app_module.app.config["TESTING"] = True
    with app_module.app.test_client() as c:
        yield c


@pytest.fixture()
def client_mastra(tmp_path, tmp_harness_db, monkeypatch):
    """Test client: no RCA DB, Mastra URL pointing to a refused port."""
    monkeypatch.setattr(app_module, "RCA_DB", str(tmp_path / "nonexistent.sqlite"))
    monkeypatch.setattr(app_module, "MASTRA_URL", "http://127.0.0.1:19998")
    app_module.app.config["TESTING"] = True
    with app_module.app.test_client() as c:
        yield c


# ---------------------------------------------------------------------------
# Pure helpers  (no Flask context needed)
# ---------------------------------------------------------------------------


class TestPureHelpers:
    # ── _now ─────────────────────────────────────────────────────────────

    def test_now_utc_format(self):
        ts = app_module._now()
        assert isinstance(ts, str)
        assert ts.endswith("Z"), f"_now() must end with Z, got {ts!r}"
        assert "T" in ts
        assert len(ts) == 20  # YYYY-MM-DDTHH:MM:SSZ

    # ── decode ───────────────────────────────────────────────────────────

    def test_decode_none_returns_fallback(self):
        assert app_module.decode(None, "fb") == "fb"
        assert app_module.decode(None, []) == []

    def test_decode_dict_identity(self):
        d = {"k": 1}
        assert app_module.decode(d, {}) is d

    def test_decode_list_identity(self):
        lst = [1, 2, 3]
        assert app_module.decode(lst, []) is lst

    def test_decode_valid_json_string(self):
        assert app_module.decode('{"x": 1}', {}) == {"x": 1}
        assert app_module.decode("[true, false]", []) == [True, False]

    def test_decode_invalid_json_returns_fallback(self):
        assert app_module.decode("{broken", "fb") == "fb"
        assert app_module.decode("not-json", 99) == 99

    # ── _normalize_mastra_events ──────────────────────────────────────────
    # Returns list[tuple[str, dict]] — (event_type, payload_dict) pairs.

    def test_normalize_empty_dict_no_events(self):
        assert app_module._normalize_mastra_events({}) == []

    def test_normalize_completed_emits_run_finished(self):
        resp = {"status": "completed", "result": {"answer": "yes"}}
        pairs = app_module._normalize_mastra_events(resp)
        types = [p[0] for p in pairs]
        assert "RUN_FINISHED" in types
        finished_payload = next(p[1] for p in pairs if p[0] == "RUN_FINISHED")
        assert finished_payload["result"] == {"answer": "yes"}

    @pytest.mark.parametrize("status", ["success", "succeeded"])
    def test_normalize_success_aliases(self, status):
        pairs = app_module._normalize_mastra_events({"status": status})
        assert any(p[0] == "RUN_FINISHED" for p in pairs), (
            f"status={status!r} must produce RUN_FINISHED"
        )

    def test_normalize_failed_emits_run_error(self):
        resp = {"status": "failed", "error": "boom"}
        pairs = app_module._normalize_mastra_events(resp)
        err_pair = next((p for p in pairs if p[0] == "RUN_ERROR"), None)
        assert err_pair is not None
        assert err_pair[1]["error"] == "boom"

    def test_normalize_failed_no_run_finished(self):
        pairs = app_module._normalize_mastra_events({"status": "failed", "error": "x"})
        assert not any(p[0] == "RUN_FINISHED" for p in pairs)

    def test_normalize_with_steps_emits_step_results(self):
        resp = {
            "status": "completed",
            "result": {},
            "steps": {
                "step_a": {"status": "completed", "output": {"v": 1}},
                "step_b": {"status": "completed", "output": {"v": 2}},
            },
        }
        pairs = app_module._normalize_mastra_events(resp)
        step_pairs = [p for p in pairs if p[0] == "STEP_RESULT"]
        assert len(step_pairs) == 2
        assert {p[1]["step"] for p in step_pairs} == {"step_a", "step_b"}

    def test_normalize_steps_before_run_finished(self):
        resp = {
            "status": "completed",
            "result": {},
            "steps": {"s1": {"status": "done", "output": {}}},
        }
        pairs = app_module._normalize_mastra_events(resp)
        assert pairs[-1][0] == "RUN_FINISHED"

    def test_normalize_step_output_preserved(self):
        resp = {
            "status": "completed",
            "result": {},
            "steps": {"s1": {"status": "done", "output": {"key": "val"}}},
        }
        sr = next(p for p in app_module._normalize_mastra_events(resp)
                  if p[0] == "STEP_RESULT")
        assert sr[1]["output"] == {"key": "val"}

    # ── _ensure_harness_tables ────────────────────────────────────────────

    def test_ensure_creates_tables(self, tmp_path):
        conn = sqlite3.connect(str(tmp_path / "h.sqlite"))
        app_module._ensure_harness_tables(conn)
        tables = {r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()}
        assert "harness_runs" in tables
        assert "harness_events" in tables
        conn.close()

    def test_ensure_idempotent(self, tmp_path):
        conn = sqlite3.connect(str(tmp_path / "h2.sqlite"))
        app_module._ensure_harness_tables(conn)
        app_module._ensure_harness_tables(conn)  # must not raise
        conn.close()

    def test_ensure_harness_runs_columns(self, tmp_path):
        conn = sqlite3.connect(str(tmp_path / "h3.sqlite"))
        app_module._ensure_harness_tables(conn)
        cols = {r[1] for r in conn.execute("PRAGMA table_info(harness_runs)").fetchall()}
        required = {"run_id", "session_id", "prompt", "workflow", "status",
                    "error", "finished_at", "created_at", "updated_at"}
        assert required.issubset(cols), f"Missing columns: {required - cols}"
        conn.close()

    def test_ensure_harness_events_columns(self, tmp_path):
        conn = sqlite3.connect(str(tmp_path / "h4.sqlite"))
        app_module._ensure_harness_tables(conn)
        cols = {r[1] for r in conn.execute("PRAGMA table_info(harness_events)").fetchall()}
        assert {"id", "run_id", "type", "data_json", "ts"}.issubset(cols)
        conn.close()


# ---------------------------------------------------------------------------
# Health endpoint
# ---------------------------------------------------------------------------


class TestHealthEndpoint:
    def test_missing_db_503(self, client):
        assert client.get("/api/health").status_code == 503

    def test_missing_db_shape(self, client):
        data = client.get("/api/health").get_json()
        assert data["status"] == "missing-db"
        assert "db" in data
        assert "json" in data
        assert "counts" in data
        assert isinstance(data["ts"], float)
        assert data["counts"] == {}

    def test_present_db_200(self, client_with_rca):
        assert client_with_rca.get("/api/health").status_code == 200

    def test_present_db_shape(self, client_with_rca):
        data = client_with_rca.get("/api/health").get_json()
        assert data["status"] == "ok"
        assert isinstance(data["counts"], dict)

    def test_cors_header(self, client):
        r = client.get("/api/health")
        assert r.headers.get("Access-Control-Allow-Origin") == "*"

    def test_options_204(self, client):
        assert client.options("/api/health").status_code == 204


# ---------------------------------------------------------------------------
# Harness status endpoint
# ---------------------------------------------------------------------------


class TestHarnessStatus:
    def test_returns_200(self, client):
        assert client.get("/api/harness/status").status_code == 200

    def test_disabled_shape(self, client):
        data = client.get("/api/harness/status").get_json()
        assert data["mastra_configured"] is False
        assert data["mastra_url"] is None
        assert isinstance(data["harness_db"], str)
        assert isinstance(data["run_count"], int)
        assert data["mastra_disabled_reason"] is not None

    def test_run_count_zero_initially(self, client):
        assert client.get("/api/harness/status").get_json()["run_count"] == 0


# ---------------------------------------------------------------------------
# Harness runs — disabled path  (MASTRA_URL unset)
# ---------------------------------------------------------------------------

# Helpers for reading the WorkflowRun shape returned by the endpoint.
# Top-level id field is "id" (not "run_id"); listing uses {"runs": [...], "total": N}.


class TestHarnessRunsDisabled:
    def test_list_empty_on_fresh_db(self, client):
        data = client.get("/api/harness/runs").get_json()
        assert data["runs"] == []
        assert data["total"] == 0

    def test_create_missing_prompt_400(self, client):
        r = client.post("/api/harness/runs", json={})
        assert r.status_code == 400
        assert "error" in r.get_json()

    def test_create_blank_prompt_400(self, client):
        r = client.post("/api/harness/runs", json={"prompt": "   "})
        assert r.status_code == 400

    def test_create_returns_201(self, client):
        assert client.post("/api/harness/runs", json={"prompt": "hi"}).status_code == 201

    def test_create_disabled_shape(self, client):
        data = client.post("/api/harness/runs", json={"prompt": "hi"}).get_json()
        assert data["status"] == "disabled"
        # Response shape follows WorkflowRun: "id" at top level (not "run_id")
        assert data["id"].startswith("hr-")
        assert isinstance(data["events"], list)
        assert data["result"] is None
        assert isinstance(data["error"], str) and len(data["error"]) > 0

    def test_create_disabled_single_run_disabled_event(self, client):
        """Disabled path: exactly one event, type RUN_DISABLED."""
        events = client.post("/api/harness/runs", json={"prompt": "p"}).get_json()["events"]
        assert len(events) == 1
        assert events[0]["type"] == "RUN_DISABLED"

    def test_run_count_increments(self, client):
        client.post("/api/harness/runs", json={"prompt": "a"})
        client.post("/api/harness/runs", json={"prompt": "b"})
        assert client.get("/api/harness/status").get_json()["run_count"] == 2

    def test_list_after_create(self, client):
        client.post("/api/harness/runs", json={"prompt": "listed"})
        data = client.get("/api/harness/runs").get_json()
        assert data["total"] == 1
        assert data["runs"][0]["status"] == "disabled"

    def test_list_status_filter_disabled(self, client):
        client.post("/api/harness/runs", json={"prompt": "x"})
        assert client.get("/api/harness/runs?status=disabled").get_json()["total"] >= 1

    def test_list_status_filter_running_zero(self, client):
        client.post("/api/harness/runs", json={"prompt": "x"})
        assert client.get("/api/harness/runs?status=running").get_json()["total"] == 0

    def test_session_id_propagated(self, client):
        run_id = client.post(
            "/api/harness/runs", json={"prompt": "p", "session_id": "sess-42"}
        ).get_json()["id"]
        detail = client.get(f"/api/harness/runs/{run_id}").get_json()
        assert detail["session_id"] == "sess-42"


# ---------------------------------------------------------------------------
# Harness run detail + events endpoints
# ---------------------------------------------------------------------------


class TestHarnessRunDetail:
    def test_detail_not_found_404(self, client):
        r = client.get("/api/harness/runs/hr-does-not-exist")
        assert r.status_code == 404
        assert "error" in r.get_json()

    def test_events_not_found_404(self, client):
        assert client.get("/api/harness/runs/hr-does-not-exist/events").status_code == 404

    def test_detail_roundtrip(self, client):
        run_id = client.post(
            "/api/harness/runs", json={"prompt": "detail-test"}
        ).get_json()["id"]
        detail = client.get(f"/api/harness/runs/{run_id}").get_json()
        assert detail["id"] == run_id
        assert detail["prompt"] == "detail-test"
        assert isinstance(detail["events"], list)
        assert len(detail["events"]) >= 1

    def test_events_endpoint_shape(self, client):
        run_id = client.post("/api/harness/runs", json={"prompt": "ev"}).get_json()["id"]
        evts = client.get(f"/api/harness/runs/{run_id}/events").get_json()
        assert evts["run_id"] == run_id
        assert "run_status" in evts
        assert isinstance(evts["events"], list)
        assert evts["count"] == len(evts["events"])

    def test_events_after_future_ts_empty(self, client):
        run_id = client.post("/api/harness/runs", json={"prompt": "ts"}).get_json()["id"]
        future = time.time() + 99_999
        evts = client.get(f"/api/harness/runs/{run_id}/events?after_ts={future}").get_json()
        assert evts["events"] == []
        assert evts["count"] == 0

    def test_events_after_ts_zero_returns_all(self, client):
        run_id = client.post("/api/harness/runs", json={"prompt": "ts0"}).get_json()["id"]
        evts = client.get(f"/api/harness/runs/{run_id}/events?after_ts=0").get_json()
        assert evts["count"] >= 1

    def test_event_shape(self, client):
        """Each event in detail must have id, run_id, type, timestamp (float), payload."""
        run_id = client.post("/api/harness/runs", json={"prompt": "shape"}).get_json()["id"]
        events = client.get(f"/api/harness/runs/{run_id}").get_json()["events"]
        assert len(events) >= 1
        ev = events[0]
        assert "id" in ev
        assert ev["run_id"] == run_id
        assert isinstance(ev["type"], str)
        assert isinstance(ev["timestamp"], (int, float))
        assert "payload" in ev


# ---------------------------------------------------------------------------
# Event ordering invariants
# ---------------------------------------------------------------------------


class TestEventOrdering:
    def test_disabled_timestamp_monotonic(self, client):
        """timestamp fields in a disabled run's events must be non-decreasing."""
        run_id = client.post("/api/harness/runs", json={"prompt": "ord"}).get_json()["id"]
        ts_vals = [
            e["timestamp"]
            for e in client.get(f"/api/harness/runs/{run_id}/events").get_json()["events"]
        ]
        assert ts_vals == sorted(ts_vals)

    def test_multiple_runs_each_monotonic(self, client):
        for i in range(3):
            client.post("/api/harness/runs", json={"prompt": f"run-{i}"})
        for run in client.get("/api/harness/runs").get_json()["runs"]:
            ts_vals = [
                e["timestamp"]
                for e in client.get(
                    f"/api/harness/runs/{run['id']}/events"
                ).get_json()["events"]
            ]
            assert ts_vals == sorted(ts_vals), (
                f"Non-monotonic timestamps for {run['id']}: {ts_vals}"
            )


# ---------------------------------------------------------------------------
# Harness remote-error path  (Mastra URL set but connection refused)
# ---------------------------------------------------------------------------


class TestHarnessRunRemoteError:
    def test_returns_201(self, client_mastra):
        assert (
            client_mastra.post("/api/harness/runs", json={"prompt": "e"}).status_code == 201
        )

    def test_status_is_error(self, client_mastra):
        data = client_mastra.post("/api/harness/runs", json={"prompt": "e"}).get_json()
        assert data["status"] == "error"

    def test_body_shape(self, client_mastra):
        data = client_mastra.post("/api/harness/runs", json={"prompt": "e"}).get_json()
        assert data["id"].startswith("hr-")
        assert isinstance(data["error"], str) and len(data["error"]) > 0
        assert data["result"] is None
        assert isinstance(data["events"], list)

    def test_event_sequence_run_started_then_run_error(self, client_mastra):
        """Events: first must be RUN_STARTED, last must be RUN_ERROR."""
        events = client_mastra.post(
            "/api/harness/runs", json={"prompt": "seq"}
        ).get_json()["events"]
        types = [e["type"] for e in events]
        assert types[0] == "RUN_STARTED", f"Expected RUN_STARTED first; got {types}"
        assert types[-1] == "RUN_ERROR",  f"Expected RUN_ERROR last; got {types}"

    def test_timestamps_monotonic(self, client_mastra):
        """All event timestamps must be non-decreasing."""
        events = client_mastra.post(
            "/api/harness/runs", json={"prompt": "ts-chk"}
        ).get_json()["events"]
        ts_vals = [e["timestamp"] for e in events]
        assert ts_vals == sorted(ts_vals)

    def test_run_stored_in_listing(self, client_mastra):
        client_mastra.post("/api/harness/runs", json={"prompt": "stored"})
        listing = client_mastra.get("/api/harness/runs").get_json()
        assert listing["total"] >= 1
        assert any(r["status"] == "error" for r in listing["runs"])
