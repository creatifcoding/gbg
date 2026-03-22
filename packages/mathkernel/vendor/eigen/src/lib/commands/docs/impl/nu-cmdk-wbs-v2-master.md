# NuCmdk WBS v2 — Master Program Plan

**Status:** Active (hardened)
**Date:** 2026-02-15
**Scope:** Full NuCmdk architecture-to-production program
**Line target:** 2k–3k lines

---

## 1) Program intent

This WBS is the hardened execution plan for NuCmdk. It synthesizes initial design intent, decision locks, implementation slices, research findings, and spike evidence into a single operational backlog with explicit dependencies and evidence contracts.

Success means not just passing slices, but proving production-path behavior under real transport and persistence conditions while preserving interaction parity and safety invariants.

---

## 2) Source corpus used for synthesis

- `research/cmdk-effect-research.md`
- `research/nu-cmdk-questionnaire-results.md`
- `research/effect-http-layer-router-internal-notes.md`
- `arch/nu-cmdk-decision-lock.md`
- `arch/nu-cmdk-query-middleware-spec.md`
- `arch/nu-cmdk-provider-adapter-layer-router-decision.md`
- `arch/nu-cmdk-redteam-simulation-matrix.md`
- `impl/nu-cmdk-phased-plan.md`
- `impl/nu-cmdk-gap-analysis.md`
- `impl/spike/nu-cmdk-spike-testing-runbook.md`

---

## 3) Evidence tiers

- **T1** Unit/contract tests
- **T2** Slice integration tests
- **T3** Harness/spike runs
- **T4** Production-path validation

Every task declares required evidence tier and acceptance artifact.

---

## 4) Global gates

- GATE-A: No guardrail violations (policy/lane/selection).
- GATE-B: No seam regressions across minibuffer/overlays/hotkeys contracts.
- GATE-C: No visual churn beyond approved bug-fix scope.
- GATE-D: 12px typography floor enforced.
- GATE-E: Every ship candidate has T4 evidence.

---

## 5) Dependency strategy

- Epics are sequenced for evidence quality: governance -> runtime foundation -> realism -> integration -> rollout.
- Tasks with `depends_on` must not be advanced without upstream acceptance artifacts.
- All runtime changes must map to D01–D18 lock IDs.

---

## E00 — Program Governance & Source Traceability

**Epic objective:** Establish execution governance, traceability, and evidence discipline across the NuCmdk program.

### Capability map
- E00.C01 — Contract hardening
- E00.C02 — Runtime implementation
- E00.C03 — Validation and adversarial testing
- E00.C04 — Operational readiness

### E00.C01 Contract hardening

#### E00.T001 — Program Governance & Source Traceability: contract hardening work package 1
- **objective:** Deliver contract hardening increment 1 for program governance & source traceability.
- **scope:** `E00` capability lane, increment 1.
- **depends_on:** none
- **decision_links:** D01, D05, D10
- **owner:** commands-runtime
- **risk_level:** low
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E00.T002 — Program Governance & Source Traceability: contract hardening work package 2
- **objective:** Deliver contract hardening increment 2 for program governance & source traceability.
- **scope:** `E00` capability lane, increment 2.
- **depends_on:** E00.T001
- **decision_links:** D02, D06, D11
- **owner:** commands-ui
- **risk_level:** medium
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E00.T003 — Program Governance & Source Traceability: contract hardening work package 3
- **objective:** Deliver contract hardening increment 3 for program governance & source traceability.
- **scope:** `E00` capability lane, increment 3.
- **depends_on:** E00.T002
- **decision_links:** D03, D07, D12
- **owner:** infra-observability
- **risk_level:** high
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E00.T004 — Program Governance & Source Traceability: contract hardening work package 4
- **objective:** Deliver contract hardening increment 4 for program governance & source traceability.
- **scope:** `E00` capability lane, increment 4.
- **depends_on:** E00.T003
- **decision_links:** D04, D08, D13
- **owner:** search-platform
- **risk_level:** low
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E00.T005 — Program Governance & Source Traceability: contract hardening work package 5
- **objective:** Deliver contract hardening increment 5 for program governance & source traceability.
- **scope:** `E00` capability lane, increment 5.
- **depends_on:** E00.T004
- **decision_links:** D05, D09, D14
- **owner:** commands-runtime
- **risk_level:** medium
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E00.C02 Runtime implementation

#### E00.T006 — Program Governance & Source Traceability: runtime implementation work package 1
- **objective:** Deliver runtime implementation increment 1 for program governance & source traceability.
- **scope:** `E00` capability lane, increment 1.
- **depends_on:** E00.T005
- **decision_links:** D04, D08, D13
- **owner:** commands-runtime
- **risk_level:** medium
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E00.T007 — Program Governance & Source Traceability: runtime implementation work package 2
- **objective:** Deliver runtime implementation increment 2 for program governance & source traceability.
- **scope:** `E00` capability lane, increment 2.
- **depends_on:** E00.T006
- **decision_links:** D05, D09, D14
- **owner:** commands-ui
- **risk_level:** high
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E00.T008 — Program Governance & Source Traceability: runtime implementation work package 3
- **objective:** Deliver runtime implementation increment 3 for program governance & source traceability.
- **scope:** `E00` capability lane, increment 3.
- **depends_on:** E00.T007
- **decision_links:** D06, D10, D15
- **owner:** infra-observability
- **risk_level:** low
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E00.T009 — Program Governance & Source Traceability: runtime implementation work package 4
- **objective:** Deliver runtime implementation increment 4 for program governance & source traceability.
- **scope:** `E00` capability lane, increment 4.
- **depends_on:** E00.T008
- **decision_links:** D07, D11, D16
- **owner:** search-platform
- **risk_level:** medium
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E00.T010 — Program Governance & Source Traceability: runtime implementation work package 5
- **objective:** Deliver runtime implementation increment 5 for program governance & source traceability.
- **scope:** `E00` capability lane, increment 5.
- **depends_on:** E00.T009
- **decision_links:** D08, D12, D17
- **owner:** commands-runtime
- **risk_level:** high
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E00.C03 Validation and adversarial testing

#### E00.T011 — Program Governance & Source Traceability: validation and adversarial testing work package 1
- **objective:** Deliver validation and adversarial testing increment 1 for program governance & source traceability.
- **scope:** `E00` capability lane, increment 1.
- **depends_on:** E00.T010
- **decision_links:** D07, D11, D16
- **owner:** commands-runtime
- **risk_level:** high
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E00.T012 — Program Governance & Source Traceability: validation and adversarial testing work package 2
- **objective:** Deliver validation and adversarial testing increment 2 for program governance & source traceability.
- **scope:** `E00` capability lane, increment 2.
- **depends_on:** E00.T011
- **decision_links:** D08, D12, D17
- **owner:** commands-ui
- **risk_level:** low
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E00.T013 — Program Governance & Source Traceability: validation and adversarial testing work package 3
- **objective:** Deliver validation and adversarial testing increment 3 for program governance & source traceability.
- **scope:** `E00` capability lane, increment 3.
- **depends_on:** E00.T012
- **decision_links:** D09, D13, D18
- **owner:** infra-observability
- **risk_level:** medium
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E00.T014 — Program Governance & Source Traceability: validation and adversarial testing work package 4
- **objective:** Deliver validation and adversarial testing increment 4 for program governance & source traceability.
- **scope:** `E00` capability lane, increment 4.
- **depends_on:** E00.T013
- **decision_links:** D10, D14, D01
- **owner:** search-platform
- **risk_level:** high
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E00.T015 — Program Governance & Source Traceability: validation and adversarial testing work package 5
- **objective:** Deliver validation and adversarial testing increment 5 for program governance & source traceability.
- **scope:** `E00` capability lane, increment 5.
- **depends_on:** E00.T014
- **decision_links:** D11, D15, D02
- **owner:** commands-runtime
- **risk_level:** low
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E00.C04 Operational readiness

#### E00.T016 — Program Governance & Source Traceability: operational readiness work package 1
- **objective:** Deliver operational readiness increment 1 for program governance & source traceability.
- **scope:** `E00` capability lane, increment 1.
- **depends_on:** E00.T015
- **decision_links:** D10, D14, D01
- **owner:** commands-runtime
- **risk_level:** low
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E00.T017 — Program Governance & Source Traceability: operational readiness work package 2
- **objective:** Deliver operational readiness increment 2 for program governance & source traceability.
- **scope:** `E00` capability lane, increment 2.
- **depends_on:** E00.T016
- **decision_links:** D11, D15, D02
- **owner:** commands-ui
- **risk_level:** medium
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E00.T018 — Program Governance & Source Traceability: operational readiness work package 3
- **objective:** Deliver operational readiness increment 3 for program governance & source traceability.
- **scope:** `E00` capability lane, increment 3.
- **depends_on:** E00.T017
- **decision_links:** D12, D16, D03
- **owner:** infra-observability
- **risk_level:** high
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E00.T019 — Program Governance & Source Traceability: operational readiness work package 4
- **objective:** Deliver operational readiness increment 4 for program governance & source traceability.
- **scope:** `E00` capability lane, increment 4.
- **depends_on:** E00.T018
- **decision_links:** D13, D17, D04
- **owner:** search-platform
- **risk_level:** low
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E00.T020 — Program Governance & Source Traceability: operational readiness work package 5
- **objective:** Deliver operational readiness increment 5 for program governance & source traceability.
- **scope:** `E00` capability lane, increment 5.
- **depends_on:** E00.T019
- **decision_links:** D14, D18, D05
- **owner:** commands-runtime
- **risk_level:** medium
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

---

## E01 — Shell Scaffold & Compound Surface

**Epic objective:** Build the reusable shell/band/component architecture and contracts.

### Capability map
- E01.C01 — Contract hardening
- E01.C02 — Runtime implementation
- E01.C03 — Validation and adversarial testing
- E01.C04 — Operational readiness

### E01.C01 Contract hardening

#### E01.T001 — Shell Scaffold & Compound Surface: contract hardening work package 1
- **objective:** Deliver contract hardening increment 1 for shell scaffold & compound surface.
- **scope:** `E01` capability lane, increment 1.
- **depends_on:** none
- **decision_links:** D08, D12, D17
- **owner:** commands-ui
- **risk_level:** medium
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E01.T002 — Shell Scaffold & Compound Surface: contract hardening work package 2
- **objective:** Deliver contract hardening increment 2 for shell scaffold & compound surface.
- **scope:** `E01` capability lane, increment 2.
- **depends_on:** E01.T001
- **decision_links:** D09, D13, D18
- **owner:** infra-observability
- **risk_level:** high
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E01.T003 — Shell Scaffold & Compound Surface: contract hardening work package 3
- **objective:** Deliver contract hardening increment 3 for shell scaffold & compound surface.
- **scope:** `E01` capability lane, increment 3.
- **depends_on:** E01.T002
- **decision_links:** D10, D14, D01
- **owner:** search-platform
- **risk_level:** low
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E01.T004 — Shell Scaffold & Compound Surface: contract hardening work package 4
- **objective:** Deliver contract hardening increment 4 for shell scaffold & compound surface.
- **scope:** `E01` capability lane, increment 4.
- **depends_on:** E01.T003
- **decision_links:** D11, D15, D02
- **owner:** commands-runtime
- **risk_level:** medium
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E01.T005 — Shell Scaffold & Compound Surface: contract hardening work package 5
- **objective:** Deliver contract hardening increment 5 for shell scaffold & compound surface.
- **scope:** `E01` capability lane, increment 5.
- **depends_on:** E01.T004
- **decision_links:** D12, D16, D03
- **owner:** commands-ui
- **risk_level:** high
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E01.C02 Runtime implementation

