# RFC-001 Assembly Plan — Final Document Structure

> **Author:** realtime-philosopher (Val)
> **Date:** 2026-02-09
> **Status:** Assembly blueprint — Revision 2 (style guide, ordering rationale, migration gap added)
> **Purpose:** Define the final RFC-001 structure, map all sections to source material, identify gaps

---

## 1. Document Inventory

### 1.1 RFC Drafts (2 files, 2,751 lines total)

| File | Lines | Content | Disposition |
|---|---|---|---|
| `entity-realtime-integration.md` | 1,131 | v1/v2 original RFC — 18 sections, appendices | **SUPERSEDED** by rfc-entity-realtime-integration.md |
| `rfc-entity-realtime-integration.md` | 1,620 | v3 expanded RFC — includes reactive ISA-95 propagation rules (Section 5.7), three-tier delivery model, extended NATS subjects | **PRIMARY SCAFFOLD** — the final document builds on this |

### 1.2 RFC Section Drafts (4 files, 2,196 lines total)

| File | Lines | Task | Author | Status | RFC Section |
|---|---|---|---|---|---|
| `rfc-section-competitive-analysis.md` | 537 | #67 | industry-analyst | COMPLETE | Section 2 |
| `rfc-section-multi-tenant-network.md` | 415 | #64 | temporal-analyst | COMPLETE | Section 6 |
| `rfc-section-two-domain-consistency.md` | 453 | #75 | temporal-analyst | COMPLETE | Section 9 |
| `rfc-section-effect-architecture.md` | 791 | #68 | effect-specialist | COMPLETE | Section 10 |

### 1.3 Completed RFC Sections (formerly in-progress, now delivered)

| Task | Author | File | Status | RFC Section |
|---|---|---|---|---|
| #66 | interface-visionary | `rfc-section-theoretical-foundations.md` | COMPLETE | Section 3 |
| #70 | consistency-theorist | `rfc-section-consistency-guarantees.md` | COMPLETE | Section 9 supplement |
| #77 | consistency-theorist | `rfc-section-security-trust.md` | COMPLETE | Section 14 |

### 1.4 Research Documents (9 files, 7,864 lines total)

| File | Lines | Content | Feeds Into |
|---|---|---|---|
| `research-reactive-isa95.md` | 1,016 | Propagation rules, event taxonomy, ISA-95 extensions | Sections 5, 7 |
| `research-consistency-models.md` | 1,185 | G-1 through G-7 guarantees, failure modes, replay | Section 9 |
| `research-industry-leaders.md` | 756 | 10-platform competitive analysis, 5 universal gaps | Section 2 |
| `research-theoretical-foundations.md` | 743 | Endsley SA, EID, CPS, information foraging | Section 3 |
| `research-effect-architecture.md` | 1,588 | Cluster, Machine, Schema, RPC, Stream, Layer at scale | Section 10 |
| `research-cluster-patterns.md` | 392 | Entity lifecycle, observation, migration, transport | Sections 8, 10 |
| `research-manufacturing-commons.md` | 808 | Platform economics, federation, telescoping ISA-95 | Sections 1, 6, 13 |
| `research-uns-metropolitan.md` | 733 | UNS patterns, NATS subject hierarchy, metropolitan scale | Section 8 |
| `research-architecture-options.md` | 643 | Observer pattern options analysis | Section 8, Appendix B |

### 1.5 Bibliography

| File | Lines | Entries |
|---|---|---|
| `bibliography.md` | 384+ | 190+ canonical [KEY] references |

---

## 2. Proposed Final RFC Structure

The final document should be organized as a single monolithic RFC following IETF memo conventions, with clear normative vs. informative sections.

### Section Map

