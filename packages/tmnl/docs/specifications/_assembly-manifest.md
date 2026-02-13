# TMNL-RFC-001 Assembly Manifest

```
RFC:        001 -- Entity Lifecycle Event Distribution for Metropolitan-Scale IIoT
Status:     DRAFT (assembly-ready)
Generated:  2026-02-09
Purpose:    Master assembly blueprint for Task #83 (final RFC merge)
```

---

## Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | `rfc-section-edge-architecture.md` (v1, 1,640 lines) is **canonical** | Most complete edge section; v2 (1,053 lines) supplements with refined detail |
| D2 | `rfc-section-multi-tenant-network.md` is **primary** multi-tenant file | Network-focused framing aligns with manufacturing commons thesis |
| D3 | Expanded ~18-20K line structure **approved** | 27 standalone sections + appendices exceed original 17-section plan |
| D4 | Proceed without waiting for in-progress agents | `tenant-isolation` (0 lines) handled via GAP-FILL; other agents' output incorporated as it lands |

---

## Part I: Context & Vision

### Section 1: Introduction & Vision

| Field | Value |
|-------|-------|
| **Final title** | Introduction & Vision: The Manufacturing Commons |
| **Source file(s)** | `rfc-section-introduction.md` |
| **Lines** | 288 |
| **Assembly** | AS-IS |
| **Status** | READY |
| **Notes** | Manufacturing commons framing. Opens with 200K-org metropolitan vision. Sets the thesis for the entire RFC. |

### Section 2: Theoretical Foundations

| Field | Value |
|-------|-------|
| **Final title** | Theoretical Foundations |
| **Source file(s)** | `rfc-section-theoretical-foundations.md` |
| **Lines** | 579 |
| **Assembly** | AS-IS |
| **Status** | READY |
| **Notes** | Endsley SA, EID, CPS theory, information foraging, STAMP. Underpins design rationale for all architecture decisions. |

### Section 3: Architectural Principles

| Field | Value |
|-------|-------|
| **Final title** | Architectural Principles |
| **Source file(s)** | `rfc-section-architectural-principles.md` |
| **Lines** | 637 |
| **Assembly** | AS-IS |
| **Status** | READY |
| **Notes** | Normative principles P1-P8 (intra-org) and P9-P12 (manufacturing commons). Conformance levels, principle interaction matrix. |

### Section 4: Competitive Differentiation & Industry Analysis

| Field | Value |
|-------|-------|
| **Final title** | Competitive Differentiation & Industry Analysis |
| **Source file(s)** | `rfc-section-competitive-analysis.md` |
| **Lines** | 646 |
| **Assembly** | AS-IS |
| **Status** | READY |
| **Notes** | Siemens MindSphere, PTC ThingWorx, AVEVA, Rockwell, GE Proficy, Ignition, cloud hyperscalers. Five universal gaps, network effects analysis. |

**Part I subtotal**: ~2,150 lines

---

## Part II: Architecture

### Section 5: Multi-Tenant Manufacturing Network

| Field | Value |
|-------|-------|
| **Final title** | Multi-Tenant Manufacturing Network Architecture |
| **Source file(s)** | `rfc-section-multi-tenant-network.md` (primary, D2), `rfc-section-multi-tenant.md` (merge) |
| **Lines** | 528 + 566 = ~900 after dedup |
| **Assembly** | MERGE |
| **Status** | READY |
| **Notes** | D2 applies. `multi-tenant-network.md` provides network topology, NATS super-cluster, leaf nodes, cross-org comms. `multi-tenant.md` adds NATS account isolation, JetStream domain separation detail. Deduplicate overlapping subsections during merge. |

### Section 6: Reactive ISA-95 Hierarchy

| Field | Value |
|-------|-------|
| **Final title** | Reactive ISA-95 Hierarchy Specification |
| **Source file(s)** | `rfc-section-reactive-isa95.md` |
| **Lines** | 878 |
| **Assembly** | AS-IS |
| **Status** | READY |
| **Notes** | Variable-depth ISA-95, event taxonomy by level, propagation rules, latency SLA table, cross-level routing. Grounded with codebase refs. |

### Section 7: Network Entity Types

