#!/usr/bin/env bash
# RFC-001 Assembly Script
# Merges all section files into the final monolithic RFC document.
# Run from: docs/specifications/
#
# Usage: bash assemble-rfc.sh > rfc-001-assembled.md

set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"

# Helper: strip per-file metadata headers (everything before first "---" after the title)
# Each section file starts with: # Title\n```\nmetadata\n```\n---\ncontent
strip_header() {
    local file="$1"
    # Find the line after the metadata block (first "---" that appears after line 1)
    # Then strip any "## References" footer section at the end
    awk '
    BEGIN { found_first_rule=0; past_header=0; in_references=0 }
    /^---$/ && !past_header { found_first_rule++; if (found_first_rule >= 1) { past_header=1; next } }
    past_header && /^## References$/ { in_references=1; next }
    past_header && /^## Citation Keys/ { in_references=1; next }
    past_header && /^### Citation Keys/ { in_references=1; next }
    past_header && in_references && /^## / { in_references=0 }
    past_header && !in_references { print }
    ' "$file"
}

# Helper: strip header but keep all content including references
strip_header_keep_refs() {
    local file="$1"
    awk '
    BEGIN { found_first_rule=0; past_header=0 }
    /^---$/ && !past_header { found_first_rule++; if (found_first_rule >= 1) { past_header=1; next } }
    past_header { print }
    ' "$file"
}

# Helper: extract section content from scaffold between two section headers
extract_scaffold_section() {
    local file="$1"
    local start_pattern="$2"
    local end_pattern="$3"
    awk -v start="$start_pattern" -v end="$end_pattern" '
    $0 ~ start { found=1 }
    found && $0 ~ end && NR > 1 { exit }
    found { print }
    ' "$file"
}

SCAFFOLD="$DIR/rfc-entity-realtime-integration.md"

cat << 'FRONTMATTER'
# RFC-001: Entity Lifecycle Event Distribution for Metropolitan-Scale Manufacturing Commons

```
RFC:           001
Title:         Entity Lifecycle Event Distribution for
               Metropolitan-Scale Manufacturing Commons
Status:        DRAFT
Authors:       TMNL Architecture Team
Created:       2026-02-09
Last Updated:  2026-02-09
Depends On:    ADR-004 (Entity System Architecture)
               Phase 5 (Realtime Stack — Epics 19, 20, 27)
               Holonet Integration Plan
Scale Target:  Metropolitan (200K+ organizations, 100+ sites/org,
               10K+ devices, 100K+ sensors)
```

---

## Abstract

This document specifies the architecture for entity lifecycle event distribution
across a metropolitan-scale manufacturing commons — a federated network of
200,000+ independent manufacturing organizations sharing capacity, intelligence,
and coordination through a common event distribution fabric.

The specification addresses three tightly coupled problems:

1. **Intra-organization entity observation**: A zero-handler-modification observer
   pattern leveraging `Machine.changes` on every `@effect/experimental/Machine`
   actor to capture all state transitions across 12 entity types without touching
   103 existing RPC handlers.

2. **Reactive ISA-95 propagation**: Formal rules for upward (U-1..U-4), downward
   (D-1..D-3), lateral (L-1..L-3), and outward (O-1..O-3) event propagation
   through a telescoping ISA-95 hierarchy that operates identically at 2 levels
   (machine shop) or 8 levels (enterprise supplier).

3. **Manufacturing commons architecture**: Multi-tenant network design where
   entity state transitions serve as market signals — a machine going IDLE is
   both an internal operational event and a network-level capacity advertisement
   — with NATS account-based tenant isolation, saga-eventual cross-org
   consistency, and formal trust and reputation models.

The architecture builds on an existing tested implementation: 15 entity types,
12 state machine graphs, 4-channel event distribution, Sparkplug-B ingestion,
and 4 streaming WebSocket RPCs.

---

## Status of This Memo

This document is a DRAFT specification. It is subject to revision as
implementation experience and architectural review inform the design.
Sections marked "LOOP OPEN" contain unresolved questions that MUST be
resolved before this RFC advances to ACCEPTED status.

---

## Conventions and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
document are to be interpreted as described in BCP 14 [RFC2119] [RFC8174]
when, and only when, they appear in ALL CAPITALS, as shown here.

### Definitions

