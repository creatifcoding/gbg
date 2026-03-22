# GEOINT Proposal Comparison Matrix (Agent Tracks A/B/C)

## Summary verdict
Recommended execution order:
1. **Track A first** (fastest path to conversational determinism)
2. **Track B second** (standards/provenance hardening)
3. **Track C third** (multi-view + policy governance after A/B stabilize)

Prime translation: maximum leverage, minimum architectural self-harm.

## Matrix

| Axis | Track A: Layer Graph + Mode Compiler | Track B: Standards Query Pipeline | Track C: Multi-View + Policy Spine |
|---|---|---|---|
| Primary goal | Deterministic intent→render | Interoperable ingestion/query and provenance | Analyst-grade reasoning + controls |
| Reuse of existing TMNL | Very high | High | Medium-high |
| Time-to-value | Fast | Medium | Slowest |
| Complexity | Medium | Medium-high | High |
| External standards leverage | Medium | Very high | Medium |
| Conversational control quality | High | High | Very high |
| Operational safety controls | Medium | High (provenance) | Very high (policy engine) |
| Migration risk | Low-medium | Medium | High |

## Gate criteria per track

### Track A gates
- A1: layer graph output parity with current `GeointMap` output.
- A2: all `geoint_*` tools route through compiler.
- A3: `sdk.geoint.*` parity tests pass.

### Track B gates
- B1: canonical envelope schema adopted end-to-end.
- B2: source adapters pass schema conformance + pagination tests.
- B3: provenance visible in summaries and task outputs.

### Track C gates
- C1: timeline/detail views synchronized by shared entity keys.
- C2: policy engine supports allow/redact/deny with audit traces.
- C3: latency budget met under guard-enabled flows.

## Research provenance
This matrix is grounded in the Track A/B/C artifacts plus:
- **DeepWiki** deck.gl, mapbox-gl-js, stac-fastapi synthesis:
  - https://deepwiki.com/search/what-are-the-recommended-patte_c5be2967-aa3a-4774-8278-62e46bc08ad5
  - https://deepwiki.com/search/what-runtime-patterns-are-reco_078727cc-5c77-4c74-b486-f2682e931d02
  - https://deepwiki.com/search/what-query-parameters-and-pagi_81f21b27-d8ea-4b83-8a83-9d7b2c7bce7c
- **Exa web research** (deck.gl perf, Mapbox layer lifecycle, OGC/STAC specs)
- **Context7 docs** for `/visgl/deck.gl` and `/mapbox/mapbox-gl-js`

## Suggested immediate next action
Open an implementation epic for **Track A Phase A0–A2**, while adding a small **Track B envelope schema spike** in parallel to prevent future backfill pain.