```
RFC-001: Entity Lifecycle Event Distribution
for Metropolitan-Scale Manufacturing Commons
═══════════════════════════════════════════════

FRONT MATTER
  ├─ Abstract
  ├─ Status of This Memo
  ├─ Conventions and Terminology
  └─ Table of Contents

PART I: CONTEXT (Informative)
  ├─ Section 1:  Introduction & Vision ......................... rfc-section-introduction.md ✅
  ├─ Section 2:  Competitive Differentiation ................... rfc-section-competitive-analysis.md ✅
  └─ Section 3:  Theoretical Foundations ....................... rfc-section-theoretical-foundations.md ✅

PART II: ARCHITECTURE (Normative)
  ├─ Section 4:  Requirements .................................. from rfc-entity-realtime-integration.md §4 ✅
  ├─ Section 5:  ISA-95 Event Taxonomy & Propagation Rules ..... from rfc-entity-realtime-integration.md §5 ✅
  ├─ Section 6:  Multi-Tenant Network Architecture ............. rfc-section-multi-tenant-network.md ✅
  ├─ Section 7:  Entity Event Schema ........................... from rfc-entity-realtime-integration.md §7 ✅
  ├─ Section 8:  Transport Layer & NATS Subject Hierarchy ...... from rfc-entity-realtime-integration.md §8 ✅
  └─ Section 9:  Consistency Guarantees & Temporal Semantics .... rfc-section-two-domain-consistency.md
                                                                  + rfc-section-consistency-guarantees.md ✅

PART III: IMPLEMENTATION (Normative)
  ├─ Section 10: Effect-TS Implementation Architecture ......... rfc-section-effect-architecture.md ✅
  ├─ Section 11: Observer Pattern & Entity Integration ......... from rfc-entity-realtime-integration.md §10 ✅
  ├─ Section 12: Streaming RPC Extensions ...................... from rfc-entity-realtime-integration.md §11 ✅
  └─ Section 13: Implementation Phases ......................... from rfc-entity-realtime-integration.md §12 ✅

PART IV: GOVERNANCE (Normative)
  ├─ Section 14: Security, Trust & Tenant Isolation ............ rfc-section-security-trust.md ✅
  ├─ Section 15: Regulatory Compliance ......................... from existing RFC + commons governance (partial)
  ├─ Section 16: Migration & Upgrade Strategy .................. NEW — needs writing (see §10.1)
  └─ Section 17: Conformance & Testing Requirements ............ NEW — needs writing (see §10.2)

PART V: APPENDICES (Informative)
  ├─ Appendix A: Entity Transition Catalog ..................... from rfc-entity-realtime-integration.md Appendix A ✅
  ├─ Appendix B: Architecture Options Analysis ................. from rfc-entity-realtime-integration.md Appendix B ✅
  ├─ Appendix C: Codebase File Inventory ....................... from rfc-entity-realtime-integration.md Appendix C ✅
  ├─ Appendix D: Research Document Index ....................... NEW — links to all 9 research docs
  └─ Appendix E: Revision History .............................. from rfc-entity-realtime-integration.md Appendix D ✅

REFERENCES
  ├─ Normative References
  └─ Informative References
```

---

## 3. Section-by-Section Assembly Instructions

### FRONT MATTER

**Abstract**: Revise to reflect manufacturing commons scope. The current abstract focuses on single-org entity-realtime bridge. The final abstract must cover:
- Single-org entity lifecycle observation (original scope)
- Multi-tenant 200K-org metropolitan manufacturing network (reframe)
- Two-domain consistency model (intra-org + inter-org)
- Telescoping ISA-95 hierarchy
- Platform economics and federation

**Source**: Combine opening paragraphs from `rfc-entity-realtime-integration.md` with framing from `research-manufacturing-commons.md` Section 1.

**Terminology**: Merge terminology from `rfc-entity-realtime-integration.md` §1 with manufacturing commons terms: Organization, Capability Cluster, Manufacturing Commons, Telescoping Hierarchy, Staleness Budget, Saga-Eventually-Consistent.

---

### Section 1: Introduction & Vision