| Term | Definition |
|------|------------|
| **organization** | A participating entity in the manufacturing commons — may be a 2-person machine shop or a Fortune 500 manufacturer |
| **entity** | An ISA-95 hierarchy node with lifecycle state, managed by `@effect/cluster/Entity` with a `@effect/experimental/Machine` actor |
| **entity event** | A `Schema.TaggedClass` event emitted on entity state change |
| **propagation rule** | An ISA-95 hierarchical event forwarding rule (U-*, D-*, L-*, O-*) |
| **manufacturing commons** | The federated 200K-org metropolitan manufacturing ecosystem |
| **telescoping hierarchy** | ISA-95 hierarchy at 1-8 levels per organization |
| **staleness budget** | Maximum acceptable age of cross-org aggregate data (G-8) |
| **saga-eventual consistency** | Cross-org consistency model with compensating transactions |
| **per-entity causal ordering** | Intra-org ordering guarantee (G-1) |
| **edge device** | Physical compute at the manufacturing site boundary |
| **NATS account** | NATS-level isolation boundary per organization |
| **JetStream domain** | Per-device or per-site JetStream persistence scope |
| **Effect entity** | An @effect/cluster Entity with sharded lifecycle |
| **Machine.changes** | A `Stream<Machine.State<M>>` on every Machine actor emitting state transitions |
| **EventDistribution** | Central event bus via ChannelService broadcast outlets |
| **HolonetBridge** | NATS transport bridge for distributed fan-out |

---

## Table of Contents

### Part I: Context (Informative)

- Section 1: Introduction and Vision
- Section 2: Competitive Differentiation and Industry Analysis
- Section 3: Theoretical Foundations and Architectural Principles

### Part II: Architecture (Normative)

- Section 4: Requirements
- Section 5: ISA-95 Event Taxonomy and Propagation Rules
- Section 6: Multi-Tenant Network Architecture
- Section 7: Entity Event Schema
- Section 8: Transport Layer and NATS Subject Hierarchy
- Section 9: Consistency Guarantees and Temporal Semantics

### Part III: Implementation (Normative)

- Section 10: Effect-TS Implementation Architecture
- Section 11: Observer Pattern and Entity Integration
- Section 12: Streaming RPC Extensions
- Section 13: Implementation Phases

### Part IV: Governance (Normative)

- Section 14: Security Architecture
- Section 15: Trust Model
- Section 16: Tenant Isolation
- Section 17: Failure Modes and Recovery
- Section 18: Observability Framework
- Section 19: Monitoring Infrastructure
- Section 20: Operational Runbooks
- Section 21: Migration and Upgrade Strategy
- Section 22: Conformance and Testing Requirements

### Part V: Supplementary (Informative)

- Section 23: Edge-First Architecture
- Section 24: Deployment Topology
- Section 25: Network Entity Types
- Section 26: Marketplace Protocol
- Section 27: Developer Experience
- Section 28: Onboarding Protocol
- Section 29: Reactive ISA-95 Hierarchy Specification
- Section 30: Multi-Tenant Design Patterns
- Appendix A: Research Document Index
- Appendix B: Revision History

---

═══════════════════════════════════════════════════════════════════════════
PART I: CONTEXT (Informative)
═══════════════════════════════════════════════════════════════════════════

FRONTMATTER

echo ""
echo "# Part I: Context"
echo ""

# --- SECTION 1: Introduction & Vision ---
echo "<!-- Source: rfc-section-introduction.md -->"
strip_header "$DIR/rfc-section-introduction.md"

echo ""
echo "---"
echo ""
echo "> *The gaps identified in this section motivate the theoretical framework"
echo "> that follows. Section 2 maps 10 incumbent platforms against the manufacturing"
echo "> commons model. Section 3 provides the cognitive science and systems theory"
echo "> foundations that constrain architectural decisions.*"
echo ""

# --- SECTION 2: Competitive Analysis ---
echo "<!-- Source: rfc-section-competitive-analysis.md -->"
strip_header "$DIR/rfc-section-competitive-analysis.md"

echo ""
echo "---"
echo ""

# --- SECTION 3: Theoretical Foundations ---
echo "<!-- Source: rfc-section-theoretical-foundations.md -->"
strip_header "$DIR/rfc-section-theoretical-foundations.md"

# --- SECTION 3b: Architectural Principles ---
echo ""
echo "<!-- Source: rfc-section-architectural-principles.md -->"
strip_header "$DIR/rfc-section-architectural-principles.md"

echo ""
echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo "PART II: ARCHITECTURE (Normative)"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""
echo "# Part II: Architecture"
echo ""

