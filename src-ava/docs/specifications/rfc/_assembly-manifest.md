# AVA-RFC-001 Assembly Manifest

> Assembly order for the ava-fusion pipeline RFC.
> Each section is a standalone file in `rfc/` that can be authored independently.
> The assembly script concatenates them in order with proper numbering.

---

## Section Registry

| ID | Title | File | Part | Status |
|----|-------|------|------|--------|
| AVA.1 | Pipeline Architecture | `rfc-section-pipeline-architecture.md` | I — Data Ingest | DRAFT |
| AVA.2 | Signal Schema | `rfc-section-signal-schema.md` | I — Data Ingest | DRAFT |
| AVA.3 | NATS Subject Taxonomy | `rfc-section-nats-subject-taxonomy.md` | I — Data Ingest | DRAFT |
| AVA.4 | Source Adapters | `rfc-section-source-adapters.md` | I — Data Ingest | DRAFT |
| AVA.5 | JetStream Persistence | `rfc-section-jetstream-persistence.md` | I — Data Ingest | DRAFT |
| AVA.6 | Actor Model (asupersync) | `rfc-section-actor-model.md` | II — Processing | DRAFT |
| AVA.7 | Supervision Tree | `rfc-section-supervision-tree.md` | II — Processing | DRAFT |
| AVA.8 | Differential Dataflow Engine | `rfc-section-dd-engine.md` | II — Processing | DRAFT |
| AVA.9 | Fusion Tiers & Join Paths | `rfc-section-fusion-tiers.md` | II — Processing | DRAFT |
| AVA.10 | Evidence Theory (DS/PCR5) | `rfc-section-evidence-theory.md` | III — Algorithms | DRAFT |
| AVA.11 | Tracking & State Estimation | `rfc-section-tracking.md` | III — Algorithms | DRAFT |
| AVA.12 | Complex Event Processing | `rfc-section-cep.md` | III — Algorithms | DRAFT |
| AVA.13 | Output & Alarm Pipeline | `rfc-section-output-pipeline.md` | IV — Output | DRAFT |
| AVA.14 | Deployment Topology | `rfc-section-deployment.md` | IV — Output | DRAFT |
| AVA.15 | E2E Testing Strategy | `rfc-section-e2e-testing.md` | V — Validation | DRAFT |
| Appendix A | SignalKind Catalog | `rfc-appendix-signal-catalog.md` | Appendices | DRAFT |
| Appendix B | EntityClass Catalog | `rfc-appendix-entity-catalog.md` | Appendices | DRAFT |
| Appendix C | Data Source Catalog | `rfc-appendix-data-sources.md` | Appendices | DRAFT |
| Appendix D | Bibliography | `rfc-appendix-bibliography.md` | Appendices | DRAFT |

---

## Parts

| Part | Title | Sections |
|------|-------|----------|
| I | Data Ingest (Normative) | AVA.1 – AVA.5 |
| II | Processing (Normative) | AVA.6 – AVA.9 |
| III | Algorithms (Normative) | AVA.10 – AVA.12 |
| IV | Output (Normative) | AVA.13 – AVA.14 |
| V | Validation (Informative) | AVA.15 |
| — | Appendices | A – D |

---

## Assembly Command

```bash
cd src-ava && bun run scripts/assemble-rfc.ts
```

The script reads this manifest, concatenates sections in order, renumbers
subsections, validates cross-references, and writes `AVA-RFC-001-assembled.md`.