#### E01.T006 — Shell Scaffold & Compound Surface: runtime implementation work package 1
- **objective:** Deliver runtime implementation increment 1 for shell scaffold & compound surface.
- **scope:** `E01` capability lane, increment 1.
- **depends_on:** E01.T005
- **decision_links:** D11, D15, D02
- **owner:** commands-ui
- **risk_level:** high
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E01.T007 — Shell Scaffold & Compound Surface: runtime implementation work package 2
- **objective:** Deliver runtime implementation increment 2 for shell scaffold & compound surface.
- **scope:** `E01` capability lane, increment 2.
- **depends_on:** E01.T006
- **decision_links:** D12, D16, D03
- **owner:** infra-observability
- **risk_level:** low
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E01.T008 — Shell Scaffold & Compound Surface: runtime implementation work package 3
- **objective:** Deliver runtime implementation increment 3 for shell scaffold & compound surface.
- **scope:** `E01` capability lane, increment 3.
- **depends_on:** E01.T007
- **decision_links:** D13, D17, D04
- **owner:** search-platform
- **risk_level:** medium
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E01.T009 — Shell Scaffold & Compound Surface: runtime implementation work package 4
- **objective:** Deliver runtime implementation increment 4 for shell scaffold & compound surface.
- **scope:** `E01` capability lane, increment 4.
- **depends_on:** E01.T008
- **decision_links:** D14, D18, D05
- **owner:** commands-runtime
- **risk_level:** high
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E01.T010 — Shell Scaffold & Compound Surface: runtime implementation work package 5
- **objective:** Deliver runtime implementation increment 5 for shell scaffold & compound surface.
- **scope:** `E01` capability lane, increment 5.
- **depends_on:** E01.T009
- **decision_links:** D15, D01, D06
- **owner:** commands-ui
- **risk_level:** low
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E01.C03 Validation and adversarial testing

#### E01.T011 — Shell Scaffold & Compound Surface: validation and adversarial testing work package 1
- **objective:** Deliver validation and adversarial testing increment 1 for shell scaffold & compound surface.
- **scope:** `E01` capability lane, increment 1.
- **depends_on:** E01.T010
- **decision_links:** D14, D18, D05
- **owner:** commands-ui
- **risk_level:** low
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E01.T012 — Shell Scaffold & Compound Surface: validation and adversarial testing work package 2
- **objective:** Deliver validation and adversarial testing increment 2 for shell scaffold & compound surface.
- **scope:** `E01` capability lane, increment 2.
- **depends_on:** E01.T011
- **decision_links:** D15, D01, D06
- **owner:** infra-observability
- **risk_level:** medium
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E01.T013 — Shell Scaffold & Compound Surface: validation and adversarial testing work package 3
- **objective:** Deliver validation and adversarial testing increment 3 for shell scaffold & compound surface.
- **scope:** `E01` capability lane, increment 3.
- **depends_on:** E01.T012
- **decision_links:** D16, D02, D07
- **owner:** search-platform
- **risk_level:** high
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E01.T014 — Shell Scaffold & Compound Surface: validation and adversarial testing work package 4
- **objective:** Deliver validation and adversarial testing increment 4 for shell scaffold & compound surface.
- **scope:** `E01` capability lane, increment 4.
- **depends_on:** E01.T013
- **decision_links:** D17, D03, D08
- **owner:** commands-runtime
- **risk_level:** low
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E01.T015 — Shell Scaffold & Compound Surface: validation and adversarial testing work package 5
- **objective:** Deliver validation and adversarial testing increment 5 for shell scaffold & compound surface.
- **scope:** `E01` capability lane, increment 5.
- **depends_on:** E01.T014
- **decision_links:** D18, D04, D09
- **owner:** commands-ui
- **risk_level:** medium
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E01.C04 Operational readiness

#### E01.T016 — Shell Scaffold & Compound Surface: operational readiness work package 1
- **objective:** Deliver operational readiness increment 1 for shell scaffold & compound surface.
- **scope:** `E01` capability lane, increment 1.
- **depends_on:** E01.T015
- **decision_links:** D17, D03, D08
- **owner:** commands-ui
- **risk_level:** medium
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E01.T017 — Shell Scaffold & Compound Surface: operational readiness work package 2
- **objective:** Deliver operational readiness increment 2 for shell scaffold & compound surface.
- **scope:** `E01` capability lane, increment 2.
- **depends_on:** E01.T016
- **decision_links:** D18, D04, D09
- **owner:** infra-observability
- **risk_level:** high
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E01.T018 — Shell Scaffold & Compound Surface: operational readiness work package 3
- **objective:** Deliver operational readiness increment 3 for shell scaffold & compound surface.
- **scope:** `E01` capability lane, increment 3.
- **depends_on:** E01.T017
- **decision_links:** D01, D05, D10
- **owner:** search-platform
- **risk_level:** low
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E01.T019 — Shell Scaffold & Compound Surface: operational readiness work package 4
- **objective:** Deliver operational readiness increment 4 for shell scaffold & compound surface.
- **scope:** `E01` capability lane, increment 4.
- **depends_on:** E01.T018
- **decision_links:** D02, D06, D11
- **owner:** commands-runtime
- **risk_level:** medium
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E01.T020 — Shell Scaffold & Compound Surface: operational readiness work package 5
- **objective:** Deliver operational readiness increment 5 for shell scaffold & compound surface.
- **scope:** `E01` capability lane, increment 5.
- **depends_on:** E01.T019
- **decision_links:** D03, D07, D12
- **owner:** commands-ui
- **risk_level:** high
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

---

## E02 — Schema Federation & Row Assembly

**Epic objective:** Implement pluggable variant schemas, decode pipelines, and row assembly invariants.

### Capability map
- E02.C01 — Contract hardening
- E02.C02 — Runtime implementation
- E02.C03 — Validation and adversarial testing
- E02.C04 — Operational readiness

### E02.C01 Contract hardening

#### E02.T001 — Schema Federation & Row Assembly: contract hardening work package 1
- **objective:** Deliver contract hardening increment 1 for schema federation & row assembly.
- **scope:** `E02` capability lane, increment 1.
- **depends_on:** none
- **decision_links:** D15, D01, D06
- **owner:** infra-observability
- **risk_level:** high
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E02.T002 — Schema Federation & Row Assembly: contract hardening work package 2
- **objective:** Deliver contract hardening increment 2 for schema federation & row assembly.
- **scope:** `E02` capability lane, increment 2.
- **depends_on:** E02.T001
- **decision_links:** D16, D02, D07
- **owner:** search-platform
- **risk_level:** low
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E02.T003 — Schema Federation & Row Assembly: contract hardening work package 3
- **objective:** Deliver contract hardening increment 3 for schema federation & row assembly.
- **scope:** `E02` capability lane, increment 3.
- **depends_on:** E02.T002
- **decision_links:** D17, D03, D08
- **owner:** commands-runtime
- **risk_level:** medium
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E02.T004 — Schema Federation & Row Assembly: contract hardening work package 4
- **objective:** Deliver contract hardening increment 4 for schema federation & row assembly.
- **scope:** `E02` capability lane, increment 4.
- **depends_on:** E02.T003
- **decision_links:** D18, D04, D09
- **owner:** commands-ui
- **risk_level:** high
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E02.T005 — Schema Federation & Row Assembly: contract hardening work package 5
- **objective:** Deliver contract hardening increment 5 for schema federation & row assembly.
- **scope:** `E02` capability lane, increment 5.
- **depends_on:** E02.T004
- **decision_links:** D01, D05, D10
- **owner:** infra-observability
- **risk_level:** low
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E02.C02 Runtime implementation

#### E02.T006 — Schema Federation & Row Assembly: runtime implementation work package 1
- **objective:** Deliver runtime implementation increment 1 for schema federation & row assembly.
- **scope:** `E02` capability lane, increment 1.
- **depends_on:** E02.T005
- **decision_links:** D18, D04, D09
- **owner:** infra-observability
- **risk_level:** low
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E02.T007 — Schema Federation & Row Assembly: runtime implementation work package 2
- **objective:** Deliver runtime implementation increment 2 for schema federation & row assembly.
- **scope:** `E02` capability lane, increment 2.
- **depends_on:** E02.T006
- **decision_links:** D01, D05, D10
- **owner:** search-platform
- **risk_level:** medium
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E02.T008 — Schema Federation & Row Assembly: runtime implementation work package 3
- **objective:** Deliver runtime implementation increment 3 for schema federation & row assembly.
- **scope:** `E02` capability lane, increment 3.
- **depends_on:** E02.T007
- **decision_links:** D02, D06, D11
- **owner:** commands-runtime
- **risk_level:** high
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E02.T009 — Schema Federation & Row Assembly: runtime implementation work package 4
- **objective:** Deliver runtime implementation increment 4 for schema federation & row assembly.
- **scope:** `E02` capability lane, increment 4.
- **depends_on:** E02.T008
- **decision_links:** D03, D07, D12
- **owner:** commands-ui
- **risk_level:** low
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E02.T010 — Schema Federation & Row Assembly: runtime implementation work package 5
- **objective:** Deliver runtime implementation increment 5 for schema federation & row assembly.
- **scope:** `E02` capability lane, increment 5.
- **depends_on:** E02.T009
- **decision_links:** D04, D08, D13
- **owner:** infra-observability
- **risk_level:** medium
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E02.C03 Validation and adversarial testing

#### E02.T011 — Schema Federation & Row Assembly: validation and adversarial testing work package 1
- **objective:** Deliver validation and adversarial testing increment 1 for schema federation & row assembly.
- **scope:** `E02` capability lane, increment 1.
- **depends_on:** E02.T010
- **decision_links:** D03, D07, D12
- **owner:** infra-observability
- **risk_level:** medium
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E02.T012 — Schema Federation & Row Assembly: validation and adversarial testing work package 2
- **objective:** Deliver validation and adversarial testing increment 2 for schema federation & row assembly.
- **scope:** `E02` capability lane, increment 2.
- **depends_on:** E02.T011
- **decision_links:** D04, D08, D13
- **owner:** search-platform
- **risk_level:** high
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E02.T013 — Schema Federation & Row Assembly: validation and adversarial testing work package 3
- **objective:** Deliver validation and adversarial testing increment 3 for schema federation & row assembly.
- **scope:** `E02` capability lane, increment 3.
- **depends_on:** E02.T012
- **decision_links:** D05, D09, D14
- **owner:** commands-runtime
- **risk_level:** low
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E02.T014 — Schema Federation & Row Assembly: validation and adversarial testing work package 4
- **objective:** Deliver validation and adversarial testing increment 4 for schema federation & row assembly.
- **scope:** `E02` capability lane, increment 4.
- **depends_on:** E02.T013
- **decision_links:** D06, D10, D15
- **owner:** commands-ui
- **risk_level:** medium
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E02.T015 — Schema Federation & Row Assembly: validation and adversarial testing work package 5
- **objective:** Deliver validation and adversarial testing increment 5 for schema federation & row assembly.
- **scope:** `E02` capability lane, increment 5.
- **depends_on:** E02.T014
- **decision_links:** D07, D11, D16
- **owner:** infra-observability
- **risk_level:** high
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E02.C04 Operational readiness

#### E02.T016 — Schema Federation & Row Assembly: operational readiness work package 1
- **objective:** Deliver operational readiness increment 1 for schema federation & row assembly.
- **scope:** `E02` capability lane, increment 1.
- **depends_on:** E02.T015
- **decision_links:** D06, D10, D15
- **owner:** infra-observability
- **risk_level:** high
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E02.T017 — Schema Federation & Row Assembly: operational readiness work package 2
- **objective:** Deliver operational readiness increment 2 for schema federation & row assembly.
- **scope:** `E02` capability lane, increment 2.
- **depends_on:** E02.T016
- **decision_links:** D07, D11, D16
- **owner:** search-platform
- **risk_level:** low
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E02.T018 — Schema Federation & Row Assembly: operational readiness work package 3
- **objective:** Deliver operational readiness increment 3 for schema federation & row assembly.
- **scope:** `E02` capability lane, increment 3.
- **depends_on:** E02.T017
- **decision_links:** D08, D12, D17
- **owner:** commands-runtime
- **risk_level:** medium
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E02.T019 — Schema Federation & Row Assembly: operational readiness work package 4
- **objective:** Deliver operational readiness increment 4 for schema federation & row assembly.
- **scope:** `E02` capability lane, increment 4.
- **depends_on:** E02.T018
- **decision_links:** D09, D13, D18
- **owner:** commands-ui
- **risk_level:** high
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E02.T020 — Schema Federation & Row Assembly: operational readiness work package 5
- **objective:** Deliver operational readiness increment 5 for schema federation & row assembly.
- **scope:** `E02` capability lane, increment 5.
- **depends_on:** E02.T019
- **decision_links:** D10, D14, D01
- **owner:** infra-observability
- **risk_level:** low
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