# --- SECTIONS 4-5: From scaffold (Requirements + ISA-95 Taxonomy + Propagation) ---
echo "<!-- Source: rfc-entity-realtime-integration.md Sections 4-5 -->"
# Extract sections 4 and 5 from scaffold
awk '/^## 4\. Requirements/,/^## 6\. Architecture/ { if (/^## 6\./) exit; print }' "$SCAFFOLD"

echo ""
echo "---"
echo ""
echo "> *The propagation rules defined above extend beyond a single organization"
echo "> via the outward rules O-1 through O-3. The following section specifies how"
echo "> the manufacturing commons architecture enables this cross-organizational"
echo "> event flow.*"
echo ""

# --- SECTION 6: Multi-Tenant Network Architecture ---
echo "<!-- Source: rfc-section-multi-tenant-network.md -->"
strip_header "$DIR/rfc-section-multi-tenant-network.md"

echo ""
echo "---"
echo ""

# --- SECTION 7: Entity Event Schema (from scaffold) ---
echo "<!-- Source: rfc-entity-realtime-integration.md Section 7 -->"
awk '/^## 7\. Entity Event Schema/,/^## 8\. Transport Layer/ { if (/^## 8\./) exit; print }' "$SCAFFOLD"

echo ""
echo "---"
echo ""

# --- SECTION 8: Transport Layer (from scaffold) ---
echo "<!-- Source: rfc-entity-realtime-integration.md Section 8 -->"
awk '/^## 8\. Transport Layer/,/^## 9\. Temporal Semantics/ { if (/^## 9\./) exit; print }' "$SCAFFOLD"

echo ""
echo "---"
echo ""

# --- SECTION 9: Consistency Guarantees ---
echo "<!-- Source: rfc-section-two-domain-consistency.md + rfc-section-consistency-guarantees.md -->"
strip_header "$DIR/rfc-section-two-domain-consistency.md"
echo ""
echo "---"
echo ""
echo "### Implementation Mapping: Consistency Guarantees"
echo ""
strip_header "$DIR/rfc-section-consistency-guarantees.md"

echo ""
echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo "PART III: IMPLEMENTATION (Normative)"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""
echo "# Part III: Implementation"
echo ""

# --- SECTION 10: Effect-TS Architecture ---
echo "<!-- Source: rfc-section-effect-architecture.md -->"
strip_header "$DIR/rfc-section-effect-architecture.md"

echo ""
echo "---"
echo ""

# --- SECTIONS 11-12: Observer + Streaming RPC (from scaffold) ---
echo "<!-- Source: rfc-entity-realtime-integration.md Sections 10-11 (Observer + Streaming RPC) -->"
awk '/^## 10\. Observer Implementation/,/^## 12\. Implementation Phases/ { if (/^## 12\./) exit; print }' "$SCAFFOLD"

echo ""
echo "---"
echo ""

# --- SECTION 13: Implementation Phases (from scaffold) ---
echo "<!-- Source: rfc-entity-realtime-integration.md Section 12 -->"
awk '/^## 12\. Implementation Phases/,/^## 13\. Security Considerations/ { if (/^## 13\./) exit; print }' "$SCAFFOLD"

echo ""
echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo "PART IV: GOVERNANCE (Normative)"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""
echo "# Part IV: Governance"
echo ""

# --- SECTION 14: Security Architecture ---
echo "<!-- Source: rfc-section-security-architecture.md -->"
strip_header "$DIR/rfc-section-security-architecture.md"

echo ""
echo "---"
echo ""

# --- SECTION 15: Trust Model ---
echo "<!-- Source: rfc-section-trust-model.md -->"
strip_header "$DIR/rfc-section-trust-model.md"

echo ""
echo "---"
echo ""

# --- SECTION 16: Tenant Isolation ---
echo "<!-- Source: rfc-section-tenant-isolation.md -->"
strip_header "$DIR/rfc-section-tenant-isolation.md"

echo ""
echo "---"
echo ""

# --- SECTION 17: Failure Modes ---
echo "<!-- Source: rfc-section-failure-modes.md -->"
strip_header "$DIR/rfc-section-failure-modes.md"

echo ""
echo "---"
echo ""

# --- SECTION 18: Observability Framework ---
echo "<!-- Source: rfc-section-observability-framework.md -->"
strip_header "$DIR/rfc-section-observability-framework.md"

