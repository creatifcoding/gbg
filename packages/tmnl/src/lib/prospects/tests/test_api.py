#!/usr/bin/env python3
"""
Prospect Pipeline — HTTP API Integration Test

Exercises all endpoints against the live server on :3100.
Tests entity CRUD via POST + query endpoints via GET.

Usage:
    python3 src/lib/prospects/tests/test_api.py
"""

import json
import sys
import time
import requests
from uuid import uuid4

BASE = "http://localhost:3100"
PASS = 0
FAIL = 0

def test(name: str, fn):
    global PASS, FAIL
    try:
        fn()
        print(f"  ✅ {name}")
        PASS += 1
    except Exception as e:
        print(f"  ❌ {name}: {e}")
        FAIL += 1

def tag_to_path(tag: str) -> str:
    """Convert RPC tag to kebab-case URL path (matches EntityProxy.tagToPath)"""
    import re
    s = re.sub(r'[^a-zA-Z0-9]+', '-', tag)  # non-alnum → hyphen
    s = re.sub(r'([a-z])([A-Z])', r'\1-\2', s)  # camelCase split
    return s.lower()

def post_entity(domain: str, rpc: str, entity_id: str, payload: dict) -> dict:
    """POST /api/{domain}/{kebab-rpc}/:entityId"""
    kebab = tag_to_path(rpc)
    url = f"{BASE}/api/{domain}/{kebab}/{entity_id}"
    r = requests.post(url, json=payload, timeout=10)
    if r.status_code != 200:
        raise Exception(f"POST {url} → {r.status_code}: {r.text[:200]}")
    return r.json()

def get_query(path: str, params: dict = None) -> dict:
    """GET /api/queries/..."""
    url = f"{BASE}/api/{path}"
    r = requests.get(url, params=params, timeout=10)
    if r.status_code != 200:
        raise Exception(f"GET {url} → {r.status_code}: {r.text[:200]}")
    return r.json()