---

## E03 — Provider/Adapter LayerRouter Core

**Epic objective:** Operationalize adapter routing, cost-aware scheduling, and typed emits capabilities.

### Capability map
- E03.C01 — Contract hardening
- E03.C02 — Runtime implementation
- E03.C03 — Validation and adversarial testing
- E03.C04 — Operational readiness

### E03.C01 Contract hardening

#### E03.T001 — Provider/Adapter LayerRouter Core: contract hardening work package 1
- **objective:** Deliver contract hardening increment 1 for provider/adapter layerrouter core.
- **scope:** `E03` capability lane, increment 1.
- **depends_on:** none
- **decision_links:** D04, D08, D13
- **owner:** search-platform
- **risk_level:** low
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E03.T002 — Provider/Adapter LayerRouter Core: contract hardening work package 2
- **objective:** Deliver contract hardening increment 2 for provider/adapter layerrouter core.
- **scope:** `E03` capability lane, increment 2.
- **depends_on:** E03.T001
- **decision_links:** D05, D09, D14
- **owner:** commands-runtime
- **risk_level:** medium
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E03.T003 — Provider/Adapter LayerRouter Core: contract hardening work package 3
- **objective:** Deliver contract hardening increment 3 for provider/adapter layerrouter core.
- **scope:** `E03` capability lane, increment 3.
- **depends_on:** E03.T002
- **decision_links:** D06, D10, D15
- **owner:** commands-ui
- **risk_level:** high
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E03.T004 — Provider/Adapter LayerRouter Core: contract hardening work package 4
- **objective:** Deliver contract hardening increment 4 for provider/adapter layerrouter core.
- **scope:** `E03` capability lane, increment 4.
- **depends_on:** E03.T003
- **decision_links:** D07, D11, D16
- **owner:** infra-observability
- **risk_level:** low
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E03.T005 — Provider/Adapter LayerRouter Core: contract hardening work package 5
- **objective:** Deliver contract hardening increment 5 for provider/adapter layerrouter core.
- **scope:** `E03` capability lane, increment 5.
- **depends_on:** E03.T004
- **decision_links:** D08, D12, D17
- **owner:** search-platform
- **risk_level:** medium
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E03.C02 Runtime implementation

#### E03.T006 — Provider/Adapter LayerRouter Core: runtime implementation work package 1
- **objective:** Deliver runtime implementation increment 1 for provider/adapter layerrouter core.
- **scope:** `E03` capability lane, increment 1.
- **depends_on:** E03.T005
- **decision_links:** D07, D11, D16
- **owner:** search-platform
- **risk_level:** medium
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E03.T007 — Provider/Adapter LayerRouter Core: runtime implementation work package 2
- **objective:** Deliver runtime implementation increment 2 for provider/adapter layerrouter core.
- **scope:** `E03` capability lane, increment 2.
- **depends_on:** E03.T006
- **decision_links:** D08, D12, D17
- **owner:** commands-runtime
- **risk_level:** high
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E03.T008 — Provider/Adapter LayerRouter Core: runtime implementation work package 3
- **objective:** Deliver runtime implementation increment 3 for provider/adapter layerrouter core.
- **scope:** `E03` capability lane, increment 3.
- **depends_on:** E03.T007
- **decision_links:** D09, D13, D18
- **owner:** commands-ui
- **risk_level:** low
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E03.T009 — Provider/Adapter LayerRouter Core: runtime implementation work package 4
- **objective:** Deliver runtime implementation increment 4 for provider/adapter layerrouter core.
- **scope:** `E03` capability lane, increment 4.
- **depends_on:** E03.T008
- **decision_links:** D10, D14, D01
- **owner:** infra-observability
- **risk_level:** medium
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E03.T010 — Provider/Adapter LayerRouter Core: runtime implementation work package 5
- **objective:** Deliver runtime implementation increment 5 for provider/adapter layerrouter core.
- **scope:** `E03` capability lane, increment 5.
- **depends_on:** E03.T009
- **decision_links:** D11, D15, D02
- **owner:** search-platform
- **risk_level:** high
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E03.C03 Validation and adversarial testing

#### E03.T011 — Provider/Adapter LayerRouter Core: validation and adversarial testing work package 1
- **objective:** Deliver validation and adversarial testing increment 1 for provider/adapter layerrouter core.
- **scope:** `E03` capability lane, increment 1.
- **depends_on:** E03.T010
- **decision_links:** D10, D14, D01
- **owner:** search-platform
- **risk_level:** high
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E03.T012 — Provider/Adapter LayerRouter Core: validation and adversarial testing work package 2
- **objective:** Deliver validation and adversarial testing increment 2 for provider/adapter layerrouter core.
- **scope:** `E03` capability lane, increment 2.
- **depends_on:** E03.T011
- **decision_links:** D11, D15, D02
- **owner:** commands-runtime
- **risk_level:** low
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E03.T013 — Provider/Adapter LayerRouter Core: validation and adversarial testing work package 3
- **objective:** Deliver validation and adversarial testing increment 3 for provider/adapter layerrouter core.
- **scope:** `E03` capability lane, increment 3.
- **depends_on:** E03.T012
- **decision_links:** D12, D16, D03
- **owner:** commands-ui
- **risk_level:** medium
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E03.T014 — Provider/Adapter LayerRouter Core: validation and adversarial testing work package 4
- **objective:** Deliver validation and adversarial testing increment 4 for provider/adapter layerrouter core.
- **scope:** `E03` capability lane, increment 4.
- **depends_on:** E03.T013
- **decision_links:** D13, D17, D04
- **owner:** infra-observability
- **risk_level:** high
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E03.T015 — Provider/Adapter LayerRouter Core: validation and adversarial testing work package 5
- **objective:** Deliver validation and adversarial testing increment 5 for provider/adapter layerrouter core.
- **scope:** `E03` capability lane, increment 5.
- **depends_on:** E03.T014
- **decision_links:** D14, D18, D05
- **owner:** search-platform
- **risk_level:** low
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E03.C04 Operational readiness

#### E03.T016 — Provider/Adapter LayerRouter Core: operational readiness work package 1
- **objective:** Deliver operational readiness increment 1 for provider/adapter layerrouter core.
- **scope:** `E03` capability lane, increment 1.
- **depends_on:** E03.T015
- **decision_links:** D13, D17, D04
- **owner:** search-platform
- **risk_level:** low
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E03.T017 — Provider/Adapter LayerRouter Core: operational readiness work package 2
- **objective:** Deliver operational readiness increment 2 for provider/adapter layerrouter core.
- **scope:** `E03` capability lane, increment 2.
- **depends_on:** E03.T016
- **decision_links:** D14, D18, D05
- **owner:** commands-runtime
- **risk_level:** medium
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E03.T018 — Provider/Adapter LayerRouter Core: operational readiness work package 3
- **objective:** Deliver operational readiness increment 3 for provider/adapter layerrouter core.
- **scope:** `E03` capability lane, increment 3.
- **depends_on:** E03.T017
- **decision_links:** D15, D01, D06
- **owner:** commands-ui
- **risk_level:** high
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E03.T019 — Provider/Adapter LayerRouter Core: operational readiness work package 4
- **objective:** Deliver operational readiness increment 4 for provider/adapter layerrouter core.
- **scope:** `E03` capability lane, increment 4.
- **depends_on:** E03.T018
- **decision_links:** D16, D02, D07
- **owner:** infra-observability
- **risk_level:** low
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E03.T020 — Provider/Adapter LayerRouter Core: operational readiness work package 5
- **objective:** Deliver operational readiness increment 5 for provider/adapter layerrouter core.
- **scope:** `E03` capability lane, increment 5.
- **depends_on:** E03.T019
- **decision_links:** D17, D03, D08
- **owner:** search-platform
- **risk_level:** medium
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

---

## E04 — Middleware Platform

**Epic objective:** Deliver middleware registry, composition model, admission policies, and parity with HttpLayerRouter semantics.

### Capability map
- E04.C01 — Contract hardening
- E04.C02 — Runtime implementation
- E04.C03 — Validation and adversarial testing
- E04.C04 — Operational readiness

### E04.C01 Contract hardening

#### E04.T001 — Middleware Platform: contract hardening work package 1
- **objective:** Deliver contract hardening increment 1 for middleware platform.
- **scope:** `E04` capability lane, increment 1.
- **depends_on:** none
- **decision_links:** D11, D15, D02
- **owner:** commands-runtime
- **risk_level:** medium
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E04.T002 — Middleware Platform: contract hardening work package 2
- **objective:** Deliver contract hardening increment 2 for middleware platform.
- **scope:** `E04` capability lane, increment 2.
- **depends_on:** E04.T001
- **decision_links:** D12, D16, D03
- **owner:** commands-ui
- **risk_level:** high
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E04.T003 — Middleware Platform: contract hardening work package 3
- **objective:** Deliver contract hardening increment 3 for middleware platform.
- **scope:** `E04` capability lane, increment 3.
- **depends_on:** E04.T002
- **decision_links:** D13, D17, D04
- **owner:** infra-observability
- **risk_level:** low
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E04.T004 — Middleware Platform: contract hardening work package 4
- **objective:** Deliver contract hardening increment 4 for middleware platform.
- **scope:** `E04` capability lane, increment 4.
- **depends_on:** E04.T003
- **decision_links:** D14, D18, D05
- **owner:** search-platform
- **risk_level:** medium
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E04.T005 — Middleware Platform: contract hardening work package 5
- **objective:** Deliver contract hardening increment 5 for middleware platform.
- **scope:** `E04` capability lane, increment 5.
- **depends_on:** E04.T004
- **decision_links:** D15, D01, D06
- **owner:** commands-runtime
- **risk_level:** high
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E04.C02 Runtime implementation

#### E04.T006 — Middleware Platform: runtime implementation work package 1
- **objective:** Deliver runtime implementation increment 1 for middleware platform.
- **scope:** `E04` capability lane, increment 1.
- **depends_on:** E04.T005
- **decision_links:** D14, D18, D05
- **owner:** commands-runtime
- **risk_level:** high
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E04.T007 — Middleware Platform: runtime implementation work package 2
- **objective:** Deliver runtime implementation increment 2 for middleware platform.
- **scope:** `E04` capability lane, increment 2.
- **depends_on:** E04.T006
- **decision_links:** D15, D01, D06
- **owner:** commands-ui
- **risk_level:** low
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E04.T008 — Middleware Platform: runtime implementation work package 3
- **objective:** Deliver runtime implementation increment 3 for middleware platform.
- **scope:** `E04` capability lane, increment 3.
- **depends_on:** E04.T007
- **decision_links:** D16, D02, D07
- **owner:** infra-observability
- **risk_level:** medium
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E04.T009 — Middleware Platform: runtime implementation work package 4
- **objective:** Deliver runtime implementation increment 4 for middleware platform.
- **scope:** `E04` capability lane, increment 4.
- **depends_on:** E04.T008
- **decision_links:** D17, D03, D08
- **owner:** search-platform
- **risk_level:** high
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E04.T010 — Middleware Platform: runtime implementation work package 5
- **objective:** Deliver runtime implementation increment 5 for middleware platform.
- **scope:** `E04` capability lane, increment 5.
- **depends_on:** E04.T009
- **decision_links:** D18, D04, D09
- **owner:** commands-runtime
- **risk_level:** low
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E04.C03 Validation and adversarial testing

