#!/usr/bin/env python3
"""Emit A3 workflow laboratory fixtures with content digests."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4] / "assistant" / "workflows"
CATALOG = ROOT / "fixture-catalog"
DEFS = ROOT / "definitions"
LAB = ROOT / "laboratory"
LINTER = ROOT / "linter"
SIM = ROOT / "simulator"

CLOCK = "2026-08-21T12:00:00Z"
EXPIRES = "2027-08-21T00:00:00Z"


def canonical(obj: object) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":")).encode()


def sha256(obj: object) -> str:
    return hashlib.sha256(canonical(obj)).hexdigest()


def write(path: Path, obj: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2) + "\n")


def definition(
    *,
    definition_id: str,
    version: str,
    description: str,
    capability: str,
    author: str,
    graph: list,
    primitives: list,
) -> dict:
    body = {
        "schemaVersion": "1.0.0",
        "kind": "DynamicWorkflowDefinition",
        "definitionId": definition_id,
        "version": version,
        "description": description,
        "capabilityClass": capability,
        "author": author,
        "expiresAt": EXPIRES,
        "inputSchema": {
            "type": "object",
            "properties": {"topic": {"type": "string"}},
            "required": ["topic"],
        },
        "outputSchema": {
            "type": "object",
            "properties": {"result": {"type": "string"}},
            "required": ["result"],
        },
        "stateSchema": {"type": "object"},
        "graph": graph,
        "referencedPrimitives": primitives,
        "prohibited": {
            "deviceCommand": True,
            "browserMutation": True,
            "secrets": True,
            "directCanonicalMutation": True,
            "specimenDbWrite": True,
        },
    }
    digest = sha256({k: v for k, v in body.items()})
    body["digest"] = digest
    return body


def primitive(kind: str, ident: str, version: str, assay_id: str) -> dict:
    return {"kind": kind, "id": ident, "version": version, "assayId": assay_id}


def assay(
    *,
    assay_id: str,
    tool_id: str,
    category: str,
    read: bool,
    write: bool,
    external_mutation: bool,
    device_impact: bool,
    idempotent: bool,
    llm_exposed: bool,
    secrets: bool,
    disposition: str,
    allowed_agents: list[str],
) -> dict:
    identity_core = {
        "id": tool_id,
        "version": "1.0.0",
        "provider": "mantis-workflow-lab-fixture",
        "license": "UNLICENSED-fixture",
    }
    identity = {**identity_core, "digest": sha256(identity_core)}
    return {
        "schemaVersion": "1.0.0",
        "kind": "ToolAssayRecord",
        "assayId": assay_id,
        "recordedAt": CLOCK,
        "identity": identity,
        "contract": {
            "inputSchemaRef": f"assistant/workflows/fixture-catalog/assays/{tool_id}.input.json",
            "outputSchemaRef": f"assistant/workflows/fixture-catalog/assays/{tool_id}.output.json",
            "errors": ["not-found", "timeout"],
            "timeoutMs": 2000,
            "streaming": False,
            "determinism": "deterministic" if idempotent else "non-deterministic",
        },
        "effects": {
            "read": read,
            "write": write,
            "execute": False,
            "externalMutation": external_mutation,
            "deviceImpact": device_impact,
            "rollback": "none",
        },
        "authority": {
            "actor": "assistant",
            "category": category,
            "allowedModes": ["care", "research", "review", "observe"],
            "allowedAgents": allowed_agents,
            "llmExposed": llm_exposed,
        },
        "data": {
            "privacyClass": "secret" if secrets else "public",
            "retention": "run-scoped",
            "networkEgress": False,
            "secrets": secrets,
            "location": "none",
            "media": "none",
        },
        "behavior": {
            "idempotent": idempotent,
            "retrySafe": idempotent,
            "cancellation": "safe" if idempotent else "unsafe",
            "concurrency": "safe" if idempotent else "unknown",
        },
        "evidence": {
            "sourceClassProduced": "external-source" if read else "none",
            "provenanceFields": ["sourceId"],
            "simulator": True,
            "fixtures": [f"assistant/workflows/fixture-catalog/assays/{tool_id}.json"],
        },
        "safety": {
            "staleStatePolicy": "fail-closed" if device_impact else "not-applicable",
            "approvalTier": "never" if device_impact else "none",
            "physicalInterlocks": device_impact,
        },
        "verification": {
            "staticLint": True,
            "sandboxSmoke": True,
            "negativeTests": ["unknown-id-denied"],
            "adversarialTests": ["prompt-injection-ignored"],
        },
        "review": {
            "assessor": "tool-assessor-fixture",
            "independentReviewer": "adversarial-reviewer-fixture",
            "disposition": disposition,
            "expiry": EXPIRES,
            "reAssayTriggers": ["schema-change", "provider-version-change"],
        },
    }


def admit_tool(tool_id: str, assay_id: str, state: str) -> dict:
    return {
        "schemaVersion": "1.0.0",
        "kind": "ToolAdmission",
        "admissionId": f"admit-tool.{tool_id}.v1",
        "toolId": tool_id,
        "assayId": assay_id,
        "state": state,
        "admittedAt": CLOCK,
        "expiresAt": EXPIRES,
        "assessor": "tool-assessor-fixture",
        "reviewer": "independent-reviewer-fixture",
        "notes": "A3 fixture. Assessor did not admit this record.",
    }


def envelope(*, definition_id: str, capability: str, extra: dict | None = None) -> dict:
    body = {
        "kind": "LaboratoryEnvelope",
        "schemaVersion": "1.0.0",
        "definitionId": definition_id,
        "requestContextSchema": {
            "type": "object",
            "properties": {"principalId": {"type": "string"}},
            "required": ["principalId"],
        },
        "budgets": {
            "wallTimeMs": 8000,
            "maxSteps": 8,
            "maxParallel": 2,
            "maxLoopIterations": 4,
            "maxTokens": 4000,
            "maxToolCalls": 8,
            "maxCostUsd": 0.05,
            "cancellable": True,
        },
        "sleepPolicy": {"allowedSignals": ["reminder", "revalidation"]},
        "capabilityClass": capability,
        "mastraCorePin": "1.61.0",
    }
    if extra:
        body.update(extra)
    return body


CARE = primitive("tool", "care-source-read", "1.0.0", "assay.care-source-read.v1")
OBS = primitive("tool", "observation-packet-read", "1.0.0", "assay.observation-packet-read.v1")
TRIAGE = primitive("tool", "research-triage-read", "1.0.0", "assay.research-triage-read.v1")
EVIDENCE = primitive(
    "tool", "evidence-completeness-read", "1.0.0", "assay.evidence-completeness-read.v1"
)
REMINDER = primitive("tool", "reminder-plan-read", "1.0.0", "assay.reminder-plan-read.v1")


def main() -> None:
    for path in (CATALOG / "positive", CATALOG / "negative", CATALOG / "assays", DEFS, LAB / "envelopes", LINTER, SIM):
        path.mkdir(parents=True, exist_ok=True)

    assays = {
        "observation-packet-read": assay(
            assay_id="assay.observation-packet-read.v1",
            tool_id="observation-packet-read",
            category="read-private",
            read=True,
            write=False,
            external_mutation=False,
            device_impact=False,
            idempotent=True,
            llm_exposed=True,
            secrets=False,
            disposition="admitted-read",
            allowed_agents=["observation-extractor", "workflow-composer"],
        ),
        "research-triage-read": assay(
            assay_id="assay.research-triage-read.v1",
            tool_id="research-triage-read",
            category="read-public",
            read=True,
            write=False,
            external_mutation=False,
            device_impact=False,
            idempotent=True,
            llm_exposed=True,
            secrets=False,
            disposition="admitted-read",
            allowed_agents=["care-source", "workflow-composer"],
        ),
        "evidence-completeness-read": assay(
            assay_id="assay.evidence-completeness-read.v1",
            tool_id="evidence-completeness-read",
            category="draft-local",
            read=True,
            write=False,
            external_mutation=False,
            device_impact=False,
            idempotent=True,
            llm_exposed=True,
            secrets=False,
            disposition="admitted-read",
            allowed_agents=["evidence-curator", "workflow-composer"],
        ),
        "reminder-plan-read": assay(
            assay_id="assay.reminder-plan-read.v1",
            tool_id="reminder-plan-read",
            category="draft-local",
            read=True,
            write=False,
            external_mutation=False,
            device_impact=False,
            idempotent=True,
            llm_exposed=True,
            secrets=False,
            disposition="admitted-read",
            allowed_agents=["care-source", "workflow-composer"],
        ),
        "canonical-event-append": assay(
            assay_id="assay.canonical-event-append.v1",
            tool_id="canonical-event-append",
            category="external-write",
            read=False,
            write=True,
            external_mutation=True,
            device_impact=False,
            idempotent=False,
            llm_exposed=True,
            secrets=False,
            disposition="quarantined",
            allowed_agents=["workflow-composer"],
        ),
    }

    for tool_id, record in assays.items():
        write(CATALOG / "assays" / f"{tool_id}.json", record)
        write(
            CATALOG / "assays" / f"{tool_id}.input.json",
            {"type": "object", "properties": {"topic": {"type": "string"}}},
        )
        write(
            CATALOG / "assays" / f"{tool_id}.output.json",
            {"type": "object", "properties": {"result": {"type": "string"}}},
        )
        state = (
            "quarantined"
            if tool_id == "canonical-event-append"
            else "admitted-read"
        )
        write(
            CATALOG / "assays" / f"{tool_id}.admission.json",
            admit_tool(tool_id, record["assayId"], state),
        )

    positives = [
        (
            "care-source-comparison",
            "P0",
            "Compare two admitted care-source reads and summarize disagreements.",
            [
                {"type": "tool", "id": "src-a", "toolId": "care-source-read"},
                {"type": "tool", "id": "src-b", "toolId": "care-source-read"},
                {"type": "mapping", "id": "compare", "mapping": "zip-summarize"},
            ],
            [CARE],
        ),
        (
            "feeding-removal-reminder",
            "P1",
            "Plan a feeding-removal reminder. Sleep emits a reminder signal only.",
            [
                {"type": "tool", "id": "sources", "toolId": "care-source-read"},
                {"type": "tool", "id": "plan", "toolId": "reminder-plan-read"},
                {
                    "type": "mapping",
                    "id": "wait",
                    "mapping": "sleep",
                    "durationMs": 3_600_000,
                    "signal": "reminder",
                },
            ],
            [CARE, REMINDER],
        ),
        (
            "observation-packet",
            "P1",
            "Assemble an observation packet from selected media annotations.",
            [
                {"type": "tool", "id": "read-obs", "toolId": "observation-packet-read"},
                {"type": "mapping", "id": "assemble", "mapping": "assemble-packet"},
            ],
            [OBS],
        ),
        (
            "research-source-triage",
            "P2",
            "Triage reviewed research sources for a care question.",
            [
                {"type": "tool", "id": "lookup", "toolId": "research-triage-read"},
                {"type": "mapping", "id": "rank", "mapping": "rank-sources"},
            ],
            [TRIAGE],
        ),
        (
            "evidence-draft-completeness",
            "P1",
            "Check an evidence draft for completeness. Does not write SpecimenDB.",
            [
                {"type": "tool", "id": "check", "toolId": "evidence-completeness-read"},
            ],
            [EVIDENCE],
        ),
    ]

    catalog_cases = []
    for slug, capability, description, graph, primitives in positives:
        defn = definition(
            definition_id=f"wf.{slug}",
            version="1.0.0",
            description=description,
            capability=capability,
            author="workflow-composer-fixture",
            graph=graph,
            primitives=primitives,
        )
        write(DEFS / f"{slug}.v1.json", defn)
        write(LAB / "envelopes" / f"{slug}.v1.json", envelope(definition_id=defn["definitionId"], capability=capability))
        write(
            CATALOG / "positive" / f"{slug}.v1.json",
            {
                "id": f"{slug}.v1",
                "expect": "admit",
                "definition": f"assistant/workflows/definitions/{slug}.v1.json",
                "envelope": f"assistant/workflows/laboratory/envelopes/{slug}.v1.json",
                "composer": "workflow-composer-fixture",
                "assessor": "tool-assessor-fixture",
                "adversary": "adversarial-reviewer-fixture",
                "governor": "human-governor-fixture",
            },
        )
        catalog_cases.append({"id": f"{slug}.v1", "expect": "admit"})

    negatives = []

    device = definition(
        definition_id="wf.malicious-device-command",
        version="1.0.0",
        description="Malicious graph that attempts a device command.",
        capability="P0",
        author="workflow-composer-fixture",
        graph=[{"type": "tool", "id": "move", "toolId": "device-command"}],
        primitives=[primitive("tool", "device-command", "0.0.0", "assay.missing")],
    )
    negatives.append(("device-command-graph", device, "reject", "/graph/0/toolId"))

    hidden = definition(
        definition_id="wf.hidden-unassayed-mcp",
        version="1.0.0",
        description="References an unassayed MCP tool.",
        capability="P2",
        author="workflow-composer-fixture",
        graph=[{"type": "tool", "id": "browse", "toolId": "mcp.hidden-browser"}],
        primitives=[primitive("tool", "mcp.hidden-browser", "1.0.0", "assay.missing")],
    )
    negatives.append(("hidden-unassayed-mcp", hidden, "reject", "/graph/0/toolId"))

    unbounded = definition(
        definition_id="wf.unbounded-loop",
        version="1.0.0",
        description="Foreach without a bound explodes cost.",
        capability="P0",
        author="workflow-composer-fixture",
        graph=[
            {"type": "tool", "id": "lookup", "toolId": "care-source-read"},
            {"type": "mapping", "id": "loop", "mapping": "foreach"},
        ],
        primitives=[CARE],
    )
    negatives.append(("unbounded-loop", unbounded, "reject", "/graph/1"))

    replay = definition(
        definition_id="wf.replay-nominal-write",
        version="1.0.0",
        description="Replay-unsafe canonical write.",
        capability="P1",
        author="workflow-composer-fixture",
        graph=[{"type": "tool", "id": "append", "toolId": "canonical-event-append"}],
        primitives=[
            primitive(
                "tool",
                "canonical-event-append",
                "1.0.0",
                "assay.canonical-event-append.v1",
            )
        ],
    )
    negatives.append(("replay-nominal-write", replay, "reject", "/graph/0/toolId"))

    self_admit = definition(
        definition_id="wf.composer-self-admit",
        version="1.0.0",
        description="Valid P0 graph used to prove composer cannot admit own output.",
        capability="P0",
        author="workflow-composer-fixture",
        graph=[{"type": "tool", "id": "lookup", "toolId": "care-source-read"}],
        primitives=[CARE],
    )
    negatives.append(("composer-self-admit", self_admit, "reject-identity", "/reviewer"))

    for slug, defn, expect, path in negatives:
        write(DEFS / f"{slug}.v1.json", defn)
        extra = {}
        if slug == "unbounded-loop":
            extra = {
                "budgets": {
                    "wallTimeMs": 8_000,
                    "maxSteps": 8,
                    "maxParallel": 2,
                    "maxLoopIterations": 4,
                    "maxTokens": 4_000,
                    "maxToolCalls": 8,
                    "maxCostUsd": 0.05,
                    "cancellable": True,
                }
            }
        write(
            LAB / "envelopes" / f"{slug}.v1.json",
            envelope(definition_id=defn["definitionId"], capability=defn["capabilityClass"], extra=extra),
        )
        write(
            CATALOG / "negative" / f"{slug}.v1.json",
            {
                "id": f"{slug}.v1",
                "expect": expect,
                "definition": f"assistant/workflows/definitions/{slug}.v1.json",
                "envelope": f"assistant/workflows/laboratory/envelopes/{slug}.v1.json",
                "composer": "workflow-composer-fixture",
                "assessor": "tool-assessor-fixture",
                "adversary": "adversarial-reviewer-fixture",
                "governor": "workflow-composer-fixture" if slug == "composer-self-admit" else "human-governor-fixture",
                "diagnosticPath": path,
            },
        )
        catalog_cases.append({"id": f"{slug}.v1", "expect": expect})

    write(
        CATALOG / "catalog.json",
        {
            "kind": "WorkflowFixtureCatalog",
            "schemaVersion": "1.0.0",
            "mastraCorePin": "1.61.0",
            "clock": CLOCK,
            "a0Owned": [
                "assistant/workflows/definitions/research-summary.v1.json",
                "assistant/workflows/admissions/research-summary.v1.json",
            ],
            "cases": catalog_cases,
        },
    )

    snapshot_tools = [
        {
            "id": "care-source-read",
            "version": "1.0.0",
            "assayId": "assay.care-source-read.v1",
            "admission": "admitted-read",
            "source": "imported-a0",
        },
        {
            "id": "supply-transit-read",
            "version": "1.0.0",
            "assayId": "assay.supply-transit-read.v1",
            "admission": "admitted-read",
            "source": "imported-a0",
        },
        {
            "id": "observation-packet-read",
            "version": "1.0.0",
            "assayId": "assay.observation-packet-read.v1",
            "admission": "admitted-read",
            "source": "fixture-catalog",
        },
        {
            "id": "research-triage-read",
            "version": "1.0.0",
            "assayId": "assay.research-triage-read.v1",
            "admission": "admitted-read",
            "source": "fixture-catalog",
        },
        {
            "id": "evidence-completeness-read",
            "version": "1.0.0",
            "assayId": "assay.evidence-completeness-read.v1",
            "admission": "admitted-read",
            "source": "fixture-catalog",
        },
        {
            "id": "reminder-plan-read",
            "version": "1.0.0",
            "assayId": "assay.reminder-plan-read.v1",
            "admission": "admitted-read",
            "source": "fixture-catalog",
        },
    ]
    snapshot = {
        "kind": "PrimitiveCapabilitySnapshot",
        "schemaVersion": "1.0.0",
        "mastraCorePin": "1.61.0",
        "recordedAt": CLOCK,
        "tools": snapshot_tools,
        "forbidden": ["device-command", "admin", "specimen-db-write", "live-catalog-write", "browser-mutate"],
        "mappingKinds": ["zip-summarize", "sleep", "conditional", "foreach", "parallel", "assemble-packet", "rank-sources"],
        "sleepSignals": ["reminder", "revalidation"],
    }
    snapshot["digest"] = sha256({k: v for k, v in snapshot.items() if k != "digest"})
    write(LAB / "primitive-snapshot.json", snapshot)

    write(
        LINTER / "rules.json",
        {
            "kind": "WorkflowStaticLintRules",
            "schemaVersion": "1.0.0",
            "maxCapability": "P2",
            "forbiddenToolIds": [
                "device-command",
                "admin",
                "specimen-db-write",
                "live-catalog-write",
                "browser-mutate",
            ],
            "forbiddenCategories": ["device-command", "admin", "external-write", "device-intent"],
            "requireAssayClosed": True,
            "requireAdmittedReadOrIdempotent": True,
            "sleepSignals": ["reminder", "revalidation"],
            "requireLoopBound": True,
            "requireParallelBound": True,
            "denySecrets": True,
            "denyReplayUnsafeWrites": True,
            "distinctIdentities": {
                "composerCannotAdmit": True,
                "assessorCannotAdmit": True,
                "adversaryCannotAdmit": True,
            },
        },
    )

    write(
        SIM / "harness.json",
        {
            "kind": "WorkflowSimulatorHarness",
            "schemaVersion": "1.0.0",
            "clock": CLOCK,
            "sideEffects": "disabled",
            "replay": "disabled-for-external-mutation",
            "notes": "Deterministic in-process walk of the JSON graph. Does not call Mastra or CopilotKit.",
        },
    )

    print("emitted", len(list(DEFS.glob("*.json"))), "definitions")


if __name__ == "__main__":
    main()