def main():
    print("\n🧪 Prospect Pipeline API — Integration Tests\n")
    print(f"   Server: {BASE}")
    print(f"   Time:   {time.strftime('%Y-%m-%d %H:%M:%S')}\n")

    # ─── Query Endpoints ─────────────────────────────────────────────
    print("📊 Query Endpoints")

    def test_pipeline_summary():
        data = get_query("queries/pipeline/summary")
        assert data["totalCompanies"] > 8000, f"Expected >8K companies, got {data['totalCompanies']}"
        assert data["totalSignals"] > 8000, f"Expected >8K signals, got {data['totalSignals']}"
        assert data["totalProvenance"] > 20000, f"Expected >20K provenance, got {data['totalProvenance']}"
        assert len(data["companiesByIndustry"]) > 10, "Expected >10 industries"
    test("Pipeline summary — counts match expanded dataset", test_pipeline_summary)

    def test_search():
        data = get_query("queries/companies/search", {"q": "conveyor"})
        assert len(data) > 0, "Expected conveyor companies"
        names = [c["name"] for c in data[:3]]
        assert any("conveyor" in n.lower() for n in names), f"No conveyor match in {names}"
    test("Company search — 'conveyor' returns results", test_search)

    def test_by_industry():
        data = get_query("queries/companies/by-industry", {"industry": "manufacturing"})
        assert len(data) > 100, f"Expected >100 manufacturing, got {len(data)}"
    test("Companies by industry — manufacturing has >100", test_by_industry)

    def test_count_by_source():
        data = get_query("queries/companies/count-by-source")
        sources = {r["source"]: r["count"] for r in data}
        assert "state_license" in sources, "Missing state_license source"
        assert sources["state_license"] > 5000, f"Expected >5K state_license, got {sources['state_license']}"
    test("Count by source — state_license dominant", test_count_by_source)

    def test_top_cip():
        data = get_query("queries/dms/top-cip", {"limit": "5"})
        assert len(data) == 5, f"Expected 5 DMs, got {len(data)}"
        assert data[0]["cipComposite"] >= data[-1]["cipComposite"], "Not sorted by CIP"
    test("Top CIP — returns 5 DMs sorted descending", test_top_cip)

    def test_recent_signals():
        data = get_query("queries/signals/recent", {"limit": "10"})
        assert len(data) == 10, f"Expected 10 signals, got {len(data)}"
    test("Recent signals — returns 10", test_recent_signals)

    # ─── Entity CRUD (via cluster RPCs) ──────────────────────────────
    print("\n🔧 Entity CRUD (Cluster RPCs)")

    uid = uuid4().hex[:8]
    co_id = f"pytest-co-{uid}"
    dm_id = f"pytest-dm-{uid}"
    sig_id = f"pytest-sig-{uid}"
    out_id = f"pytest-out-{uid}"
    prop_id = f"pytest-prop-{uid}"

    # Company
    def test_create_company():
        data = post_entity("companies", "Company.Create", co_id, {
            "id": co_id,
            "name": f"Python Test Corp {uid}",
            "industry": "manufacturing",
            "harvestSource": "manual",
            "size": "mid",
            "website": "https://pytest.example.com",
            "description": "Created from Python test client",
        })
        assert data["id"] == co_id
        assert data["pipelineStage"] == "harvested"
        assert data["slug"] == f"python-test-corp-{uid}"
    test("Company.Create — via POST to cluster", test_create_company)

    def test_get_company():
        data = post_entity("companies", "Company.Get", co_id, {"id": co_id})
        assert data["name"] == f"Python Test Corp {uid}"
    test("Company.Get — roundtrip", test_get_company)

    def test_update_stage():
        data = post_entity("companies", "Company.UpdateStage", co_id, {
            "id": co_id, "stage": "qualified"
        })
        assert data["pipelineStage"] == "qualified"
    test("Company.UpdateStage → qualified", test_update_stage)

    def test_enrich():
        data = post_entity("companies", "Company.Enrich", co_id, {
            "id": co_id,
            "field": "website",
            "value": "https://updated.example.com",
            "source": "manual",
            "confidence": 0.95,
        })
        assert data["website"] == "https://updated.example.com"
    test("Company.Enrich — website update with provenance", test_enrich)

    # Signal
    def test_create_signal():
        data = post_entity("signals", "Signal.Create", sig_id, {
            "id": sig_id,
            "companyId": co_id,
            "signalType": "job_posting",
            "title": "Hiring Python Developer",
            "weight": 2,
        })
        assert data["companyId"] == co_id
        assert data["weight"] == 2
    test("Signal.Create — linked to company", test_create_signal)

    # Decision Maker
    def test_create_dm():
        data = post_entity("dms", "DecisionMaker.Create", dm_id, {
            "id": dm_id,
            "name": "Test Director",
            "title": "Director of Engineering",
            "titleLevel": "director",
            "companyId": co_id,
        })
        assert data["titleLevel"] == "director"
        assert data["companyId"] == co_id
    test("DecisionMaker.Create — with title level", test_create_dm)

    # Outreach
    def test_create_outreach():
        data = post_entity("outreach", "Outreach.Create", out_id, {
            "id": out_id,
            "decisionMakerId": dm_id,
            "companyId": co_id,
            "channel": "email",
            "subject": "Python test outreach",
        })
        assert data["status"] == "drafted"
    test("Outreach.Create — email drafted", test_create_outreach)

    def test_mark_sent():
        data = post_entity("outreach", "Outreach.MarkSent", out_id, {"id": out_id})
        assert data["status"] == "sent"
        assert data["sentAt"] is not None
    test("Outreach.MarkSent — status transition", test_mark_sent)

    # Proposal
    def test_create_proposal():
        data = post_entity("proposals", "Proposal.Create", prop_id, {
            "id": prop_id,
            "companyId": co_id,
            "decisionMakerIds": [dm_id],
            "signalIds": [sig_id],
            "title": "Python Test Proposal",
        })
        assert data["status"] == "draft"
        assert data["version"] == 1
    test("Proposal.Create — with DM + signal links", test_create_proposal)

    # ─── Verify in queries ───────────────────────────────────────────
    print("\n📋 Cross-verification")

    def test_verify_search():
        data = get_query("queries/companies/search", {"q": f"Python Test Corp {uid}"})
        assert len(data) >= 1, f"Created company not found in search"
        assert data[0]["pipelineStage"] == "qualified", f"Stage should be qualified, got {data[0]['pipelineStage']}"
    test("Search finds company created via cluster RPC", test_verify_search)

    def test_verify_summary():
        data = get_query("queries/pipeline/summary")
        assert data["totalOutreach"] >= 1, "Outreach not reflected in summary"
        assert data["totalProposals"] >= 1, "Proposal not reflected in summary"
    test("Pipeline summary reflects new entities", test_verify_summary)

    # ─── Results ─────────────────────────────────────────────────────
    print(f"\n{'='*50}")
    print(f"  Results: {PASS} passed, {FAIL} failed")
    print(f"{'='*50}\n")

    if FAIL > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