**Status**: COMPLETE (Task #82, realtime-philosopher)

**Source**: `rfc-section-introduction.md` (~200 lines)

**Assembly action**: Insert as-is. Covers: RFC scope (§1.1), motivation for manufacturing commons (§1.2), Ostrom's 8 principles mapped to architecture (§1.3), entity state as market signal (§1.4), telescoping ISA-95 with 3 concrete examples (§1.5), codebase foundation (§1.6), document structure guide (§1.7).

---

### Section 2: Competitive Differentiation & Industry Analysis

**Status**: COMPLETE

**Source**: `rfc-section-competitive-analysis.md` (537 lines)

**Assembly action**: Insert as-is. Verify all [KEY] citations exist in bibliography.md.

**Cross-references needed**:
- Section 5 (propagation rules) — G-1 gap references state machine patterns
- Section 10 (Effect-TS) — G-2 gap references cluster entity sharding
- Section 6 (multi-tenant) — manufacturing commons vs enterprise framing

---

### Section 3: Theoretical Foundations & Architectural Principles

**Status**: COMPLETE (Task #66, interface-visionary)

**Source**: `rfc-section-theoretical-foundations.md` + `research-theoretical-foundations.md` (743 lines)

**Assembly action**: Insert `rfc-section-theoretical-foundations.md`. Covers Endsley SA, EID, CPS theory, information foraging, P1-P12 architectural principles, and manufacturing commons governance foundations.

**Cross-references needed**:
- Section 9 (consistency) — temporal semantics principles
- Section 6 (multi-tenant) — network-derived intelligence enables SA Level 3

---

### Section 4: Requirements

**Status**: COMPLETE (in primary scaffold)

**Source**: `rfc-entity-realtime-integration.md` §4

**Assembly action**: Extract and revise. Add manufacturing commons requirements:
- R-N1: MUST support 200K concurrent organizations
- R-N2: MUST support telescoping ISA-95 hierarchy (1-8 levels)
- R-N3: MUST enforce data sovereignty per organization
- R-N4: MUST provide inter-org saga-eventual consistency
- R-N5: Edge device onboarding MUST complete within 15 minutes

---

### Section 5: ISA-95 Event Taxonomy & Propagation Rules

**Status**: COMPLETE (in primary scaffold, plus Task #65 completed)

**Source**: `rfc-entity-realtime-integration.md` §5 (includes propagation rules U-1..U-4, D-1..D-3, L-1..L-3, outward propagation O-1..O-3)

**Assembly action**: Extract as-is. This is the crown jewel — the reactive ISA-95 propagation model.

**Cross-references needed**:
- Section 6 (multi-tenant) — outward propagation (O-rules) feeds network marketplace
- Section 9 (consistency) — per-entity ordering guarantees apply to propagated events
- Section 10 (Effect-TS) — Machine.changes is the observation mechanism

---

### Section 6: Multi-Tenant Network Architecture

**Status**: COMPLETE

**Source**: `rfc-section-multi-tenant-network.md` (415 lines)

**Assembly action**: Insert, then extend with manufacturing commons material from `research-manufacturing-commons.md`:
- Telescoping hierarchy model (§5.2-5.3)
- NATS account federation (§4.2)
- Progressive capability tiers (§7.4)
- Edge-first architecture (§7.1-7.3)

---

### Section 7: Entity Event Schema

**Status**: COMPLETE (in primary scaffold)

**Source**: `rfc-entity-realtime-integration.md` §7

**Assembly action**: Extract. Add network-level event types from `research-manufacturing-commons.md` §6.3:
- `CapabilityAdvertised`, `AvailabilityChanged`, `JobPosted`, `JobAccepted`, `JobCompleted`
- `QualityVerified`, `DeliveryRated`, `DisputeRaised`

---

### Section 8: Transport Layer & NATS Subject Hierarchy

**Status**: COMPLETE (in primary scaffold)

**Source**: `rfc-entity-realtime-integration.md` §8 + `research-uns-metropolitan.md`

**Assembly action**: Extract. Extend NATS subjects for variable-depth org hierarchy per `research-manufacturing-commons.md` §5.4.

**Codebase grounding**:
- `src/lib/iiot/realtime/iiot-subjects.ts` — current subject specs
- `src/lib/iiot/realtime/holonet-bridge.ts` — NATS transport
- `src/lib/iiot/realtime/event-distribution.ts` — 4-channel hub

---

### Section 9: Consistency Guarantees & Temporal Semantics

**Status**: ALL SOURCES COMPLETE

**Sources** (3 documents to merge):
1. `rfc-section-two-domain-consistency.md` (453 lines) — Two-domain model, G-1..G-10/G-12, adaptive ISA-95 depth
2. `rfc-section-consistency-guarantees.md` (Task #70, COMPLETE) — Implementation mapping: which modules enforce which guarantees, consumer group constraints, recovery sequences
3. `rfc-entity-realtime-integration.md` §9 — Temporal semantics from original RFC

**Assembly action**: Use the two-domain consistency section as the normative specification ("what" MUST hold). Append the consistency guarantees section as the implementation mapping ("how" it is enforced). Extract any non-overlapping temporal semantics from the original RFC §9. Add staleness budget from `research-manufacturing-commons.md` §8.4.

**This is the most complex merge** — three sources, significant overlap. The two-domain model (intra-org vs inter-org) is the governing structure. The implementation mapping is its companion.

---

### Section 10: Effect-TS Implementation Architecture

**Status**: COMPLETE

**Source**: `rfc-section-effect-architecture.md` (791 lines)

**Assembly action**: Insert as-is. Already contains codebase file references.

**Cross-references needed**:
- Section 5 (propagation) — Machine.changes observation
- Section 8 (transport) — Entity cluster sharding
- Section 11 (observer) — implementation of Machine.changes pattern

---

### Section 11: Observer Pattern & Entity Integration

**Status**: COMPLETE (in primary scaffold)

**Source**: `rfc-entity-realtime-integration.md` §10

**Assembly action**: Extract. This is the core technical contribution — the zero-handler-modification observer pattern using Machine.changes.

---

### Section 12: Streaming RPC Extensions

**Status**: COMPLETE (in primary scaffold)

**Source**: `rfc-entity-realtime-integration.md` §11

**Assembly action**: Extract. Add network-level streaming RPCs: `SubscribeCapacity`, `SubscribeJobOffers`.

**Codebase grounding**:
- `src/lib/iiot/rpc/RealtimeRpcs.ts` — existing 4 streaming RPCs
- `src/lib/iiot/rpc/index.ts` — IIoTRpcs combined group

---

### Section 13: Implementation Phases

**Status**: COMPLETE (in primary scaffold)

**Source**: `rfc-entity-realtime-integration.md` §12

**Assembly action**: Extract. Extend with manufacturing commons phases:
- Phase 4: Multi-tenant NATS provisioning
- Phase 5: Network-level entities and marketplace
- Phase 6: Fleet intelligence and data cooperative

---

### Section 14: Security, Trust & Tenant Isolation

**Status**: COMPLETE (Task #77, consistency-theorist)

**Source**: `rfc-section-security-trust.md` + `rfc-entity-realtime-integration.md` §13

**Assembly action**: Insert `rfc-section-security-trust.md` as the primary. Covers: NATS account-based tenant isolation (Z.3), decentralized JWT authentication (Z.4), zero trust boundaries (Z.5), data sovereignty (Z.6), signal trustworthiness/G-10 (Z.7), audit trail/FDA 21 CFR Part 11 (Z.8), edge device trust (Z.9). Merge with `research-manufacturing-commons.md` §3.3 (selective disclosure), §4.1-4.4 (federation, governance).

---

### Section 15: Regulatory Compliance

**Status**: PARTIAL (in primary scaffold)

**Source**: `rfc-entity-realtime-integration.md` §16 (if present) + manufacturing commons governance

**Assembly action**: Expand with Ostrom's governance principles from `research-manufacturing-commons.md` §1.2. Add data cooperative governance from §4.4.

---

### Appendices

| Appendix | Source | Status |
|---|---|---|
| A: Entity Transition Catalog | `rfc-entity-realtime-integration.md` Appendix A | COMPLETE |
| B: Architecture Options Analysis | `rfc-entity-realtime-integration.md` Appendix B + `research-architecture-options.md` | COMPLETE |
| C: Codebase File Inventory | `rfc-entity-realtime-integration.md` Appendix C + `research-manufacturing-commons.md` §11 | COMPLETE |
| D: Research Document Index | NEW — links to all 9 research documents | NEEDS CREATION |
| E: Revision History | `rfc-entity-realtime-integration.md` Appendix D | COMPLETE |

---

## 4. Identified Gaps

### 4.1 Missing Sections (must be written)

| Gap | Description | Priority | Estimated Lines | Status |
|---|---|---|---|---|
| ~~Section 1: Introduction & Vision~~ | ~~Manufacturing commons thesis in RFC prose~~ | ~~HIGH~~ | ~~200~~ | **FILLED** (Task #82) |
| **Section 16: Migration & Upgrade Strategy** | Transition path from single-org to commons model | HIGH | ~150 | NEW GAP |
| **Section 17: Conformance & Testing** | Conformance levels, test suite structure | HIGH | ~100 | NEW GAP |
| **Network-level event types** | CapabilityAdvertised, JobPosted, etc. in Section 7 | MEDIUM | ~50 | OPEN |
| **Network-level RPCs** | SubscribeCapacity, PostJob in Section 12 | MEDIUM | ~50 | OPEN |
| **Implementation Phase 4-6** | Multi-tenant, marketplace, fleet intelligence in Section 13 | MEDIUM | ~100 | OPEN |
| **Appendix D: Research Index** | Links + 1-line summaries for all 9 research docs | LOW | ~40 | OPEN |

### 4.2 Previously Pending Section Drafts (ALL NOW COMPLETE)

| Task | Section | Agent | Status |
|---|---|---|---|
| #66 | Section 3: Theoretical Foundations | interface-visionary | COMPLETE — `rfc-section-theoretical-foundations.md` |
| #70 | Section 9 supplement: Failure Modes | consistency-theorist | COMPLETE — `rfc-section-consistency-guarantees.md` |
| #77 | Section 14: Security, Trust & Tenant Isolation | consistency-theorist | COMPLETE — `rfc-section-security-trust.md` |

All blocking dependencies are now resolved. Wave 3 (Pending Integrations) can proceed immediately.

### 4.3 Bridging Text Needed

Assembly requires bridging paragraphs at the following transitions:

| From | To | Bridge Topic |
|---|---|---|
| Section 2 (competitive analysis) | Section 3 (theory) | "These gaps motivate the following theoretical framework" |
| Section 5 (propagation rules) | Section 6 (multi-tenant) | "Propagation extends beyond single org via outward rules O-1..O-3" |
| Section 6 (multi-tenant) | Section 7 (event schema) | "The network architecture requires new event types beyond ISA-95" |
| Section 9 (consistency) | Section 10 (Effect-TS) | "These guarantees are implemented through the following Effect-TS architecture" |
| Section 10 (Effect-TS) | Section 11 (observer) | "The core observation mechanism leverages Machine.changes" |

---

## 5. Cross-Reference Matrix

This matrix identifies which sections reference which other sections. Assembly must verify all cross-references resolve.

| Section | References | Referenced By |
|---|---|---|
| 1 (Introduction) | — | 2, 6, 14 |
| 2 (Competitive) | 1, bibliography | 3, 6 |
| 3 (Theory) | bibliography | 5, 9 |
| 4 (Requirements) | 1, 5 | 8, 10, 11, 14, 17 |
| 5 (ISA-95 Taxonomy) | 3, 4, research-reactive-isa95 | 6, 7, 8, 9, 10, 11 |
| 6 (Multi-Tenant) | 1, 5, research-manufacturing-commons | 7, 8, 13, 14 |
| 7 (Event Schema) | 5, 6 | 8, 9, 11, 16 |
| 8 (Transport) | 5, 7, research-uns-metropolitan | 9, 10, 11 |
| 9 (Consistency) | 5, 7, 8, research-consistency-models | 10, 14, 17 |
| 10 (Effect-TS) | 5, 8, 9, research-effect-architecture | 11, 12, 17 |
| 11 (Observer) | 5, 7, 10 | 12, 13 |
| 12 (Streaming RPC) | 7, 11 | 13, 16 |
| 13 (Phases) | 4, 11, 12 | 16 |
| 14 (Security) | 6, 9 | 15, 17 |
| 15 (Regulatory) | 14 | — |
| 16 (Migration) | 7, 12, 13 | — |
| 17 (Conformance) | 4, 9, 10, 14 | — |

---

## 6. Assembly Sequencing

The final document SHOULD be assembled in this order to minimize rework:

### Wave 1: Structural Scaffolding (can start now)
1. Copy `rfc-entity-realtime-integration.md` as the base scaffold
2. Insert `rfc-section-competitive-analysis.md` as Section 2
3. Insert `rfc-section-multi-tenant-network.md` as Section 6
4. Insert `rfc-section-two-domain-consistency.md` as Section 9
5. Insert `rfc-section-effect-architecture.md` as Section 10

### Wave 2: Gap Filling (requires writing)
6. Write Section 1 (Introduction & Vision) — realtime-philosopher
7. Extend Section 7 with network-level event types
8. Extend Section 12 with network-level streaming RPCs
9. Extend Section 13 with implementation phases 4-6
10. Write Appendix D (Research Document Index)

### Wave 3: Section Integration (all drafts now delivered)
11. Insert `rfc-section-theoretical-foundations.md` as Section 3
12. Insert `rfc-section-consistency-guarantees.md` into Section 9 (companion to two-domain doc)
13. Insert `rfc-section-security-trust.md` as Section 14
14. Write Migration & Upgrade Strategy (see §10.1)
15. Write Conformance & Testing Requirements (see §10.2)

### Wave 4: Final Assembly (last pass)
16. Write all bridging paragraphs (§4.3 above)
17. Apply style guide (§9) — normalize voice, terminology, RFC 2119 usage
18. Replace all placeholder section numbers ("X.", "Z.") with actual numbers
19. Verify all cross-references resolve (§5 matrix)
20. Verify all [KEY] citations exist in bibliography.md
21. Number all tables and figures per §9.7 convention
22. Update Abstract to reflect final scope
23. Update Table of Contents
24. Final read-through for consistency and coherence

---

## 7. Estimated Final Document Size

| Part | Sections | Estimated Lines | Source Status |
|---|---|---|---|
| Front Matter | Abstract, Terminology, TOC | ~100 | NEEDS REVISION |
| Part I: Context | Sections 1-3 | ~1,000 | ALL COMPLETE |
| Part II: Architecture | Sections 4-9 | ~2,100 | ALL COMPLETE (some in primary scaffold) |
| Part III: Implementation | Sections 10-13 | ~1,400 | ALL COMPLETE |
| Part IV: Governance | Sections 14-15 + Migration + Conformance | ~650 | §14 COMPLETE, §15 partial, Migration/Conformance NEW |
| Part V: Appendices | A-E | ~600 | A-C COMPLETE, D NEW, E COMPLETE |
| References | Normative + Informative | ~100 | bibliography.md EXISTS |
| **TOTAL** | | **~5,950 lines** | |

Increased from the original ~5,100 estimate due to:
- All three pending section drafts now delivered (added ~400 lines over estimates)
- Migration & Upgrade Strategy section added (~150 lines)
- Conformance & Testing Requirements section added (~100 lines)
- Style normalization and bridging text (~100 lines)

This is large but appropriate for an RFC of this scope. The document covers:
- Single-org entity lifecycle observation (original scope)
- Metropolitan-scale manufacturing commons (reframe)
- 200K-org multi-tenant federation
- Full ISA-95 reactive hierarchy with propagation rules
- Two-domain consistency model with implementation mapping
- Effect-TS implementation architecture
- Competitive analysis against 10 incumbent platforms
- Security, trust, and regulatory compliance
- Migration strategy and conformance requirements

---

## 8. Section Ordering Rationale

The 15-section order is not arbitrary. It follows a **dependency-driven flow** where each section builds on concepts established by its predecessors. The reader should be able to read linearly without forward references to undefined concepts.

### Why This Order

| Section | Position Rationale |
|---|---|
| **1. Introduction & Vision** | FIRST — establishes the manufacturing commons thesis that reframes everything. A reader who skips this will misinterpret the RFC as "yet another enterprise IIoT platform." |
| **2. Competitive Analysis** | SECOND — proves the thesis by showing what exists, what fails, and why the commons model is different. Builds on Section 1's framing. |
| **3. Theoretical Foundations** | THIRD — provides the cognitive science and systems theory that constrain architectural decisions. Must precede architecture sections so that requirements like "SA Level 2 within 500ms" have a theoretical basis. |
| **4. Requirements** | Bridges context to architecture. Now that the reader knows WHY (1-3), this section states WHAT the system must do. All subsequent sections implement these requirements. |
| **5. ISA-95 Taxonomy** | The foundational data model. Every section after this references entity types, hierarchy levels, and propagation rules defined here. |
| **6. Multi-Tenant Network** | Extends the ISA-95 model from single-org to 200K-org. Must follow Section 5 because it adds the organization boundary concept ON TOP of ISA-95 hierarchy. |
| **7. Entity Event Schema** | Defines the wire format. Must follow Sections 5-6 because event schemas encode both ISA-95 entity types AND multi-tenant org boundaries. |
| **8. Transport Layer** | Specifies how events physically move (NATS subjects, JetStream streams). Must follow Section 7 because subject naming encodes the entity event schema. |
| **9. Consistency Guarantees** | The hardest section. Must follow Sections 5-8 because guarantees G-1 through G-10 reference specific entity types, subject hierarchies, and transport mechanisms. |
| **10. Effect-TS Architecture** | First implementation section. Must follow ALL architecture sections (4-9) because it implements every guarantee using specific Effect-TS patterns. |
| **11. Observer Pattern** | Core technical contribution. Must follow Section 10 because it uses Machine.changes, Entity sharding, and Layer composition defined there. |
| **12. Streaming RPCs** | Consumer-facing API. Must follow Section 11 because RPCs expose the observer pattern to external clients. |
| **13. Implementation Phases** | Roadmap. Must follow Sections 10-12 because phases reference specific implementation components. |
| **14. Security & Trust** | Governance section. Placed after implementation because security constraints reference specific transport (Section 8) and consistency (Section 9) mechanisms. |
| **15. Regulatory Compliance** | LAST normative section. Builds on security (14) and adds FDA, ISA-18.2, and Ostrom governance. Placed last because regulatory requirements constrain the entire system — the reader needs full system understanding first. |

### Dependency DAG

```
Section 1 ──► 2 ──► 3
                     │
                     ▼
              4 ◄────┘
              │
              ▼
              5 ──► 6 ──► 7 ──► 8 ──► 9
                                       │
                                       ▼
                    10 ◄───────────────┘
                    │
                    ▼
                    11 ──► 12 ──► 13
                                   │
                    14 ◄───────────┘
                    │
                    ▼
                    15
```

The critical path is: **1 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13**. Sections 2-3 are informative context. Sections 14-15 are governance overlays. This means Wave 1 assembly should prioritize the critical path sections.

---

## 9. Style Guide for Multi-Author Consistency

Seven different agents authored sections of this RFC. Without a style guide, the final document will read like a patchwork. This section defines the rules for harmonizing all contributions into a single coherent voice.

### 9.1 Voice and Tone

**Target voice**: Precise, authoritative, implementation-grounded. The RFC speaks as a single author — "this specification" or "the system" — never "we decided" or "our approach."

| Pattern | Use | Avoid |
|---|---|---|
| Passive technical | "Events are delivered within 500ms" | "We deliver events within 500ms" |
| Active system | "The entity service publishes a StateChanged event" | "Our service will publish events" |
| Imperative requirements | "Implementations MUST preserve ordering" | "You should preserve ordering" |
| Specific references | "See Section 5.3.2" | "As discussed above" or "as mentioned earlier" |

**Observed inconsistencies to fix during assembly**:

| Section | Current Style | Required Fix |
|---|---|---|
| Competitive Analysis (§2) | Colloquial, persuasive ("Every existing platform is a landlord model") | Acceptable in informative section, but soften the most aggressive prose |
| Two-Domain Consistency (§9) | Formal, uses placeholder section numbers ("X.2.1") | Replace "X." with actual section numbers during assembly |
| Effect Architecture (§10) | Technical, uses code-heavy prose with inline TypeScript | Good — keep, but ensure all code blocks have language annotations |
| Security (§14) | Formal, uses placeholder "Z." section numbers | Replace "Z." with actual section numbers during assembly |
| Consistency Guarantees (§9b) | Implementation-focused, uses "how" phrasing | Good complement to normative "what" in two-domain doc |

### 9.2 RFC 2119 Keyword Usage

All normative sections (Part II, III, IV) MUST use RFC 2119 keywords consistently:

| Keyword | Meaning | Use When |
|---|---|---|
| **MUST** | Absolute requirement | Violation breaks interoperability or safety |
| **MUST NOT** | Absolute prohibition | Action would cause data loss, security breach, or ordering violation |
| **SHOULD** | Strong recommendation | Deviation has known costs but is sometimes justified |
| **SHOULD NOT** | Strong discouragement | Action is harmful in most cases |
| **MAY** | Truly optional | Implementation choice with no interop impact |
| **RECOMMENDED** | Preferred approach | Stronger than MAY, weaker than SHOULD |

**Rules**:

1. Each normative section MUST include the RFC 2119 boilerplate paragraph at its start (already present in two-domain and security sections — verify all others).
2. RFC 2119 keywords MUST be capitalized when used normatively ("Implementations MUST...") and lowercase when used descriptively ("the system must handle...").
3. Informative sections (Part I, Appendices) SHOULD NOT use capitalized RFC 2119 keywords to avoid implying normativity.
4. Every MUST/MUST NOT requirement SHOULD be testable — if you cannot write a conformance test for it, downgrade to SHOULD.

### 9.3 Terminology Consistency

The following terms MUST be used consistently throughout the RFC. During assembly, search-and-replace any variants.

| Canonical Term | Variants to Replace | Definition |
|---|---|---|
| **organization** | org, tenant, company, shop, manufacturer | A participating entity in the manufacturing commons |
| **entity** | thing, asset, object, item | An ISA-95 hierarchy node with lifecycle state |
| **entity event** | state change, state transition, lifecycle event | A Schema.TaggedClass event emitted on entity state change |
| **propagation rule** | cascade, rollup, aggregation | An ISA-95 hierarchical event forwarding rule (U-*, D-*, L-*, O-*) |
| **manufacturing commons** | platform, network, marketplace | The federated 200K-org metropolitan manufacturing ecosystem |
| **telescoping hierarchy** | variable-depth, flexible hierarchy | ISA-95 hierarchy at 1-8 levels per organization |
| **staleness budget** | latency budget, freshness window | Maximum acceptable age of cross-org aggregate data (G-8) |
| **saga-eventual consistency** | eventual consistency (for cross-org) | Cross-org consistency model with compensating transactions |
| **per-entity causal ordering** | causal ordering, event ordering | Intra-org ordering guarantee (G-1) |
| **edge device** | gateway, edge node, IoT device | Physical compute at the manufacturing site boundary |
| **NATS account** | tenant namespace, org namespace | NATS-level isolation boundary per organization |
| **JetStream domain** | JetStream instance | Per-device or per-site JetStream persistence scope |
| **Effect entity** | cluster entity, sharded entity | An @effect/cluster Entity with sharded lifecycle |

### 9.4 Section Header Formatting

All sections MUST follow this header structure:

```markdown
## N. Section Title

### N.1 Subsection Title

#### N.1.1 Sub-subsection Title
```

Maximum depth: 4 levels (N.1.1.1). If deeper nesting is needed, restructure into a new subsection.

### 9.5 Code Block Conventions

| Convention | Standard |
|---|---|
| Language annotation | ALL code blocks MUST have language tag (```typescript, ```sql, etc.) |
| Import statements | Include only when necessary for understanding; omit standard Effect imports |
| Line length | Maximum 90 characters per line in code blocks |
| Comments | Use `// ←` for inline annotations pointing out key aspects |
| Pseudocode | Use ```text with clear pseudocode keywords (IF, FOR EACH, EMIT) |

### 9.6 Citation Format

All bibliographic references MUST use the canonical `[KEY]` format from `bibliography.md`:

```markdown
Correct:  "...as specified in JetStream [JETSTREAM]..."
Correct:  "...per the ISA-95 standard [ISA-95-1]..."
Wrong:    "...as described in the NATS documentation..."
Wrong:    "...according to (Endsley, 1995)..."
```

Every `[KEY]` citation MUST have a corresponding entry in `bibliography.md`. The bibliography audit (Task #79) will verify this.

### 9.7 Figure and Table Numbering

Tables and figures MUST be numbered by section:

```markdown
Table 5-1: ISA-95 Event Taxonomy
Table 5-2: Propagation Rule Summary
Figure 8-1: NATS Subject Hierarchy
Figure 10-1: Effect Layer Composition
```

Format: `{Table|Figure} {section}-{sequence}: {Title}`

---

## 10. Additional Identified Gaps

Beyond the gaps in Section 4, the team-lead's enhanced requirements surface two more critical sections:

### 10.1 Migration & Upgrade Strategy

**Gap**: The RFC defines the target architecture but does not address how existing single-org deployments transition to the manufacturing commons model.

**Required content**:
- Phase 0 → Phase 6 migration path from current codebase to full metropolitan deployment
- Backwards compatibility guarantees during migration (existing NATS subjects, event schemas)
- Feature flag strategy for incremental rollout (`src/lib/iiot/infrastructure/feature-flags.ts`)
- Schema evolution rules: additive-only changes for event schemas, versioned subjects for breaking changes
- Database migration for entity storage (current PostgreSQL → sharded multi-tenant)
- Edge device firmware update sequencing (rolling updates, no simultaneous fleet-wide pushes)

**Estimated lines**: ~150

**Sources**:
- `rfc-entity-realtime-integration.md` §12 (existing phase definitions)
- `research-manufacturing-commons.md` §7.4 (progressive capability tiers)
- Codebase: `src/lib/iiot/infrastructure/feature-flags.ts` (existing feature flag patterns)

### 10.2 Conformance & Testing Requirements

**Gap**: The RFC defines many MUST/SHOULD requirements but does not specify how implementations prove conformance.

**Required content**:
- Conformance levels (Level 1: single-org basic, Level 2: single-org full, Level 3: multi-tenant, Level 4: manufacturing commons)
- Test categories: ordering conformance (G-1..G-7), latency conformance (SLA table), security conformance (tenant isolation)
- Reference test suite structure (Effect-based property tests using `@effect/vitest`)
- Certification process for new organizations joining the manufacturing commons
- Interoperability testing between organizations (cross-org event delivery verification)

**Estimated lines**: ~100

**Sources**:
- Each normative section's MUST requirements (extracted during assembly)
- `rfc-section-consistency-guarantees.md` (implementation mapping provides test anchors)
- Existing test patterns in `src/lib/iiot/__tests__/`

---

## 11. Open Questions for Team-Lead

1. **Should the final document be monolithic or split?** The RFC is ~5K lines. Alternative: keep as modular section files and assemble only for publishing.

2. **Title update**: The current title is "Entity Lifecycle Event Distribution." Post-reframe, should it be "Entity Lifecycle Event Distribution for Metropolitan-Scale Manufacturing Commons"? The `rfc-entity-realtime-integration.md` already uses the metropolitan framing.

3. ~~**Introduction section authorship**~~: RESOLVED — realtime-philosopher drafted Section 1 as `rfc-section-introduction.md` (Task #82, complete).

4. **Assembly executor**: Who performs the final Wave 1 structural assembly? This is mechanical merging but requires careful section renumbering and cross-reference updates.

5. **Microservices section**: Task #51 (microservices-architect) is still in progress. Does the final RFC include a dedicated microservices/service architecture section, or is this covered by Section 10 (Effect-TS Implementation Architecture)?