echo ""
echo "---"
echo ""

# --- SECTION 19: Monitoring Infrastructure ---
echo "<!-- Source: rfc-section-monitoring-infrastructure.md -->"
strip_header "$DIR/rfc-section-monitoring-infrastructure.md"

echo ""
echo "---"
echo ""

# --- SECTION 20: Operational Runbooks ---
echo "<!-- Source: rfc-section-operational-runbooks.md -->"
strip_header "$DIR/rfc-section-operational-runbooks.md"

echo ""
echo "---"
echo ""

# --- SECTION 21: Migration & Upgrade ---
echo "<!-- Source: rfc-section-migration-upgrade.md -->"
strip_header "$DIR/rfc-section-migration-upgrade.md"

echo ""
echo "---"
echo ""

# --- SECTION 22: Conformance & Testing ---
echo "<!-- Source: rfc-section-conformance-testing.md -->"
strip_header "$DIR/rfc-section-conformance-testing.md"

echo ""
echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo "PART V: SUPPLEMENTARY (Informative)"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""
echo "# Part V: Supplementary Sections"
echo ""

# --- Edge Architecture ---
echo "<!-- Source: rfc-section-edge-architecture-v2.md -->"
strip_header "$DIR/rfc-section-edge-architecture-v2.md"

echo ""
echo "---"
echo ""

# --- Deployment Topology ---
echo "<!-- Source: rfc-section-deployment-topology.md -->"
strip_header "$DIR/rfc-section-deployment-topology.md"

echo ""
echo "---"
echo ""

# --- Network Entity Types ---
echo "<!-- Source: rfc-section-network-entity-types.md -->"
strip_header "$DIR/rfc-section-network-entity-types.md"

echo ""
echo "---"
echo ""

# --- Marketplace Protocol ---
echo "<!-- Source: rfc-section-marketplace-protocol.md -->"
strip_header "$DIR/rfc-section-marketplace-protocol.md"

echo ""
echo "---"
echo ""

# --- Developer Experience ---
echo "<!-- Source: rfc-section-developer-experience.md -->"
strip_header "$DIR/rfc-section-developer-experience.md"

echo ""
echo "---"
echo ""

# --- Onboarding Protocol ---
echo "<!-- Source: rfc-section-onboarding-protocol.md -->"
strip_header "$DIR/rfc-section-onboarding-protocol.md"

echo ""
echo "---"
echo ""

# --- Reactive ISA-95 ---
echo "<!-- Source: rfc-section-reactive-isa95.md -->"
strip_header "$DIR/rfc-section-reactive-isa95.md"

echo ""
echo "---"
echo ""

# --- Multi-Tenant Design Patterns ---
echo "<!-- Source: rfc-section-multi-tenant.md -->"
strip_header "$DIR/rfc-section-multi-tenant.md"

echo ""
echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo "APPENDICES"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""

# --- Appendix: Research Document Index ---
echo "## Appendix A: Research Document Index"
echo ""
echo "<!-- Source: rfc-section-appendix-research-index.md -->"
strip_header "$DIR/rfc-section-appendix-research-index.md"

echo ""
echo "---"
echo ""

# --- Appendix: Scaffold appendices ---
echo "## Appendix B: Entity Transition Catalog"
echo ""
awk '/^## Appendix A: Entity Transition Catalog/,/^## Appendix B:/ { if (/^## Appendix B:/) exit; print }' "$SCAFFOLD" | tail -n +2

echo ""
echo "---"
echo ""

echo "## Appendix C: Architecture Options Analysis"
echo ""
awk '/^## Appendix B: Architecture Options Analysis/,/^## Appendix C:/ { if (/^## Appendix C:/) exit; print }' "$SCAFFOLD" | tail -n +2

echo ""
echo "---"
echo ""

echo "## Appendix D: Codebase File Inventory"
echo ""
awk '/^## Appendix C: File Inventory/,/^## Appendix D:/ { if (/^## Appendix D:/) exit; print }' "$SCAFFOLD" | tail -n +2

echo ""
echo "---"
echo ""

echo "## Appendix E: Revision History"
echo ""
awk '/^## Appendix D: Revision History/,0' "$SCAFFOLD" | tail -n +2

echo ""
echo "---"
echo ""
echo "## End of RFC-001"
echo ""
echo "*This document was assembled from 28 independently authored section files"
echo "by 8 specialist agents, coordinated through the TMNL WBS orchestration system.*"