| Field | Value |
|-------|-------|
| **Final title** | Network Entity Types |
| **Source file(s)** | `rfc-section-network-entity-types.md` (formal spec), `rfc-section-network-entities.md` (background) |
| **Lines** | 1,233 + selective from 1,491 = ~1,800 |
| **Assembly** | MERGE |
| **Status** | READY |
| **Notes** | `network-entity-types.md` (N.x prefix) is the formal specification with Organization, Capability, Capacity, Work Order, Reputation, Compliance entities. `network-entities.md` has entity lifecycle state machines and event-sourced boundaries that should merge in. |

### Section 8: Entity-Realtime Integration

| Field | Value |
|-------|-------|
| **Final title** | Entity-Realtime Integration |
| **Source file(s)** | `rfc-entity-realtime-integration.md` (scaffold) |
| **Lines** | ~800 (extracted from 1,633 scaffold) |
| **Assembly** | EXTRACT |
| **Status** | READY |
| **Notes** | Primary scaffold contains Sections 4,5,7,8,11,12,13 and Appendices A-E from original plan. Extract entity-realtime bridge content (EventDistribution, ChannelService routing, subscription management). Remaining scaffold content feeds Appendices B, C, E. |

### Section 9: Consistency Guarantees

| Field | Value |
|-------|-------|
| **Final title** | Consistency Guarantees & Ordering Semantics |
| **Source file(s)** | `rfc-section-two-domain-consistency.md` (normative), `rfc-section-consistency-guarantees.md` (implementation) |
| **Lines** | 638 + 479 = ~1,000 after merge |
| **Assembly** | MERGE |
| **Status** | READY |
| **Notes** | `two-domain-consistency.md` is the normative two-domain model (intra-org vs cross-org, G-1 through G-10, CRDT aggregates, PACELC). `consistency-guarantees.md` maps guarantees to NATS JetStream and Effect patterns. Merge into unified section. |

### Section 10: Effect-TS Implementation Architecture

| Field | Value |
|-------|-------|
| **Final title** | Effect-TS Implementation Architecture |
| **Source file(s)** | `rfc-section-effect-architecture.md` |
| **Lines** | 791 |
| **Assembly** | AS-IS |
| **Status** | READY |
| **Notes** | @effect/cluster, Effect.Machine, RPC architecture, Stream composition, Layer patterns, Schema type system. Grounded with codebase file refs. |

**Part II subtotal**: ~6,200 lines

---

## Part III: Infrastructure & Operations

### Section 11: Edge-First Architecture

| Field | Value |
|-------|-------|
| **Final title** | Edge-First Architecture |
| **Source file(s)** | `rfc-section-edge-architecture.md` (canonical, D1), `rfc-section-edge-architecture-v2.md` (supplement) |
| **Lines** | 1,640 + selective from 1,053 = ~1,800 |
| **Assembly** | MERGE (v1 canonical, v2 supplements) |
| **Status** | READY |
| **Notes** | D1 applies. v1 is canonical: four-tier edge capability model, NATS topology, @effect/cluster profiles, reconciliation protocol, offline autonomy. v2 adds refined design philosophy, resource constraints, brownfield integration, bandwidth management. Merge v2 additions where they provide new content not in v1. |

### Section 12: Deployment Topology

| Field | Value |
|-------|-------|
| **Final title** | Deployment Topology |
| **Source file(s)** | `rfc-section-deployment-topology.md` |
| **Lines** | 817 |
| **Assembly** | AS-IS |
| **Status** | READY |
| **Notes** | NATS hub-and-spoke super-cluster for 200K orgs, @effect/cluster deployment profiles, edge-cloud reconciliation, upgrade paths, capacity planning. |

### Section 13: Security Architecture

| Field | Value |
|-------|-------|
| **Final title** | Security Architecture |
| **Source file(s)** | `rfc-section-security-architecture.md` (primary), `rfc-section-security-trust.md` (selective merge) |
| **Lines** | 865 + selective from 796 = ~1,100 |
| **Assembly** | MERGE |
| **Status** | READY |
| **Notes** | `security-architecture.md` supersedes Z.2-Z.5 from original `security-trust.md`. Threat model, authentication (JWT/mTLS), authorization (RBAC+ABAC), cryptographic requirements, network security. Merge any unique detail from `security-trust.md` not covered. |

### Section 14: Trust Model