#### E04.T011 — Middleware Platform: validation and adversarial testing work package 1
- **objective:** Deliver validation and adversarial testing increment 1 for middleware platform.
- **scope:** `E04` capability lane, increment 1.
- **depends_on:** E04.T010
- **decision_links:** D17, D03, D08
- **owner:** commands-runtime
- **risk_level:** low
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E04.T012 — Middleware Platform: validation and adversarial testing work package 2
- **objective:** Deliver validation and adversarial testing increment 2 for middleware platform.
- **scope:** `E04` capability lane, increment 2.
- **depends_on:** E04.T011
- **decision_links:** D18, D04, D09
- **owner:** commands-ui
- **risk_level:** medium
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E04.T013 — Middleware Platform: validation and adversarial testing work package 3
- **objective:** Deliver validation and adversarial testing increment 3 for middleware platform.
- **scope:** `E04` capability lane, increment 3.
- **depends_on:** E04.T012
- **decision_links:** D01, D05, D10
- **owner:** infra-observability
- **risk_level:** high
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E04.T014 — Middleware Platform: validation and adversarial testing work package 4
- **objective:** Deliver validation and adversarial testing increment 4 for middleware platform.
- **scope:** `E04` capability lane, increment 4.
- **depends_on:** E04.T013
- **decision_links:** D02, D06, D11
- **owner:** search-platform
- **risk_level:** low
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E04.T015 — Middleware Platform: validation and adversarial testing work package 5
- **objective:** Deliver validation and adversarial testing increment 5 for middleware platform.
- **scope:** `E04` capability lane, increment 5.
- **depends_on:** E04.T014
- **decision_links:** D03, D07, D12
- **owner:** commands-runtime
- **risk_level:** medium
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E04.C04 Operational readiness

#### E04.T016 — Middleware Platform: operational readiness work package 1
- **objective:** Deliver operational readiness increment 1 for middleware platform.
- **scope:** `E04` capability lane, increment 1.
- **depends_on:** E04.T015
- **decision_links:** D02, D06, D11
- **owner:** commands-runtime
- **risk_level:** medium
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E04.T017 — Middleware Platform: operational readiness work package 2
- **objective:** Deliver operational readiness increment 2 for middleware platform.
- **scope:** `E04` capability lane, increment 2.
- **depends_on:** E04.T016
- **decision_links:** D03, D07, D12
- **owner:** commands-ui
- **risk_level:** high
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E04.T018 — Middleware Platform: operational readiness work package 3
- **objective:** Deliver operational readiness increment 3 for middleware platform.
- **scope:** `E04` capability lane, increment 3.
- **depends_on:** E04.T017
- **decision_links:** D04, D08, D13
- **owner:** infra-observability
- **risk_level:** low
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E04.T019 — Middleware Platform: operational readiness work package 4
- **objective:** Deliver operational readiness increment 4 for middleware platform.
- **scope:** `E04` capability lane, increment 4.
- **depends_on:** E04.T018
- **decision_links:** D05, D09, D14
- **owner:** search-platform
- **risk_level:** medium
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E04.T020 — Middleware Platform: operational readiness work package 5
- **objective:** Deliver operational readiness increment 5 for middleware platform.
- **scope:** `E04` capability lane, increment 5.
- **depends_on:** E04.T019
- **decision_links:** D06, D10, D15
- **owner:** commands-runtime
- **risk_level:** high
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

---

## E05 — Search Broker & QuerySession Runtime

**Epic objective:** Harden broker/session orchestration, lane lifecycle, and state consistency under stress.

### Capability map
- E05.C01 — Contract hardening
- E05.C02 — Runtime implementation
- E05.C03 — Validation and adversarial testing
- E05.C04 — Operational readiness

### E05.C01 Contract hardening

#### E05.T001 — Search Broker & QuerySession Runtime: contract hardening work package 1
- **objective:** Deliver contract hardening increment 1 for search broker & querysession runtime.
- **scope:** `E05` capability lane, increment 1.
- **depends_on:** none
- **decision_links:** D18, D04, D09
- **owner:** commands-ui
- **risk_level:** high
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E05.T002 — Search Broker & QuerySession Runtime: contract hardening work package 2
- **objective:** Deliver contract hardening increment 2 for search broker & querysession runtime.
- **scope:** `E05` capability lane, increment 2.
- **depends_on:** E05.T001
- **decision_links:** D01, D05, D10
- **owner:** infra-observability
- **risk_level:** low
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E05.T003 — Search Broker & QuerySession Runtime: contract hardening work package 3
- **objective:** Deliver contract hardening increment 3 for search broker & querysession runtime.
- **scope:** `E05` capability lane, increment 3.
- **depends_on:** E05.T002
- **decision_links:** D02, D06, D11
- **owner:** search-platform
- **risk_level:** medium
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E05.T004 — Search Broker & QuerySession Runtime: contract hardening work package 4
- **objective:** Deliver contract hardening increment 4 for search broker & querysession runtime.
- **scope:** `E05` capability lane, increment 4.
- **depends_on:** E05.T003
- **decision_links:** D03, D07, D12
- **owner:** commands-runtime
- **risk_level:** high
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E05.T005 — Search Broker & QuerySession Runtime: contract hardening work package 5
- **objective:** Deliver contract hardening increment 5 for search broker & querysession runtime.
- **scope:** `E05` capability lane, increment 5.
- **depends_on:** E05.T004
- **decision_links:** D04, D08, D13
- **owner:** commands-ui
- **risk_level:** low
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E05.C02 Runtime implementation

#### E05.T006 — Search Broker & QuerySession Runtime: runtime implementation work package 1
- **objective:** Deliver runtime implementation increment 1 for search broker & querysession runtime.
- **scope:** `E05` capability lane, increment 1.
- **depends_on:** E05.T005
- **decision_links:** D03, D07, D12
- **owner:** commands-ui
- **risk_level:** low
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E05.T007 — Search Broker & QuerySession Runtime: runtime implementation work package 2
- **objective:** Deliver runtime implementation increment 2 for search broker & querysession runtime.
- **scope:** `E05` capability lane, increment 2.
- **depends_on:** E05.T006
- **decision_links:** D04, D08, D13
- **owner:** infra-observability
- **risk_level:** medium
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E05.T008 — Search Broker & QuerySession Runtime: runtime implementation work package 3
- **objective:** Deliver runtime implementation increment 3 for search broker & querysession runtime.
- **scope:** `E05` capability lane, increment 3.
- **depends_on:** E05.T007
- **decision_links:** D05, D09, D14
- **owner:** search-platform
- **risk_level:** high
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E05.T009 — Search Broker & QuerySession Runtime: runtime implementation work package 4
- **objective:** Deliver runtime implementation increment 4 for search broker & querysession runtime.
- **scope:** `E05` capability lane, increment 4.
- **depends_on:** E05.T008
- **decision_links:** D06, D10, D15
- **owner:** commands-runtime
- **risk_level:** low
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E05.T010 — Search Broker & QuerySession Runtime: runtime implementation work package 5
- **objective:** Deliver runtime implementation increment 5 for search broker & querysession runtime.
- **scope:** `E05` capability lane, increment 5.
- **depends_on:** E05.T009
- **decision_links:** D07, D11, D16
- **owner:** commands-ui
- **risk_level:** medium
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E05.C03 Validation and adversarial testing

#### E05.T011 — Search Broker & QuerySession Runtime: validation and adversarial testing work package 1
- **objective:** Deliver validation and adversarial testing increment 1 for search broker & querysession runtime.
- **scope:** `E05` capability lane, increment 1.
- **depends_on:** E05.T010
- **decision_links:** D06, D10, D15
- **owner:** commands-ui
- **risk_level:** medium
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E05.T012 — Search Broker & QuerySession Runtime: validation and adversarial testing work package 2
- **objective:** Deliver validation and adversarial testing increment 2 for search broker & querysession runtime.
- **scope:** `E05` capability lane, increment 2.
- **depends_on:** E05.T011
- **decision_links:** D07, D11, D16
- **owner:** infra-observability
- **risk_level:** high
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E05.T013 — Search Broker & QuerySession Runtime: validation and adversarial testing work package 3
- **objective:** Deliver validation and adversarial testing increment 3 for search broker & querysession runtime.
- **scope:** `E05` capability lane, increment 3.
- **depends_on:** E05.T012
- **decision_links:** D08, D12, D17
- **owner:** search-platform
- **risk_level:** low
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E05.T014 — Search Broker & QuerySession Runtime: validation and adversarial testing work package 4
- **objective:** Deliver validation and adversarial testing increment 4 for search broker & querysession runtime.
- **scope:** `E05` capability lane, increment 4.
- **depends_on:** E05.T013
- **decision_links:** D09, D13, D18
- **owner:** commands-runtime
- **risk_level:** medium
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E05.T015 — Search Broker & QuerySession Runtime: validation and adversarial testing work package 5
- **objective:** Deliver validation and adversarial testing increment 5 for search broker & querysession runtime.
- **scope:** `E05` capability lane, increment 5.
- **depends_on:** E05.T014
- **decision_links:** D10, D14, D01
- **owner:** commands-ui
- **risk_level:** high
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E05.C04 Operational readiness

#### E05.T016 — Search Broker & QuerySession Runtime: operational readiness work package 1
- **objective:** Deliver operational readiness increment 1 for search broker & querysession runtime.
- **scope:** `E05` capability lane, increment 1.
- **depends_on:** E05.T015
- **decision_links:** D09, D13, D18
- **owner:** commands-ui
- **risk_level:** high
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E05.T017 — Search Broker & QuerySession Runtime: operational readiness work package 2
- **objective:** Deliver operational readiness increment 2 for search broker & querysession runtime.
- **scope:** `E05` capability lane, increment 2.
- **depends_on:** E05.T016
- **decision_links:** D10, D14, D01
- **owner:** infra-observability
- **risk_level:** low
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E05.T018 — Search Broker & QuerySession Runtime: operational readiness work package 3
- **objective:** Deliver operational readiness increment 3 for search broker & querysession runtime.
- **scope:** `E05` capability lane, increment 3.
- **depends_on:** E05.T017
- **decision_links:** D11, D15, D02
- **owner:** search-platform
- **risk_level:** medium
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E05.T019 — Search Broker & QuerySession Runtime: operational readiness work package 4
- **objective:** Deliver operational readiness increment 4 for search broker & querysession runtime.
- **scope:** `E05` capability lane, increment 4.
- **depends_on:** E05.T018
- **decision_links:** D12, D16, D03
- **owner:** commands-runtime
- **risk_level:** high
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E05.T020 — Search Broker & QuerySession Runtime: operational readiness work package 5
- **objective:** Deliver operational readiness increment 5 for search broker & querysession runtime.
- **scope:** `E05` capability lane, increment 5.
- **depends_on:** E05.T019
- **decision_links:** D13, D17, D04
- **owner:** commands-ui
- **risk_level:** low
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

---

## E06 — Ranking, Categorization, and Selection Stability

**Epic objective:** Implement deterministic incremental ranking/categorization and stable selection behavior.

### Capability map
- E06.C01 — Contract hardening
- E06.C02 — Runtime implementation
- E06.C03 — Validation and adversarial testing
- E06.C04 — Operational readiness

### E06.C01 Contract hardening

