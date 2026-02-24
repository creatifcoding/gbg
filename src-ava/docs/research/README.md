# Research Corpus — ava-fusion

> **Last updated**: 2026-02-20
>
> Index of all research documents supporting the ava-fusion pipeline.
> 7 documents, ~4,000 lines, covering runtime integration, algorithms,
> deployment, and E2E validation.

---

## Documents

### Core Architecture

| Document | Lines | Focus |
|----------|-------|-------|
| [asupersync-api-surface.md](./asupersync-api-surface.md) | 528 | Full API catalogue of asupersync v0.2.5 — GenServer, Cx, Supervision, Runtime |
| [asupersync-gap-analysis.md](./asupersync-gap-analysis.md) | 376 | Gap audit: 10 gaps identified, 5 resolved. Cx coverage ~55% |
| [asupersync-integration-patterns.md](./asupersync-integration-patterns.md) | 534 | 5 implementation patterns for GenServer lifetime, cancel, masking, budgets, timers |

### Algorithms & Domain

| Document | Lines | Focus |
|----------|-------|-------|
| [differential-dataflow-fusion-integration.md](./differential-dataflow-fusion-integration.md) | 456 | DD join engine: InputSession, arrange_by_key, reduce, iterate. Tier 1/2/3 operator mapping |
| [domain-expert-synthesis.md](./domain-expert-synthesis.md) | 1240 | 23-item priority matrix: PCR5, EKF, NFA-SASE, Welford, CUSUM, triangle counting, Louvain |

### Deployment & Validation

| Document | Lines | Focus |
|----------|-------|-------|
| [e2e-readiness-assessment.md](./e2e-readiness-assessment.md) | 519 | "Brain in a jar" audit: 9 I/O boundary gaps, 6-phase build order, data sources |
| [nex-deployment-feasibility.md](./nex-deployment-feasibility.md) | 412 | NEX vs Docker vs bare metal. WASM blocked. Monolith-first. Migration path |

### Test Data Sources

| Document | Lines | Focus |
|----------|-------|-------|
| [data-sources/](./data-sources/) | — | Per-SignalKind data source catalogs for E2E testing across all 20 sensor types |

---

## Ontology Coverage

### 20 Signal Kinds (from `ava-fusion/src/signal.rs`)

| SignalKind | Domain | E2E Data Source | Status |
|------------|--------|-----------------|--------|
| `AdsB` | Aircraft transponder | OpenSky Network | Identified |
| `Ais` | Maritime transponder | NOAA Marine Cadastre | Identified |
| `Radar` | Primary/secondary returns | TBD | Researching |
| `RfBearing` | RF direction-finding | TBD | Researching |
| `Sdr` | SDR raw capture | TBD | Researching |
| `Http` | Web request metadata | TBD | Researching |
| `Dns` | DNS query/response | TBD | Researching |
| `Satellite` | Overhead sensor data | TBD | Researching |
| `Geoint` | Imagery analysis | TBD | Researching |
| `Humint` | Human reports | TBD | Researching |
| `Sigint` | Signals intelligence | TBD | Researching |
| `Elint` | Electronic intelligence | TBD | Researching |
| `Comint` | Comms intelligence | TBD | Researching |
| `Osint` | Open-source intel | TBD | Researching |
| `Masint` | Measurement/signature | TBD | Researching |
| `Cyber` | Threat indicators | TBD | Researching |
| `Social` | Social media signals | TBD | Researching |
| `Financial` | Transactions/sanctions | TBD | Researching |
| `Travel` | Travel records | TBD | Researching |
| `Custom` | Operator-defined | N/A (user-supplied) | N/A |

### 10 Entity Classes (from `ava-fusion/src/entity.rs`)

| EntityClass | Primary ID | Primary Signal | Cross-Correlation Targets |
|-------------|-----------|----------------|--------------------------|
| `Aircraft` | ICAO hex | AdsB | Radar, RfBearing, Satellite |
| `Vessel` | MMSI | Ais | Radar, RfBearing, Satellite |
| `GroundVehicle` | License plate | Radar | Geoint, Satellite |
| `RfEmitter` | Freq+location | RfBearing | Elint, Sdr |
| `NetworkHost` | IP address | Http | Dns, Cyber |
| `Domain` | FQDN | Dns | Http, Cyber, Osint |
| `Person` | Name/handle | Humint | Social, Travel, Financial |
| `Organization` | Name/LEI | Osint | Financial, Cyber |
| `Campaign` | STIX ID | Cyber | Osint, Social, Comint |
| `Facility` | Geo+name | Geoint | Satellite, Masint |

---

## Reading Order

**New to the project?** Read in this order:

1. `domain-expert-synthesis.md` — understand what the pipeline does
2. `asupersync-api-surface.md` — understand the actor framework
3. `asupersync-gap-analysis.md` — understand what we've improved
4. `differential-dataflow-fusion-integration.md` — understand the join engine plan
5. `e2e-readiness-assessment.md` — understand what's missing for real execution
6. `nex-deployment-feasibility.md` — understand the deployment strategy

**Building the E2E pipeline?** Start with:

1. `e2e-readiness-assessment.md` — the build order
2. `data-sources/` — where to get test data
3. `asupersync-integration-patterns.md` — how actors work internally

---

## Cross-References

```
domain-expert-synthesis ──────► differential-dataflow-fusion-integration
        │                              │
        │                              ▼
        │                    e2e-readiness-assessment
        │                              │
        ▼                              ▼
asupersync-api-surface ──► asupersync-gap-analysis
        │                              │
        ▼                              ▼
asupersync-integration-patterns    nex-deployment-feasibility
```