| Field | Value |
|-------|-------|
| **Final title** | Trust Model |
| **Source file(s)** | `rfc-section-trust-model.md` |
| **Lines** | 834 |
| **Assembly** | AS-IS |
| **Status** | READY |
| **Notes** | Organization identity verification, trust establishment protocol, reputation scoring (G-10), signal attestation, consent/disclosure. Landed from Task #94. |

### Section 15: Tenant Isolation

| Field | Value |
|-------|-------|
| **Final title** | Tenant Isolation |
| **Source file(s)** | `rfc-section-tenant-isolation.md` |
| **Lines** | 1,047 |
| **Assembly** | AS-IS |
| **Status** | READY |
| **Notes** | Landed from Task #95. NATS account boundaries, data isolation guarantees, cross-tenant audit, blast radius containment. |

### Section 16: Failure Modes & Recovery

| Field | Value |
|-------|-------|
| **Final title** | Failure Modes & Recovery |
| **Source file(s)** | `rfc-section-failure-modes.md` |
| **Lines** | 949 |
| **Assembly** | AS-IS |
| **Status** | READY |
| **Notes** | Failure classification (network partition, node failure, cascade), NATS infrastructure failures, @effect/cluster failures, edge device failures, cross-org scenarios, recovery procedures, chaos engineering. |

### Section 17: Monitoring Infrastructure

| Field | Value |
|-------|-------|
| **Final title** | Monitoring Infrastructure |
| **Source file(s)** | `rfc-section-monitoring-infrastructure.md` |
| **Lines** | 659 |
| **Assembly** | AS-IS |
| **Status** | READY |
| **Notes** | Health check hierarchy, SLO definitions, alerting pipeline, capacity monitoring, anomaly detection. Grounded with codebase refs. |

### Section 18: Observability Framework

| Field | Value |
|-------|-------|
| **Final title** | Observability Framework |
| **Source file(s)** | `rfc-section-observability-framework.md` (primary), `rfc-section-observability.md` (selective merge) |
| **Lines** | 854 + selective from 781 = ~1,100 |
| **Assembly** | MERGE |
| **Status** | READY |
| **Notes** | `observability-framework.md` is the dedicated split (OBS.x prefix): OpenTelemetry, distributed tracing, metric architecture, structured logging, edge device observability. `observability.md` is earlier combined version with SLI/SLO framework and incident response detail. Merge unique content from combined version. |

### Section 19: Operational Runbooks

| Field | Value |
|-------|-------|
| **Final title** | Operational Runbooks |
| **Source file(s)** | `rfc-section-operational-runbooks.md` |
| **Lines** | 1,087 |
| **Assembly** | AS-IS |
| **Status** | READY |
| **Notes** | Day-1 operations, Day-2 operations, incident response, maintenance windows, capacity planning, backup/recovery, compliance operations. Landed from Task #111. |

**Part III subtotal**: ~10,200 lines

---

## Part IV: Developer & Operator Experience

### Section 20: Developer Experience

| Field | Value |
|-------|-------|
| **Final title** | Developer Experience |
| **Source file(s)** | `rfc-section-developer-experience.md` |
| **Lines** | 1,064 |
| **Assembly** | AS-IS |
| **Status** | READY |
| **Notes** | SDK architecture (Effect-native + Promise wrapper), full RPC inventory tables, CLI reference, error code registry (TMNL-E-1xx through 9xx), testing support, codebase grounding. 11 subsections (DX.1-DX.11). |

### Section 21: Onboarding Protocol

| Field | Value |
|-------|-------|
| **Final title** | Onboarding Protocol & First-Run Experience |
| **Source file(s)** | `rfc-section-onboarding-protocol.md` |
| **Lines** | 1,130 |
| **Assembly** | AS-IS |
| **Status** | READY |
| **Notes** | 15-minute SLA, onboarding timeline, integration patterns (Sparkplug-B, OPC UA, MQTT), edge agent bootstrap, progressive complexity, first-run UX. |

### Section 22: Marketplace Protocol

| Field | Value |
|-------|-------|
| **Final title** | Marketplace Protocol |
| **Source file(s)** | `rfc-section-marketplace-protocol.md` |
| **Lines** | 897 |
| **Assembly** | AS-IS |
| **Status** | READY |
| **Notes** | Capability discovery (OR-Set CRDT), capacity signaling, work order lifecycle (13 states), pricing/escrow, G-10 trust, geographic optimization, privacy-preserving marketplace. |