#### E06.T001 — Ranking, Categorization, and Selection Stability: contract hardening work package 1
- **objective:** Deliver contract hardening increment 1 for ranking, categorization, and selection stability.
- **scope:** `E06` capability lane, increment 1.
- **depends_on:** none
- **decision_links:** D07, D11, D16
- **owner:** infra-observability
- **risk_level:** low
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E06.T002 — Ranking, Categorization, and Selection Stability: contract hardening work package 2
- **objective:** Deliver contract hardening increment 2 for ranking, categorization, and selection stability.
- **scope:** `E06` capability lane, increment 2.
- **depends_on:** E06.T001
- **decision_links:** D08, D12, D17
- **owner:** search-platform
- **risk_level:** medium
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E06.T003 — Ranking, Categorization, and Selection Stability: contract hardening work package 3
- **objective:** Deliver contract hardening increment 3 for ranking, categorization, and selection stability.
- **scope:** `E06` capability lane, increment 3.
- **depends_on:** E06.T002
- **decision_links:** D09, D13, D18
- **owner:** commands-runtime
- **risk_level:** high
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E06.T004 — Ranking, Categorization, and Selection Stability: contract hardening work package 4
- **objective:** Deliver contract hardening increment 4 for ranking, categorization, and selection stability.
- **scope:** `E06` capability lane, increment 4.
- **depends_on:** E06.T003
- **decision_links:** D10, D14, D01
- **owner:** commands-ui
- **risk_level:** low
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E06.T005 — Ranking, Categorization, and Selection Stability: contract hardening work package 5
- **objective:** Deliver contract hardening increment 5 for ranking, categorization, and selection stability.
- **scope:** `E06` capability lane, increment 5.
- **depends_on:** E06.T004
- **decision_links:** D11, D15, D02
- **owner:** infra-observability
- **risk_level:** medium
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E06.C02 Runtime implementation

#### E06.T006 — Ranking, Categorization, and Selection Stability: runtime implementation work package 1
- **objective:** Deliver runtime implementation increment 1 for ranking, categorization, and selection stability.
- **scope:** `E06` capability lane, increment 1.
- **depends_on:** E06.T005
- **decision_links:** D10, D14, D01
- **owner:** infra-observability
- **risk_level:** medium
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E06.T007 — Ranking, Categorization, and Selection Stability: runtime implementation work package 2
- **objective:** Deliver runtime implementation increment 2 for ranking, categorization, and selection stability.
- **scope:** `E06` capability lane, increment 2.
- **depends_on:** E06.T006
- **decision_links:** D11, D15, D02
- **owner:** search-platform
- **risk_level:** high
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E06.T008 — Ranking, Categorization, and Selection Stability: runtime implementation work package 3
- **objective:** Deliver runtime implementation increment 3 for ranking, categorization, and selection stability.
- **scope:** `E06` capability lane, increment 3.
- **depends_on:** E06.T007
- **decision_links:** D12, D16, D03
- **owner:** commands-runtime
- **risk_level:** low
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E06.T009 — Ranking, Categorization, and Selection Stability: runtime implementation work package 4
- **objective:** Deliver runtime implementation increment 4 for ranking, categorization, and selection stability.
- **scope:** `E06` capability lane, increment 4.
- **depends_on:** E06.T008
- **decision_links:** D13, D17, D04
- **owner:** commands-ui
- **risk_level:** medium
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E06.T010 — Ranking, Categorization, and Selection Stability: runtime implementation work package 5
- **objective:** Deliver runtime implementation increment 5 for ranking, categorization, and selection stability.
- **scope:** `E06` capability lane, increment 5.
- **depends_on:** E06.T009
- **decision_links:** D14, D18, D05
- **owner:** infra-observability
- **risk_level:** high
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E06.C03 Validation and adversarial testing

#### E06.T011 — Ranking, Categorization, and Selection Stability: validation and adversarial testing work package 1
- **objective:** Deliver validation and adversarial testing increment 1 for ranking, categorization, and selection stability.
- **scope:** `E06` capability lane, increment 1.
- **depends_on:** E06.T010
- **decision_links:** D13, D17, D04
- **owner:** infra-observability
- **risk_level:** high
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E06.T012 — Ranking, Categorization, and Selection Stability: validation and adversarial testing work package 2
- **objective:** Deliver validation and adversarial testing increment 2 for ranking, categorization, and selection stability.
- **scope:** `E06` capability lane, increment 2.
- **depends_on:** E06.T011
- **decision_links:** D14, D18, D05
- **owner:** search-platform
- **risk_level:** low
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E06.T013 — Ranking, Categorization, and Selection Stability: validation and adversarial testing work package 3
- **objective:** Deliver validation and adversarial testing increment 3 for ranking, categorization, and selection stability.
- **scope:** `E06` capability lane, increment 3.
- **depends_on:** E06.T012
- **decision_links:** D15, D01, D06
- **owner:** commands-runtime
- **risk_level:** medium
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E06.T014 — Ranking, Categorization, and Selection Stability: validation and adversarial testing work package 4
- **objective:** Deliver validation and adversarial testing increment 4 for ranking, categorization, and selection stability.
- **scope:** `E06` capability lane, increment 4.
- **depends_on:** E06.T013
- **decision_links:** D16, D02, D07
- **owner:** commands-ui
- **risk_level:** high
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E06.T015 — Ranking, Categorization, and Selection Stability: validation and adversarial testing work package 5
- **objective:** Deliver validation and adversarial testing increment 5 for ranking, categorization, and selection stability.
- **scope:** `E06` capability lane, increment 5.
- **depends_on:** E06.T014
- **decision_links:** D17, D03, D08
- **owner:** infra-observability
- **risk_level:** low
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E06.C04 Operational readiness

#### E06.T016 — Ranking, Categorization, and Selection Stability: operational readiness work package 1
- **objective:** Deliver operational readiness increment 1 for ranking, categorization, and selection stability.
- **scope:** `E06` capability lane, increment 1.
- **depends_on:** E06.T015
- **decision_links:** D16, D02, D07
- **owner:** infra-observability
- **risk_level:** low
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E06.T017 — Ranking, Categorization, and Selection Stability: operational readiness work package 2
- **objective:** Deliver operational readiness increment 2 for ranking, categorization, and selection stability.
- **scope:** `E06` capability lane, increment 2.
- **depends_on:** E06.T016
- **decision_links:** D17, D03, D08
- **owner:** search-platform
- **risk_level:** medium
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E06.T018 — Ranking, Categorization, and Selection Stability: operational readiness work package 3
- **objective:** Deliver operational readiness increment 3 for ranking, categorization, and selection stability.
- **scope:** `E06` capability lane, increment 3.
- **depends_on:** E06.T017
- **decision_links:** D18, D04, D09
- **owner:** commands-runtime
- **risk_level:** high
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E06.T019 — Ranking, Categorization, and Selection Stability: operational readiness work package 4
- **objective:** Deliver operational readiness increment 4 for ranking, categorization, and selection stability.
- **scope:** `E06` capability lane, increment 4.
- **depends_on:** E06.T018
- **decision_links:** D01, D05, D10
- **owner:** commands-ui
- **risk_level:** low
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E06.T020 — Ranking, Categorization, and Selection Stability: operational readiness work package 5
- **objective:** Deliver operational readiness increment 5 for ranking, categorization, and selection stability.
- **scope:** `E06` capability lane, increment 5.
- **depends_on:** E06.T019
- **decision_links:** D02, D06, D11
- **owner:** infra-observability
- **risk_level:** medium
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

---

## E07 — Real Transport Lanes

**Epic objective:** Replace synthetic adapters with real RPC/HTTP/FS/vector/db lanes and validate mixed transport orchestration.

### Capability map
- E07.C01 — Contract hardening
- E07.C02 — Runtime implementation
- E07.C03 — Validation and adversarial testing
- E07.C04 — Operational readiness

### E07.C01 Contract hardening

#### E07.T001 — Real Transport Lanes: contract hardening work package 1
- **objective:** Deliver contract hardening increment 1 for real transport lanes.
- **scope:** `E07` capability lane, increment 1.
- **depends_on:** none
- **decision_links:** D14, D18, D05
- **owner:** search-platform
- **risk_level:** medium
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E07.T002 — Real Transport Lanes: contract hardening work package 2
- **objective:** Deliver contract hardening increment 2 for real transport lanes.
- **scope:** `E07` capability lane, increment 2.
- **depends_on:** E07.T001
- **decision_links:** D15, D01, D06
- **owner:** commands-runtime
- **risk_level:** high
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E07.T003 — Real Transport Lanes: contract hardening work package 3
- **objective:** Deliver contract hardening increment 3 for real transport lanes.
- **scope:** `E07` capability lane, increment 3.
- **depends_on:** E07.T002
- **decision_links:** D16, D02, D07
- **owner:** commands-ui
- **risk_level:** low
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E07.T004 — Real Transport Lanes: contract hardening work package 4
- **objective:** Deliver contract hardening increment 4 for real transport lanes.
- **scope:** `E07` capability lane, increment 4.
- **depends_on:** E07.T003
- **decision_links:** D17, D03, D08
- **owner:** infra-observability
- **risk_level:** medium
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E07.T005 — Real Transport Lanes: contract hardening work package 5
- **objective:** Deliver contract hardening increment 5 for real transport lanes.
- **scope:** `E07` capability lane, increment 5.
- **depends_on:** E07.T004
- **decision_links:** D18, D04, D09
- **owner:** search-platform
- **risk_level:** high
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E07.C02 Runtime implementation

#### E07.T006 — Real Transport Lanes: runtime implementation work package 1
- **objective:** Deliver runtime implementation increment 1 for real transport lanes.
- **scope:** `E07` capability lane, increment 1.
- **depends_on:** E07.T005
- **decision_links:** D17, D03, D08
- **owner:** search-platform
- **risk_level:** high
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E07.T007 — Real Transport Lanes: runtime implementation work package 2
- **objective:** Deliver runtime implementation increment 2 for real transport lanes.
- **scope:** `E07` capability lane, increment 2.
- **depends_on:** E07.T006
- **decision_links:** D18, D04, D09
- **owner:** commands-runtime
- **risk_level:** low
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E07.T008 — Real Transport Lanes: runtime implementation work package 3
- **objective:** Deliver runtime implementation increment 3 for real transport lanes.
- **scope:** `E07` capability lane, increment 3.
- **depends_on:** E07.T007
- **decision_links:** D01, D05, D10
- **owner:** commands-ui
- **risk_level:** medium
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E07.T009 — Real Transport Lanes: runtime implementation work package 4
- **objective:** Deliver runtime implementation increment 4 for real transport lanes.
- **scope:** `E07` capability lane, increment 4.
- **depends_on:** E07.T008
- **decision_links:** D02, D06, D11
- **owner:** infra-observability
- **risk_level:** high
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E07.T010 — Real Transport Lanes: runtime implementation work package 5
- **objective:** Deliver runtime implementation increment 5 for real transport lanes.
- **scope:** `E07` capability lane, increment 5.
- **depends_on:** E07.T009
- **decision_links:** D03, D07, D12
- **owner:** search-platform
- **risk_level:** low
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E07.C03 Validation and adversarial testing

#### E07.T011 — Real Transport Lanes: validation and adversarial testing work package 1
- **objective:** Deliver validation and adversarial testing increment 1 for real transport lanes.
- **scope:** `E07` capability lane, increment 1.
- **depends_on:** E07.T010
- **decision_links:** D02, D06, D11
- **owner:** search-platform
- **risk_level:** low
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E07.T012 — Real Transport Lanes: validation and adversarial testing work package 2
- **objective:** Deliver validation and adversarial testing increment 2 for real transport lanes.
- **scope:** `E07` capability lane, increment 2.
- **depends_on:** E07.T011
- **decision_links:** D03, D07, D12
- **owner:** commands-runtime
- **risk_level:** medium
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E07.T013 — Real Transport Lanes: validation and adversarial testing work package 3
- **objective:** Deliver validation and adversarial testing increment 3 for real transport lanes.
- **scope:** `E07` capability lane, increment 3.
- **depends_on:** E07.T012
- **decision_links:** D04, D08, D13
- **owner:** commands-ui
- **risk_level:** high
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E07.T014 — Real Transport Lanes: validation and adversarial testing work package 4
- **objective:** Deliver validation and adversarial testing increment 4 for real transport lanes.
- **scope:** `E07` capability lane, increment 4.
- **depends_on:** E07.T013
- **decision_links:** D05, D09, D14
- **owner:** infra-observability
- **risk_level:** low
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E07.T015 — Real Transport Lanes: validation and adversarial testing work package 5
- **objective:** Deliver validation and adversarial testing increment 5 for real transport lanes.
- **scope:** `E07` capability lane, increment 5.
- **depends_on:** E07.T014
- **decision_links:** D06, D10, D15
- **owner:** search-platform
- **risk_level:** medium
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E07.C04 Operational readiness

