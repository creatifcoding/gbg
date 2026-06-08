# Muse Metric Pack Artifact Registration

Tasker: `#4651`  
Applies to: `MuseMetricPackResult` JSON + Markdown reports + optional visuals

## Purpose

Every metric-pack analyzer must leave a machine-readable result, a human-readable report, and a Tasker-visible evidence trail. If it is not registered, it does not exist operationally. Prime, yes, the artifact ledger is paperwork; it is also how future us avoids spelunking `/tmp` like raccoons.

## Artifact set per pack run

A completed metric-pack run should produce:

| Artifact | Role | Required | Notes |
| --- | --- | --- | --- |
| `pack-result.json` | `summary_json` | yes | Canonical `MuseMetricPackResult` |
| `pack-result.md` | `report_markdown` | yes | Rendered by `scripts/muse/metric_pack_report.py` |
| `pack-result.html` | `visual_explainer` | optional initially | Pack-specific visual surface or reusable renderer |
| source artifacts | `raw_input`, `manifest`, `markers`, etc. | yes | Must be listed in `result.evidence` |

## Naming convention

Inside a session directory:

```text
session-dir/
  metric-packs/
    transport-integrity.result.json
    transport-integrity.report.md
    contact-fit-quality.result.json
    contact-fit-quality.report.md
    ...
```

Visual artifacts may live under `/home/getbygenius/.agent/diagrams/` but must be referenced by path from Tasker.

## Tasker registration rule

Register each completed pack run with:

- `featureId`: the pack realization feature (`#F1284`–`#F1291`) or parent `#F1282` for aggregate runs.
- `stage`: `validate` for computed evidence, `design` for static plans/specs.
- `kind`: `evidence-pack` for computed pack results; `visual-plan` for static explainers.
- `title`: `Muse metric pack result — <Pack Title>`.
- `summary`: include status, session ID, and whether the pack blocks downstream claims.
- `path`: Markdown report for human review, or HTML visual if primary.
- `metadata`: include `packId`, `status`, `sessionId`, `resultJson`, and key blocker counts.

## Example Tasker artifact metadata

```json
{
  "packId": "transport-integrity",
  "status": "pass",
  "sessionId": "muse-20260608-001",
  "resultJson": "sessions/muse-20260608-001/metric-packs/transport-integrity.result.json",
  "reportMarkdown": "sessions/muse-20260608-001/metric-packs/transport-integrity.report.md",
  "blocksClaims": false,
  "failedRequiredGates": 0,
  "warnings": 1
}
```

## Aggregated registration

After all packs for a session run, create an aggregate artifact:

```text
session-dir/metric-packs/index.md
```

It should list each pack status and the highest permitted interpretation level:

1. transport only,
2. contact/fit plausible,
3. EEG quality usable,
4. artifact-calibrated,
5. alpha-candidate admitted,
6. ML-ready dataset.

If any upstream pack fails, the aggregate must state which downstream packs are barred.

## Claim-boundary propagation

Any `MuseMetricPackCaveat` with `blocksClaim: true` must be copied into:

- the pack Markdown report,
- the aggregate session index,
- Tasker artifact metadata when feasible,
- future panel status surfaces.

Examples:

- No-contact baseline → blocks all physiology claims.
- Protocol compliance fail → blocks all labeled analysis.
- Contact fail → blocks EEG signal quality and alpha candidate.
- ML leakage risk → blocks model claims.

## Registration checklist

Before marking a metric-pack task done:

- [ ] `MuseMetricPackResult` JSON validates.
- [ ] Markdown report renders with `metric_pack_report.py`.
- [ ] Evidence paths exist or are explicitly external.
- [ ] Caveats and blocked claims are visible.
- [ ] Tasker artifact is created or indexed.
- [ ] Tasker task note records status and path.

## Do not register

Do not register exploratory scratch outputs as pack results unless they use the canonical result schema. Scratch can be indexed as context, but it must not masquerade as a satisfied pack.