**Part IV subtotal**: ~3,091 lines

---

## Part V: Appendices

### Appendix A: Bibliography

| Field | Value |
|-------|-------|
| **Final title** | Bibliography |
| **Source file(s)** | `bibliography.md` |
| **Lines** | 443 |
| **Assembly** | AS-IS |
| **Status** | READY |
| **Notes** | 225+ canonical [KEY] citations across 16 categories. Referenced throughout all sections. |

### Section 23: Migration & Upgrade Strategy

| Field | Value |
|-------|-------|
| **Final title** | Migration & Upgrade Strategy |
| **Source file(s)** | `rfc-section-migration-upgrade.md` |
| **Lines** | 304 |
| **Assembly** | AS-IS |
| **Status** | READY |
| **Notes** | Brownfield integration (strangler fig pattern), protocol adapter matrix, Sparkplug-B migration, tier promotion paths (T0-T3), schema evolution with Effect Schema versioning, zero-downtime edge agent upgrades (rolling + Nix atomic), canary deployment, rollback procedures. Grounded to `sparkplug-adapter.ts`, `ingestion-service.ts`, `nix/modules/`. Supersedes Appendix B (Migration Strategy extract). |

### Appendix B: Migration Strategy (SUPERSEDED)

| Field | Value |
|-------|-------|
| **Final title** | Migration Strategy |
| **Source file(s)** | Extract from `rfc-entity-realtime-integration.md` Appendix C |
| **Lines** | ~200 (estimated) |
| **Assembly** | SUPERSEDED by Section 23 |
| **Status** | SUPERSEDED |
| **Notes** | Superseded by `rfc-section-migration-upgrade.md` (Section 23). The scaffold migration appendix content is covered more comprehensively in the dedicated section. |

### Appendix C: Conformance & Testing

| Field | Value |
|-------|-------|
| **Final title** | Conformance & Testing Requirements |
| **Source file(s)** | Extract from `rfc-entity-realtime-integration.md` Appendix D + Task #116 output |
| **Lines** | ~400 (estimated) |
| **Assembly** | EXTRACT + GAP-FILL |
| **Status** | IN-PROGRESS |
| **Notes** | Scaffold has some conformance content. Task #116 is actively writing a dedicated conformance section. DX.8 (testing support) provides additional patterns. Combine when all sources available. |

### Appendix D: Research Document Index

| Field | Value |
|-------|-------|
| **Final title** | Research Document Index |
| **Source file(s)** | Task #115 output |
| **Lines** | ~200 (estimated) |
| **Assembly** | GAP-FILL |
| **Status** | IN-PROGRESS |
| **Notes** | Task #115 is actively writing this. Index of all `research-*.md` files and supporting documents that fed into the RFC. |

### Appendix E: Glossary & Acronyms

| Field | Value |
|-------|-------|
| **Final title** | Glossary & Acronyms |
| **Source file(s)** | Extract from `rfc-entity-realtime-integration.md` Appendix E |
| **Lines** | ~150 (estimated) |
| **Assembly** | EXTRACT |
| **Status** | PARTIAL |
| **Notes** | Scaffold contains a glossary appendix. Extract and ensure all terms from all 22 sections are covered. |

**Part V subtotal**: ~1,400 lines

---

## Assembly Summary

### Status Counts