#### E07.T016 — Real Transport Lanes: operational readiness work package 1
- **objective:** Deliver operational readiness increment 1 for real transport lanes.
- **scope:** `E07` capability lane, increment 1.
- **depends_on:** E07.T015
- **decision_links:** D05, D09, D14
- **owner:** search-platform
- **risk_level:** medium
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E07.T017 — Real Transport Lanes: operational readiness work package 2
- **objective:** Deliver operational readiness increment 2 for real transport lanes.
- **scope:** `E07` capability lane, increment 2.
- **depends_on:** E07.T016
- **decision_links:** D06, D10, D15
- **owner:** commands-runtime
- **risk_level:** high
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E07.T018 — Real Transport Lanes: operational readiness work package 3
- **objective:** Deliver operational readiness increment 3 for real transport lanes.
- **scope:** `E07` capability lane, increment 3.
- **depends_on:** E07.T017
- **decision_links:** D07, D11, D16
- **owner:** commands-ui
- **risk_level:** low
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E07.T019 — Real Transport Lanes: operational readiness work package 4
- **objective:** Deliver operational readiness increment 4 for real transport lanes.
- **scope:** `E07` capability lane, increment 4.
- **depends_on:** E07.T018
- **decision_links:** D08, D12, D17
- **owner:** infra-observability
- **risk_level:** medium
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E07.T020 — Real Transport Lanes: operational readiness work package 5
- **objective:** Deliver operational readiness increment 5 for real transport lanes.
- **scope:** `E07` capability lane, increment 5.
- **depends_on:** E07.T019
- **decision_links:** D09, D13, D18
- **owner:** search-platform
- **risk_level:** high
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

---

## E08 — Persistence & Cache Durability

**Epic objective:** Execute SQLite L2 migration/WAL policy, cache integrity, and warm-path performance behavior.

### Capability map
- E08.C01 — Contract hardening
- E08.C02 — Runtime implementation
- E08.C03 — Validation and adversarial testing
- E08.C04 — Operational readiness

### E08.C01 Contract hardening

#### E08.T001 — Persistence & Cache Durability: contract hardening work package 1
- **objective:** Deliver contract hardening increment 1 for persistence & cache durability.
- **scope:** `E08` capability lane, increment 1.
- **depends_on:** none
- **decision_links:** D03, D07, D12
- **owner:** commands-runtime
- **risk_level:** high
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E08.T002 — Persistence & Cache Durability: contract hardening work package 2
- **objective:** Deliver contract hardening increment 2 for persistence & cache durability.
- **scope:** `E08` capability lane, increment 2.
- **depends_on:** E08.T001
- **decision_links:** D04, D08, D13
- **owner:** commands-ui
- **risk_level:** low
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E08.T003 — Persistence & Cache Durability: contract hardening work package 3
- **objective:** Deliver contract hardening increment 3 for persistence & cache durability.
- **scope:** `E08` capability lane, increment 3.
- **depends_on:** E08.T002
- **decision_links:** D05, D09, D14
- **owner:** infra-observability
- **risk_level:** medium
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E08.T004 — Persistence & Cache Durability: contract hardening work package 4
- **objective:** Deliver contract hardening increment 4 for persistence & cache durability.
- **scope:** `E08` capability lane, increment 4.
- **depends_on:** E08.T003
- **decision_links:** D06, D10, D15
- **owner:** search-platform
- **risk_level:** high
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E08.T005 — Persistence & Cache Durability: contract hardening work package 5
- **objective:** Deliver contract hardening increment 5 for persistence & cache durability.
- **scope:** `E08` capability lane, increment 5.
- **depends_on:** E08.T004
- **decision_links:** D07, D11, D16
- **owner:** commands-runtime
- **risk_level:** low
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E08.C02 Runtime implementation

#### E08.T006 — Persistence & Cache Durability: runtime implementation work package 1
- **objective:** Deliver runtime implementation increment 1 for persistence & cache durability.
- **scope:** `E08` capability lane, increment 1.
- **depends_on:** E08.T005
- **decision_links:** D06, D10, D15
- **owner:** commands-runtime
- **risk_level:** low
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E08.T007 — Persistence & Cache Durability: runtime implementation work package 2
- **objective:** Deliver runtime implementation increment 2 for persistence & cache durability.
- **scope:** `E08` capability lane, increment 2.
- **depends_on:** E08.T006
- **decision_links:** D07, D11, D16
- **owner:** commands-ui
- **risk_level:** medium
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E08.T008 — Persistence & Cache Durability: runtime implementation work package 3
- **objective:** Deliver runtime implementation increment 3 for persistence & cache durability.
- **scope:** `E08` capability lane, increment 3.
- **depends_on:** E08.T007
- **decision_links:** D08, D12, D17
- **owner:** infra-observability
- **risk_level:** high
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E08.T009 — Persistence & Cache Durability: runtime implementation work package 4
- **objective:** Deliver runtime implementation increment 4 for persistence & cache durability.
- **scope:** `E08` capability lane, increment 4.
- **depends_on:** E08.T008
- **decision_links:** D09, D13, D18
- **owner:** search-platform
- **risk_level:** low
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E08.T010 — Persistence & Cache Durability: runtime implementation work package 5
- **objective:** Deliver runtime implementation increment 5 for persistence & cache durability.
- **scope:** `E08` capability lane, increment 5.
- **depends_on:** E08.T009
- **decision_links:** D10, D14, D01
- **owner:** commands-runtime
- **risk_level:** medium
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E08.C03 Validation and adversarial testing

#### E08.T011 — Persistence & Cache Durability: validation and adversarial testing work package 1
- **objective:** Deliver validation and adversarial testing increment 1 for persistence & cache durability.
- **scope:** `E08` capability lane, increment 1.
- **depends_on:** E08.T010
- **decision_links:** D09, D13, D18
- **owner:** commands-runtime
- **risk_level:** medium
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E08.T012 — Persistence & Cache Durability: validation and adversarial testing work package 2
- **objective:** Deliver validation and adversarial testing increment 2 for persistence & cache durability.
- **scope:** `E08` capability lane, increment 2.
- **depends_on:** E08.T011
- **decision_links:** D10, D14, D01
- **owner:** commands-ui
- **risk_level:** high
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E08.T013 — Persistence & Cache Durability: validation and adversarial testing work package 3
- **objective:** Deliver validation and adversarial testing increment 3 for persistence & cache durability.
- **scope:** `E08` capability lane, increment 3.
- **depends_on:** E08.T012
- **decision_links:** D11, D15, D02
- **owner:** infra-observability
- **risk_level:** low
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E08.T014 — Persistence & Cache Durability: validation and adversarial testing work package 4
- **objective:** Deliver validation and adversarial testing increment 4 for persistence & cache durability.
- **scope:** `E08` capability lane, increment 4.
- **depends_on:** E08.T013
- **decision_links:** D12, D16, D03
- **owner:** search-platform
- **risk_level:** medium
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E08.T015 — Persistence & Cache Durability: validation and adversarial testing work package 5
- **objective:** Deliver validation and adversarial testing increment 5 for persistence & cache durability.
- **scope:** `E08` capability lane, increment 5.
- **depends_on:** E08.T014
- **decision_links:** D13, D17, D04
- **owner:** commands-runtime
- **risk_level:** high
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E08.C04 Operational readiness

#### E08.T016 — Persistence & Cache Durability: operational readiness work package 1
- **objective:** Deliver operational readiness increment 1 for persistence & cache durability.
- **scope:** `E08` capability lane, increment 1.
- **depends_on:** E08.T015
- **decision_links:** D12, D16, D03
- **owner:** commands-runtime
- **risk_level:** high
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E08.T017 — Persistence & Cache Durability: operational readiness work package 2
- **objective:** Deliver operational readiness increment 2 for persistence & cache durability.
- **scope:** `E08` capability lane, increment 2.
- **depends_on:** E08.T016
- **decision_links:** D13, D17, D04
- **owner:** commands-ui
- **risk_level:** low
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E08.T018 — Persistence & Cache Durability: operational readiness work package 3
- **objective:** Deliver operational readiness increment 3 for persistence & cache durability.
- **scope:** `E08` capability lane, increment 3.
- **depends_on:** E08.T017
- **decision_links:** D14, D18, D05
- **owner:** infra-observability
- **risk_level:** medium
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E08.T019 — Persistence & Cache Durability: operational readiness work package 4
- **objective:** Deliver operational readiness increment 4 for persistence & cache durability.
- **scope:** `E08` capability lane, increment 4.
- **depends_on:** E08.T018
- **decision_links:** D15, D01, D06
- **owner:** search-platform
- **risk_level:** high
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E08.T020 — Persistence & Cache Durability: operational readiness work package 5
- **objective:** Deliver operational readiness increment 5 for persistence & cache durability.
- **scope:** `E08` capability lane, increment 5.
- **depends_on:** E08.T019
- **decision_links:** D16, D02, D07
- **owner:** commands-runtime
- **risk_level:** low
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

---

## E09 — Interactive Surface Integration

**Epic objective:** Integrate NuCmdk runtime with minibuffer/overlay host paths and verify user-visible parity.

### Capability map
- E09.C01 — Contract hardening
- E09.C02 — Runtime implementation
- E09.C03 — Validation and adversarial testing
- E09.C04 — Operational readiness

### E09.C01 Contract hardening

#### E09.T001 — Interactive Surface Integration: contract hardening work package 1
- **objective:** Deliver contract hardening increment 1 for interactive surface integration.
- **scope:** `E09` capability lane, increment 1.
- **depends_on:** none
- **decision_links:** D10, D14, D01
- **owner:** commands-ui
- **risk_level:** low
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E09.T002 — Interactive Surface Integration: contract hardening work package 2
- **objective:** Deliver contract hardening increment 2 for interactive surface integration.
- **scope:** `E09` capability lane, increment 2.
- **depends_on:** E09.T001
- **decision_links:** D11, D15, D02
- **owner:** infra-observability
- **risk_level:** medium
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E09.T003 — Interactive Surface Integration: contract hardening work package 3
- **objective:** Deliver contract hardening increment 3 for interactive surface integration.
- **scope:** `E09` capability lane, increment 3.
- **depends_on:** E09.T002
- **decision_links:** D12, D16, D03
- **owner:** search-platform
- **risk_level:** high
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E09.T004 — Interactive Surface Integration: contract hardening work package 4
- **objective:** Deliver contract hardening increment 4 for interactive surface integration.
- **scope:** `E09` capability lane, increment 4.
- **depends_on:** E09.T003
- **decision_links:** D13, D17, D04
- **owner:** commands-runtime
- **risk_level:** low
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E09.T005 — Interactive Surface Integration: contract hardening work package 5
- **objective:** Deliver contract hardening increment 5 for interactive surface integration.
- **scope:** `E09` capability lane, increment 5.
- **depends_on:** E09.T004
- **decision_links:** D14, D18, D05
- **owner:** commands-ui
- **risk_level:** medium
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E09.C02 Runtime implementation

