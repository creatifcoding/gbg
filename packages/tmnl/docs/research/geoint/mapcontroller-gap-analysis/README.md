# MapController Gap Analysis — Normative Artifacts

This folder now contains the normalized, reference-grade outputs from the 6-agent parallel feature ideation run.

## Primary Canonical Document

- `NORMATIVE-GEOINT-MAPCONTROLLER-FEATURE-CATALOG.md`
  - **Canonical normative reference** for the full 300-feature portfolio
  - One section per feature
  - Includes normalized rules, category constraints, map method baseline, and portfolio summary

## Canonical Machine-Readable Payload

- `normalized-feature-catalog.json`
  - Full normalized data model for all 300 features
  - Includes source agent/domain metadata and map method mappings

## Agent-Scoped Normative Documents

- `NORMATIVE-agent-A.md` — Air & Maritime ISR (50)
- `NORMATIVE-agent-B.md` — Disaster Response & Humanitarian Operations (50)
- `NORMATIVE-agent-C.md` — Border Security & Critical Infrastructure Protection (50)
- `NORMATIVE-agent-D.md` — Urban Security / Public Safety / Mega-Events (50)
- `NORMATIVE-agent-E.md` — Climate / Environmental / Resource Intelligence (50)
- `NORMATIVE-agent-F.md` — Multi-Domain Command / Strategic Warning / Defense Fusion (50)

## Source Payloads (Raw)

- `agent-A.json`
- `agent-B.json`
- `agent-C.json`
- `agent-D.json`
- `agent-E.json`
- `agent-F.json`

## Validation Notes

All six source payloads validate as:

- Exactly 50 features each
- Exactly 5 categories each
- Exactly 10 features per category
- Required normalized fields present in each feature object