| Status | Count | Sections |
|--------|-------|----------|
| **READY** | 22 | Sections 1-4, 6, 8-16, 17-22, Appendix A |
| **READY (MERGE)** | 5 | Sections 5, 7, 11, 13, 18 |
| **PARTIAL** | 2 | Appendices B, E (extractable from scaffold) |
| **IN-PROGRESS** | 2 | Appendices C, D (Tasks #115, #116) |

### Assembly Types

| Type | Count | Description |
|------|-------|-------------|
| **AS-IS** | 17 | Drop in directly: Sections 1-4, 6, 9-10, 12, 14-17, 19-22, Appendix A |
| **MERGE** | 5 | Combine 2 source files: Sections 5, 7, 11, 13, 18 |
| **EXTRACT** | 3 | Pull from scaffold: Section 8, Appendices B, E |
| **GAP-FILL** | 2 | Write/wait: Appendices C, D |

### Estimated Final Size

| Part | Sections | Estimated Lines |
|------|----------|-----------------|
| Part I: Context & Vision | 1-4 | 2,150 |
| Part II: Architecture | 5-10 | 6,200 |
| Part III: Infrastructure & Operations | 11-19 | 10,200 |
| Part IV: Developer & Operator Experience | 20-22 | 3,091 |
| Part V: Appendices | A-E | 1,400 |
| Front matter + TOC + connective tissue | -- | 500 |
| **Total (before dedup)** | **22 sections + 5 appendices** | **~23,500** |
| **Estimated final (after dedup)** | -- | **~19,000-21,000** |

---

## Assembly Sequence

### Wave 1: Structural Scaffolding

1. Create `TMNL-RFC-001.md` with front matter, document metadata, and Part headers
2. Generate Table of Contents skeleton with all 22 sections + 5 appendices
3. Drop in all 16 AS-IS sections in final order
4. Insert `<!-- PLACEHOLDER: Section N — [Title] -->` markers for MERGE/EXTRACT/GAP sections
5. Apply uniform header numbering: `## 1. Introduction & Vision`, `## 2. Theoretical Foundations`, etc.

### Wave 2: Merge Operations

6. **Section 5** (Multi-Tenant): Merge `multi-tenant-network.md` (primary) + `multi-tenant.md`
7. **Section 7** (Network Entities): Merge `network-entity-types.md` (formal) + `network-entities.md` (lifecycle detail)
8. **Section 9** (Consistency): Merge `two-domain-consistency.md` (normative) + `consistency-guarantees.md` (implementation)
9. **Section 11** (Edge): Merge `edge-architecture.md` (v1 canonical) + selective from v2
10. **Section 13** (Security): Merge `security-architecture.md` + selective from `security-trust.md`
11. **Section 18** (Observability): Merge `observability-framework.md` (primary) + selective from `observability.md`

### Wave 3: Extract Operations

12. **Section 8** (Entity-Realtime): Extract from scaffold `rfc-entity-realtime-integration.md`
13. **Appendix B** (Migration): Extract from scaffold Appendix C
14. **Appendix E** (Glossary): Extract from scaffold Appendix E

### Wave 4: Gap Resolution

15. **Appendix C** (Conformance): Incorporate Task #116 output when available
16. **Appendix D** (Research Index): Incorporate Task #115 output when available

> **Note**: Section 15 (Tenant Isolation) has LANDED (1,047 lines) and is now AS-IS. No gap-fill needed.

### Wave 5: Final Assembly

18. Renumber all internal cross-references (`Section N`, `[Section N]`)
19. Validate all `[KEY]` bibliography citations resolve to entries in `bibliography.md`
20. Generate final Table of Contents with markdown anchor links
21. Add document metadata block (version, date, authors, status, abstract)
22. Connective tissue: Add 1-2 sentence transitions between Parts
23. Final word/line count verification
24. Consistency audit checklist (terminology, formatting, citation style)

---

## Source File Index

| # | Source File | Lines | Maps To | Assembly | Status |
|---|------------|------:|---------|----------|--------|
| 1 | `rfc-section-introduction.md` | 288 | Section 1 | AS-IS | READY |
| 2 | `rfc-section-theoretical-foundations.md` | 579 | Section 2 | AS-IS | READY |
| 3 | `rfc-section-architectural-principles.md` | 637 | Section 3 | AS-IS | READY |
| 4 | `rfc-section-competitive-analysis.md` | 646 | Section 4 | AS-IS | READY |
| 5 | `rfc-section-multi-tenant-network.md` | 528 | Section 5 | MERGE (primary) | READY |
| 6 | `rfc-section-multi-tenant.md` | 566 | Section 5 | MERGE (secondary) | READY |
| 7 | `rfc-section-reactive-isa95.md` | 878 | Section 6 | AS-IS | READY |
| 8 | `rfc-section-network-entity-types.md` | 1,233 | Section 7 | MERGE (formal) | READY |
| 9 | `rfc-section-network-entities.md` | 1,491 | Section 7 | MERGE (lifecycle) | READY |
| 10 | `rfc-entity-realtime-integration.md` | 1,633 | Section 8 + App B/C/E | EXTRACT | READY |
| 11 | `rfc-section-two-domain-consistency.md` | 638 | Section 9 | MERGE (normative) | READY |
| 12 | `rfc-section-consistency-guarantees.md` | 479 | Section 9 | MERGE (implementation) | READY |
| 13 | `rfc-section-effect-architecture.md` | 791 | Section 10 | AS-IS | READY |
| 14 | `rfc-section-edge-architecture.md` | 1,640 | Section 11 | MERGE (canonical, D1) | READY |
| 15 | `rfc-section-edge-architecture-v2.md` | 1,053 | Section 11 | MERGE (supplement) | READY |
| 16 | `rfc-section-deployment-topology.md` | 817 | Section 12 | AS-IS | READY |
| 17 | `rfc-section-security-architecture.md` | 865 | Section 13 | MERGE (primary) | READY |
| 18 | `rfc-section-security-trust.md` | 796 | Section 13 + 15 | MERGE + EXTRACT | READY |
| 19 | `rfc-section-trust-model.md` | 834 | Section 14 | AS-IS | READY |
| 20 | `rfc-section-tenant-isolation.md` | 1,047 | Section 15 | AS-IS | READY |
| 21 | `rfc-section-failure-modes.md` | 949 | Section 16 | AS-IS | READY |
| 22 | `rfc-section-monitoring-infrastructure.md` | 659 | Section 17 | AS-IS | READY |
| 23 | `rfc-section-observability-framework.md` | 854 | Section 18 | MERGE (primary) | READY |
| 24 | `rfc-section-observability.md` | 781 | Section 18 | MERGE (secondary) | READY |
| 25 | `rfc-section-operational-runbooks.md` | 1,087 | Section 19 | AS-IS | READY |
| 26 | `rfc-section-developer-experience.md` | 1,064 | Section 20 | AS-IS | READY |
| 27 | `rfc-section-onboarding-protocol.md` | 1,130 | Section 21 | AS-IS | READY |
| 28 | `rfc-section-marketplace-protocol.md` | 897 | Section 22 | AS-IS | READY |
| 29 | `bibliography.md` | 443 | Appendix A | AS-IS | READY |
| 30 | `rfc-section-migration-upgrade.md` | 304 | Section 23 | AS-IS | READY |

**Total source lines**: 22,481 (across 30 files)

---

## Cross-Reference Matrix

Sections that reference each other (for link validation during assembly):

| Section | References To | Referenced By |
|---------|--------------|---------------|
| 1 (Introduction) | 2, 4, 5 | All sections (vision framing) |
| 2 (Theoretical) | Appendix A | 3, 6, 20 |
| 3 (Principles) | 2, 6, 10 | 5, 7, 13 |
| 4 (Competitive) | 1, 5 | 20, 21 |
| 5 (Multi-Tenant) | 6, 7, 13, 14, 15 | 1, 7, 11, 21, 22 |
| 6 (ISA-95) | 7, 8, 10 | 3, 5, 9, 20 |
| 7 (Entity Types) | 6, 8 | 5, 9, 20, 22 |
| 8 (Entity-Realtime) | 7, 9, 10 | 6, 16, 18, 20 |
| 9 (Consistency) | 7, 8, 16 | 6, 10, 11, 13 |
| 10 (Effect-TS) | 6, 7, 8, 9 | 3, 11, 20 |
| 11 (Edge) | 5, 12, 13 | 9, 16, 17 |
| 12 (Deployment) | 5, 11, 13 | 17, 19 |
| 13 (Security) | 5, 14, 15 | 3, 9, 11, 21 |
| 14 (Trust) | 5, 13 | 9, 22 |
| 15 (Tenant Isolation) | 5, 13, 14 | 7, 11 |
| 16 (Failure Modes) | 9, 11, 17, 18 | 8, 19 |
| 17 (Monitoring) | 11, 12, 16 | 18, 19 |
| 18 (Observability) | 16, 17 | 8, 19 |
| 19 (Runbooks) | 16, 17, 18 | 12 |
| 20 (DX) | 6, 7, 8, 10 | 2, 4, 21 |
| 21 (Onboarding) | 5, 13, 20 | 4, 22 |
| 22 (Marketplace) | 5, 7, 14, 21 | 1 |

---

## Merge Strategy Details

### Section 5: Multi-Tenant (MERGE)

```
PRIMARY:   rfc-section-multi-tenant-network.md (528 lines)
SECONDARY: rfc-section-multi-tenant.md (566 lines)

Strategy:
  - Use multi-tenant-network.md structure as backbone
  - Merge NATS account isolation detail from multi-tenant.md
  - Merge JetStream domain separation from multi-tenant.md
  - Deduplicate manufacturing commons system account sections
  - Estimated result: ~900 lines
```

### Section 7: Network Entities (MERGE)

```
PRIMARY:   rfc-section-network-entity-types.md (1,233 lines) — formal N.x spec
SECONDARY: rfc-section-network-entities.md (1,491 lines) — lifecycle detail

Strategy:
  - Use network-entity-types.md as the formal specification backbone
  - Merge entity lifecycle state machines from network-entities.md
  - Merge event-sourced vs CRUD boundary analysis
  - Merge EntityProxy patterns and cardinality model
  - Deduplicate entity type definitions
  - Estimated result: ~1,800 lines
```

### Section 9: Consistency (MERGE)

```
PRIMARY:   rfc-section-two-domain-consistency.md (638 lines) — normative X.x
SECONDARY: rfc-section-consistency-guarantees.md (479 lines) — implementation

Strategy:
  - Use two-domain-consistency.md as normative framework
  - Append implementation mapping from consistency-guarantees.md
  - G-1 through G-10 stay in normative section
  - NATS JetStream mapping, Effect patterns go in implementation subsection
  - Estimated result: ~1,000 lines
```

### Section 11: Edge Architecture (MERGE)

```
PRIMARY:   rfc-section-edge-architecture.md (1,640 lines) — canonical per D1
SECONDARY: rfc-section-edge-architecture-v2.md (1,053 lines) — supplement

Strategy:
  - v1 is the canonical structure (D1)
  - v2 supplements with: design philosophy, resource constraints,
    brownfield integration, bandwidth management, progressive enhancement
  - Merge v2 subsections that don't exist in v1
  - Where both cover same topic, prefer v1 (more complete)
  - Estimated result: ~1,800 lines
```

### Section 13: Security Architecture (MERGE)

```
PRIMARY:   rfc-section-security-architecture.md (865 lines) — S.x prefix
SECONDARY: rfc-section-security-trust.md (796 lines) — original Z.x compound

Strategy:
  - security-architecture.md supersedes Z.2-Z.5
  - Extract any unique mTLS detail, RBAC granularity from security-trust.md
  - Tenant isolation content from security-trust.md feeds Section 15
  - Estimated result: ~1,100 lines (Section 13) + ~500 lines (Section 15 extract)
```

### Section 18: Observability (MERGE)

```
PRIMARY:   rfc-section-observability-framework.md (854 lines) — OBS.x prefix
SECONDARY: rfc-section-observability.md (781 lines) — combined 18.x

Strategy:
  - observability-framework.md is the dedicated split (OBS.x)
  - observability.md has SLI/SLO framework and incident response detail
  - Merge SLI/SLO and incident response into framework section
  - Deduplicate OpenTelemetry and tracing subsections
  - Estimated result: ~1,100 lines
```

---

## Assembly Checklist

### Pre-Assembly

- [x] All AS-IS sections exist on disk with non-zero content
- [x] All MERGE source pairs identified with primary/secondary roles
- [x] Scaffold file identified for EXTRACT operations
- [x] Decisions D1-D4 documented and applied to manifest
- [x] Section numbering finalized (1-22 + Appendices A-E)
- [x] Cross-reference matrix documented
- [x] Merge strategies documented per section
- [x] Assembly wave sequence defined

### During Assembly

- [ ] Wave 1: All AS-IS sections inserted with uniform numbering
- [ ] Wave 2: All MERGE operations completed with deduplication
- [ ] Wave 3: All EXTRACT operations completed from scaffold
- [ ] Wave 4: Gap sections resolved or marked `<!-- TODO -->`
- [ ] Wave 5: Cross-references validated
- [ ] Wave 5: Bibliography citations validated
- [ ] Wave 5: TOC generated with anchor links
- [ ] Wave 5: Front matter and metadata added

### Post-Assembly

- [ ] Final line count verified (target: 18,000-20,000)
- [ ] No duplicate section headers
- [ ] No orphaned `<!-- PLACEHOLDER -->` markers
- [ ] All `[KEY]` citations resolve to `bibliography.md`
- [ ] Consistent terminology across all sections
- [ ] Consistent formatting (header levels, table styles, code blocks)
- [ ] Task #83 marked complete