#### E09.T006 — Interactive Surface Integration: runtime implementation work package 1
- **objective:** Deliver runtime implementation increment 1 for interactive surface integration.
- **scope:** `E09` capability lane, increment 1.
- **depends_on:** E09.T005
- **decision_links:** D13, D17, D04
- **owner:** commands-ui
- **risk_level:** medium
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E09.T007 — Interactive Surface Integration: runtime implementation work package 2
- **objective:** Deliver runtime implementation increment 2 for interactive surface integration.
- **scope:** `E09` capability lane, increment 2.
- **depends_on:** E09.T006
- **decision_links:** D14, D18, D05
- **owner:** infra-observability
- **risk_level:** high
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E09.T008 — Interactive Surface Integration: runtime implementation work package 3
- **objective:** Deliver runtime implementation increment 3 for interactive surface integration.
- **scope:** `E09` capability lane, increment 3.
- **depends_on:** E09.T007
- **decision_links:** D15, D01, D06
- **owner:** search-platform
- **risk_level:** low
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E09.T009 — Interactive Surface Integration: runtime implementation work package 4
- **objective:** Deliver runtime implementation increment 4 for interactive surface integration.
- **scope:** `E09` capability lane, increment 4.
- **depends_on:** E09.T008
- **decision_links:** D16, D02, D07
- **owner:** commands-runtime
- **risk_level:** medium
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E09.T010 — Interactive Surface Integration: runtime implementation work package 5
- **objective:** Deliver runtime implementation increment 5 for interactive surface integration.
- **scope:** `E09` capability lane, increment 5.
- **depends_on:** E09.T009
- **decision_links:** D17, D03, D08
- **owner:** commands-ui
- **risk_level:** high
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E09.C03 Validation and adversarial testing

#### E09.T011 — Interactive Surface Integration: validation and adversarial testing work package 1
- **objective:** Deliver validation and adversarial testing increment 1 for interactive surface integration.
- **scope:** `E09` capability lane, increment 1.
- **depends_on:** E09.T010
- **decision_links:** D16, D02, D07
- **owner:** commands-ui
- **risk_level:** high
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E09.T012 — Interactive Surface Integration: validation and adversarial testing work package 2
- **objective:** Deliver validation and adversarial testing increment 2 for interactive surface integration.
- **scope:** `E09` capability lane, increment 2.
- **depends_on:** E09.T011
- **decision_links:** D17, D03, D08
- **owner:** infra-observability
- **risk_level:** low
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E09.T013 — Interactive Surface Integration: validation and adversarial testing work package 3
- **objective:** Deliver validation and adversarial testing increment 3 for interactive surface integration.
- **scope:** `E09` capability lane, increment 3.
- **depends_on:** E09.T012
- **decision_links:** D18, D04, D09
- **owner:** search-platform
- **risk_level:** medium
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E09.T014 — Interactive Surface Integration: validation and adversarial testing work package 4
- **objective:** Deliver validation and adversarial testing increment 4 for interactive surface integration.
- **scope:** `E09` capability lane, increment 4.
- **depends_on:** E09.T013
- **decision_links:** D01, D05, D10
- **owner:** commands-runtime
- **risk_level:** high
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E09.T015 — Interactive Surface Integration: validation and adversarial testing work package 5
- **objective:** Deliver validation and adversarial testing increment 5 for interactive surface integration.
- **scope:** `E09` capability lane, increment 5.
- **depends_on:** E09.T014
- **decision_links:** D02, D06, D11
- **owner:** commands-ui
- **risk_level:** low
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E09.C04 Operational readiness

#### E09.T016 — Interactive Surface Integration: operational readiness work package 1
- **objective:** Deliver operational readiness increment 1 for interactive surface integration.
- **scope:** `E09` capability lane, increment 1.
- **depends_on:** E09.T015
- **decision_links:** D01, D05, D10
- **owner:** commands-ui
- **risk_level:** low
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E09.T017 — Interactive Surface Integration: operational readiness work package 2
- **objective:** Deliver operational readiness increment 2 for interactive surface integration.
- **scope:** `E09` capability lane, increment 2.
- **depends_on:** E09.T016
- **decision_links:** D02, D06, D11
- **owner:** infra-observability
- **risk_level:** medium
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E09.T018 — Interactive Surface Integration: operational readiness work package 3
- **objective:** Deliver operational readiness increment 3 for interactive surface integration.
- **scope:** `E09` capability lane, increment 3.
- **depends_on:** E09.T017
- **decision_links:** D03, D07, D12
- **owner:** search-platform
- **risk_level:** high
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E09.T019 — Interactive Surface Integration: operational readiness work package 4
- **objective:** Deliver operational readiness increment 4 for interactive surface integration.
- **scope:** `E09` capability lane, increment 4.
- **depends_on:** E09.T018
- **decision_links:** D04, D08, D13
- **owner:** commands-runtime
- **risk_level:** low
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E09.T020 — Interactive Surface Integration: operational readiness work package 5
- **objective:** Deliver operational readiness increment 5 for interactive surface integration.
- **scope:** `E09` capability lane, increment 5.
- **depends_on:** E09.T019
- **decision_links:** D05, D09, D14
- **owner:** commands-ui
- **risk_level:** medium
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

---

## E10 — Observability, SLOs, and Hillclimb Automation

**Epic objective:** Close telemetry loops, enforce phase budgets, and automate constrained optimization decisions.

### Capability map
- E10.C01 — Contract hardening
- E10.C02 — Runtime implementation
- E10.C03 — Validation and adversarial testing
- E10.C04 — Operational readiness

### E10.C01 Contract hardening

#### E10.T001 — Observability, SLOs, and Hillclimb Automation: contract hardening work package 1
- **objective:** Deliver contract hardening increment 1 for observability, slos, and hillclimb automation.
- **scope:** `E10` capability lane, increment 1.
- **depends_on:** none
- **decision_links:** D17, D03, D08
- **owner:** infra-observability
- **risk_level:** medium
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E10.T002 — Observability, SLOs, and Hillclimb Automation: contract hardening work package 2
- **objective:** Deliver contract hardening increment 2 for observability, slos, and hillclimb automation.
- **scope:** `E10` capability lane, increment 2.
- **depends_on:** E10.T001
- **decision_links:** D18, D04, D09
- **owner:** search-platform
- **risk_level:** high
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E10.T003 — Observability, SLOs, and Hillclimb Automation: contract hardening work package 3
- **objective:** Deliver contract hardening increment 3 for observability, slos, and hillclimb automation.
- **scope:** `E10` capability lane, increment 3.
- **depends_on:** E10.T002
- **decision_links:** D01, D05, D10
- **owner:** commands-runtime
- **risk_level:** low
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E10.T004 — Observability, SLOs, and Hillclimb Automation: contract hardening work package 4
- **objective:** Deliver contract hardening increment 4 for observability, slos, and hillclimb automation.
- **scope:** `E10` capability lane, increment 4.
- **depends_on:** E10.T003
- **decision_links:** D02, D06, D11
- **owner:** commands-ui
- **risk_level:** medium
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E10.T005 — Observability, SLOs, and Hillclimb Automation: contract hardening work package 5
- **objective:** Deliver contract hardening increment 5 for observability, slos, and hillclimb automation.
- **scope:** `E10` capability lane, increment 5.
- **depends_on:** E10.T004
- **decision_links:** D03, D07, D12
- **owner:** infra-observability
- **risk_level:** high
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E10.C02 Runtime implementation

#### E10.T006 — Observability, SLOs, and Hillclimb Automation: runtime implementation work package 1
- **objective:** Deliver runtime implementation increment 1 for observability, slos, and hillclimb automation.
- **scope:** `E10` capability lane, increment 1.
- **depends_on:** E10.T005
- **decision_links:** D02, D06, D11
- **owner:** infra-observability
- **risk_level:** high
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E10.T007 — Observability, SLOs, and Hillclimb Automation: runtime implementation work package 2
- **objective:** Deliver runtime implementation increment 2 for observability, slos, and hillclimb automation.
- **scope:** `E10` capability lane, increment 2.
- **depends_on:** E10.T006
- **decision_links:** D03, D07, D12
- **owner:** search-platform
- **risk_level:** low
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E10.T008 — Observability, SLOs, and Hillclimb Automation: runtime implementation work package 3
- **objective:** Deliver runtime implementation increment 3 for observability, slos, and hillclimb automation.
- **scope:** `E10` capability lane, increment 3.
- **depends_on:** E10.T007
- **decision_links:** D04, D08, D13
- **owner:** commands-runtime
- **risk_level:** medium
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E10.T009 — Observability, SLOs, and Hillclimb Automation: runtime implementation work package 4
- **objective:** Deliver runtime implementation increment 4 for observability, slos, and hillclimb automation.
- **scope:** `E10` capability lane, increment 4.
- **depends_on:** E10.T008
- **decision_links:** D05, D09, D14
- **owner:** commands-ui
- **risk_level:** high
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E10.T010 — Observability, SLOs, and Hillclimb Automation: runtime implementation work package 5
- **objective:** Deliver runtime implementation increment 5 for observability, slos, and hillclimb automation.
- **scope:** `E10` capability lane, increment 5.
- **depends_on:** E10.T009
- **decision_links:** D06, D10, D15
- **owner:** infra-observability
- **risk_level:** low
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E10.C03 Validation and adversarial testing

#### E10.T011 — Observability, SLOs, and Hillclimb Automation: validation and adversarial testing work package 1
- **objective:** Deliver validation and adversarial testing increment 1 for observability, slos, and hillclimb automation.
- **scope:** `E10` capability lane, increment 1.
- **depends_on:** E10.T010
- **decision_links:** D05, D09, D14
- **owner:** infra-observability
- **risk_level:** low
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E10.T012 — Observability, SLOs, and Hillclimb Automation: validation and adversarial testing work package 2
- **objective:** Deliver validation and adversarial testing increment 2 for observability, slos, and hillclimb automation.
- **scope:** `E10` capability lane, increment 2.
- **depends_on:** E10.T011
- **decision_links:** D06, D10, D15
- **owner:** search-platform
- **risk_level:** medium
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E10.T013 — Observability, SLOs, and Hillclimb Automation: validation and adversarial testing work package 3
- **objective:** Deliver validation and adversarial testing increment 3 for observability, slos, and hillclimb automation.
- **scope:** `E10` capability lane, increment 3.
- **depends_on:** E10.T012
- **decision_links:** D07, D11, D16
- **owner:** commands-runtime
- **risk_level:** high
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E10.T014 — Observability, SLOs, and Hillclimb Automation: validation and adversarial testing work package 4
- **objective:** Deliver validation and adversarial testing increment 4 for observability, slos, and hillclimb automation.
- **scope:** `E10` capability lane, increment 4.
- **depends_on:** E10.T013
- **decision_links:** D08, D12, D17
- **owner:** commands-ui
- **risk_level:** low
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E10.T015 — Observability, SLOs, and Hillclimb Automation: validation and adversarial testing work package 5
- **objective:** Deliver validation and adversarial testing increment 5 for observability, slos, and hillclimb automation.
- **scope:** `E10` capability lane, increment 5.
- **depends_on:** E10.T014
- **decision_links:** D09, D13, D18
- **owner:** infra-observability
- **risk_level:** medium
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E10.C04 Operational readiness

#### E10.T016 — Observability, SLOs, and Hillclimb Automation: operational readiness work package 1
- **objective:** Deliver operational readiness increment 1 for observability, slos, and hillclimb automation.
- **scope:** `E10` capability lane, increment 1.
- **depends_on:** E10.T015
- **decision_links:** D08, D12, D17
- **owner:** infra-observability
- **risk_level:** medium
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E10.T017 — Observability, SLOs, and Hillclimb Automation: operational readiness work package 2
- **objective:** Deliver operational readiness increment 2 for observability, slos, and hillclimb automation.
- **scope:** `E10` capability lane, increment 2.
- **depends_on:** E10.T016
- **decision_links:** D09, D13, D18
- **owner:** search-platform
- **risk_level:** high
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E10.T018 — Observability, SLOs, and Hillclimb Automation: operational readiness work package 3
- **objective:** Deliver operational readiness increment 3 for observability, slos, and hillclimb automation.
- **scope:** `E10` capability lane, increment 3.
- **depends_on:** E10.T017
- **decision_links:** D10, D14, D01
- **owner:** commands-runtime
- **risk_level:** low
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E10.T019 — Observability, SLOs, and Hillclimb Automation: operational readiness work package 4
- **objective:** Deliver operational readiness increment 4 for observability, slos, and hillclimb automation.
- **scope:** `E10` capability lane, increment 4.
- **depends_on:** E10.T018
- **decision_links:** D11, D15, D02
- **owner:** commands-ui
- **risk_level:** medium
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E10.T020 — Observability, SLOs, and Hillclimb Automation: operational readiness work package 5
- **objective:** Deliver operational readiness increment 5 for observability, slos, and hillclimb automation.
- **scope:** `E10` capability lane, increment 5.
- **depends_on:** E10.T019
- **decision_links:** D12, D16, D03
- **owner:** infra-observability
- **risk_level:** high
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

---

## E11 — Rollout, Migration, and Decommission

**Epic objective:** Ship feature-flag rollout, migrate from monolith integration, and decommission legacy path safely.

### Capability map
- E11.C01 — Contract hardening
- E11.C02 — Runtime implementation
- E11.C03 — Validation and adversarial testing
- E11.C04 — Operational readiness

### E11.C01 Contract hardening

#### E11.T001 — Rollout, Migration, and Decommission: contract hardening work package 1
- **objective:** Deliver contract hardening increment 1 for rollout, migration, and decommission.
- **scope:** `E11` capability lane, increment 1.
- **depends_on:** none
- **decision_links:** D06, D10, D15
- **owner:** search-platform
- **risk_level:** high
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E11.T002 — Rollout, Migration, and Decommission: contract hardening work package 2
- **objective:** Deliver contract hardening increment 2 for rollout, migration, and decommission.
- **scope:** `E11` capability lane, increment 2.
- **depends_on:** E11.T001
- **decision_links:** D07, D11, D16
- **owner:** commands-runtime
- **risk_level:** low
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E11.T003 — Rollout, Migration, and Decommission: contract hardening work package 3
- **objective:** Deliver contract hardening increment 3 for rollout, migration, and decommission.
- **scope:** `E11` capability lane, increment 3.
- **depends_on:** E11.T002
- **decision_links:** D08, D12, D17
- **owner:** commands-ui
- **risk_level:** medium
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E11.T004 — Rollout, Migration, and Decommission: contract hardening work package 4
- **objective:** Deliver contract hardening increment 4 for rollout, migration, and decommission.
- **scope:** `E11` capability lane, increment 4.
- **depends_on:** E11.T003
- **decision_links:** D09, D13, D18
- **owner:** infra-observability
- **risk_level:** high
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E11.T005 — Rollout, Migration, and Decommission: contract hardening work package 5
- **objective:** Deliver contract hardening increment 5 for rollout, migration, and decommission.
- **scope:** `E11` capability lane, increment 5.
- **depends_on:** E11.T004
- **decision_links:** D10, D14, D01
- **owner:** search-platform
- **risk_level:** low
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E11.C02 Runtime implementation

#### E11.T006 — Rollout, Migration, and Decommission: runtime implementation work package 1
- **objective:** Deliver runtime implementation increment 1 for rollout, migration, and decommission.
- **scope:** `E11` capability lane, increment 1.
- **depends_on:** E11.T005
- **decision_links:** D09, D13, D18
- **owner:** search-platform
- **risk_level:** low
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E11.T007 — Rollout, Migration, and Decommission: runtime implementation work package 2
- **objective:** Deliver runtime implementation increment 2 for rollout, migration, and decommission.
- **scope:** `E11` capability lane, increment 2.
- **depends_on:** E11.T006
- **decision_links:** D10, D14, D01
- **owner:** commands-runtime
- **risk_level:** medium
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E11.T008 — Rollout, Migration, and Decommission: runtime implementation work package 3
- **objective:** Deliver runtime implementation increment 3 for rollout, migration, and decommission.
- **scope:** `E11` capability lane, increment 3.
- **depends_on:** E11.T007
- **decision_links:** D11, D15, D02
- **owner:** commands-ui
- **risk_level:** high
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E11.T009 — Rollout, Migration, and Decommission: runtime implementation work package 4
- **objective:** Deliver runtime implementation increment 4 for rollout, migration, and decommission.
- **scope:** `E11` capability lane, increment 4.
- **depends_on:** E11.T008
- **decision_links:** D12, D16, D03
- **owner:** infra-observability
- **risk_level:** low
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E11.T010 — Rollout, Migration, and Decommission: runtime implementation work package 5
- **objective:** Deliver runtime implementation increment 5 for rollout, migration, and decommission.
- **scope:** `E11` capability lane, increment 5.
- **depends_on:** E11.T009
- **decision_links:** D13, D17, D04
- **owner:** search-platform
- **risk_level:** medium
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E11.C03 Validation and adversarial testing

#### E11.T011 — Rollout, Migration, and Decommission: validation and adversarial testing work package 1
- **objective:** Deliver validation and adversarial testing increment 1 for rollout, migration, and decommission.
- **scope:** `E11` capability lane, increment 1.
- **depends_on:** E11.T010
- **decision_links:** D12, D16, D03
- **owner:** search-platform
- **risk_level:** medium
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E11.T012 — Rollout, Migration, and Decommission: validation and adversarial testing work package 2
- **objective:** Deliver validation and adversarial testing increment 2 for rollout, migration, and decommission.
- **scope:** `E11` capability lane, increment 2.
- **depends_on:** E11.T011
- **decision_links:** D13, D17, D04
- **owner:** commands-runtime
- **risk_level:** high
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E11.T013 — Rollout, Migration, and Decommission: validation and adversarial testing work package 3
- **objective:** Deliver validation and adversarial testing increment 3 for rollout, migration, and decommission.
- **scope:** `E11` capability lane, increment 3.
- **depends_on:** E11.T012
- **decision_links:** D14, D18, D05
- **owner:** commands-ui
- **risk_level:** low
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E11.T014 — Rollout, Migration, and Decommission: validation and adversarial testing work package 4
- **objective:** Deliver validation and adversarial testing increment 4 for rollout, migration, and decommission.
- **scope:** `E11` capability lane, increment 4.
- **depends_on:** E11.T013
- **decision_links:** D15, D01, D06
- **owner:** infra-observability
- **risk_level:** medium
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E11.T015 — Rollout, Migration, and Decommission: validation and adversarial testing work package 5
- **objective:** Deliver validation and adversarial testing increment 5 for rollout, migration, and decommission.
- **scope:** `E11` capability lane, increment 5.
- **depends_on:** E11.T014
- **decision_links:** D16, D02, D07
- **owner:** search-platform
- **risk_level:** high
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

### E11.C04 Operational readiness

#### E11.T016 — Rollout, Migration, and Decommission: operational readiness work package 1
- **objective:** Deliver operational readiness increment 1 for rollout, migration, and decommission.
- **scope:** `E11` capability lane, increment 1.
- **depends_on:** E11.T015
- **decision_links:** D15, D01, D06
- **owner:** search-platform
- **risk_level:** high
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E11.T017 — Rollout, Migration, and Decommission: operational readiness work package 2
- **objective:** Deliver operational readiness increment 2 for rollout, migration, and decommission.
- **scope:** `E11` capability lane, increment 2.
- **depends_on:** E11.T016
- **decision_links:** D16, D02, D07
- **owner:** commands-runtime
- **risk_level:** low
- **required_evidence_tier:** T4
- **acceptance_artifact:** recorded interactive runbook + metrics snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E11.T018 — Rollout, Migration, and Decommission: operational readiness work package 3
- **objective:** Deliver operational readiness increment 3 for rollout, migration, and decommission.
- **scope:** `E11` capability lane, increment 3.
- **depends_on:** E11.T017
- **decision_links:** D17, D03, D08
- **owner:** commands-ui
- **risk_level:** medium
- **required_evidence_tier:** T1
- **acceptance_artifact:** unit test + contract snapshot
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E11.T019 — Rollout, Migration, and Decommission: operational readiness work package 4
- **objective:** Deliver operational readiness increment 4 for rollout, migration, and decommission.
- **scope:** `E11` capability lane, increment 4.
- **depends_on:** E11.T018
- **decision_links:** D18, D04, D09
- **owner:** infra-observability
- **risk_level:** high
- **required_evidence_tier:** T2
- **acceptance_artifact:** integration test fixture + assertions
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

#### E11.T020 — Rollout, Migration, and Decommission: operational readiness work package 5
- **objective:** Deliver operational readiness increment 5 for rollout, migration, and decommission.
- **scope:** `E11` capability lane, increment 5.
- **depends_on:** E11.T019
- **decision_links:** D01, D05, D10
- **owner:** search-platform
- **risk_level:** low
- **required_evidence_tier:** T3
- **acceptance_artifact:** spike jsonl/comparison + guardrail summary
- **definition_of_done:**
  - implementation merged behind agreed guardrails
  - telemetry hooks present for changed runtime path
  - no cycle seam regressions introduced
- **status:** todo

---

## 6) Cross-epic integration milestones

### M1 — M1 Runtime scaffold parity
- entry criteria: prior milestone accepted
- exit criteria: all linked epic tasks accepted with declared evidence tiers
- required signoff: product + architecture + runtime owner

### M2 — M2 Middleware + router operational parity
- entry criteria: prior milestone accepted
- exit criteria: all linked epic tasks accepted with declared evidence tiers
- required signoff: product + architecture + runtime owner

### M3 — M3 Real transport validation complete
- entry criteria: prior milestone accepted
- exit criteria: all linked epic tasks accepted with declared evidence tiers
- required signoff: product + architecture + runtime owner

### M4 — M4 Interactive host path cutover-ready
- entry criteria: prior milestone accepted
- exit criteria: all linked epic tasks accepted with declared evidence tiers
- required signoff: product + architecture + runtime owner

### M5 — M5 Persistence durability proven
- entry criteria: prior milestone accepted
- exit criteria: all linked epic tasks accepted with declared evidence tiers
- required signoff: product + architecture + runtime owner

### M6 — M6 Rollout + decommission completed
- entry criteria: prior milestone accepted
- exit criteria: all linked epic tasks accepted with declared evidence tiers
- required signoff: product + architecture + runtime owner

---

## 7) Program risk register

- R01: Synthetic-lane confidence trap — mitigated via explicit gate + evidence artifact in linked epics.
- R02: Hidden middleware ordering drift — mitigated via explicit gate + evidence artifact in linked epics.
- R03: Provider schema entropy — mitigated via explicit gate + evidence artifact in linked epics.
- R04: Selection identity regressions under burst updates — mitigated via explicit gate + evidence artifact in linked epics.
- R05: Transport timeout policy inconsistency — mitigated via explicit gate + evidence artifact in linked epics.
- R06: SQLite migration rollback ambiguity — mitigated via explicit gate + evidence artifact in linked epics.
- R07: Objective-score gaming without user TTR gains — mitigated via explicit gate + evidence artifact in linked epics.
- R08: Monolith decommission dead code leaks — mitigated via explicit gate + evidence artifact in linked epics.

---

## 8) Audit checklist

- [ ] Every task has explicit decision link(s)
- [ ] Every task has required evidence tier
- [ ] No task advances without upstream dependency closure
- [ ] Production path (T4) coverage exists before rollout
- [ ] Spike objective + phase budgets both enforced
- [ ] Runbook artifacts preserved and indexed

---

## 9) Operational notes

This WBS is intentionally exhaustive and should be treated as the canonical backlog for NuCmdk execution waves. Task status is expected to evolve as slices land; dependencies and evidence contracts are mandatory and non-optional.

Update protocol:
1. append design-log entry for major WBS changes
2. update decision lock and traceability when decision scope changes
3. attach evidence links at task closure
