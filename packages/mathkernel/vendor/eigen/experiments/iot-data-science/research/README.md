# Research Directory - Navigation Guide

**Purpose**: Organized knowledge management for the IoT Data Science project
**Created**: 2025-12-17
**Status**: Active

---

## Quick Navigation

| Document                            | Purpose                  | When to Use                  |
| ----------------------------------- | ------------------------ | ---------------------------- |
| `SESSION_SUMMARY.md`                | Latest session recap     | Start here for current state |
| `ACTION_PLAN.md`                    | Next steps roadmap       | Planning next work session   |
| `RESEARCH_FINDINGS.md`              | Consolidated findings    | Context for decisions        |
| `papers/pending/DOWNLOAD_STATUS.md` | Paper acquisition status | Check what papers we have    |

---

## Directory Structure

```
research/
├── README.md                    # You are here - navigation guide
├── SESSION_SUMMARY.md            # Latest session recap
├── ACTION_PLAN.md                # Next steps roadmap
├── RESEARCH_FINDINGS.md          # Consolidated findings from subagents
│
├── journal/                     # Individual research entries
│   ├── YYYY-MM-DD_entry_NNN.md  # Daily research logs
│   └── index.md                 # Master index (to be created)
│
├── decisions/                   # Architectural Decision Records (ADRs)
│   └── YYYY-MM-DD_decision_NNN.md  # Key technical decisions
│
└── papers/                      # Academic papers
    ├── pending/
    │   ├── PAPERS_TO_ACQUIRE.md     # Paper tracking
    │   ├── DOWNLOAD_SCRIPT.sh        # Reusable download script
    │   └── DOWNLOAD_STATUS.md        # Download verification
    ├── time-series/
    │   ├── 2012.07436_Informer.pdf
    │   ├── 1905.10437_NBEATS.pdf
    │   └── 2211.14730_PatchTST.pdf
    └── sensor-fusion/
        ├── 2303.03757_DeepLearning_Inertial.pdf
        └── 2307.00014_SensorFusion_Survey.pdf
```

---

## Workflow

### Starting a New Session

1. Read `SESSION_SUMMARY.md` for current state
2. Review `ACTION_PLAN.md` for next steps
3. Check `RESEARCH_FINDINGS.md` for context

### During Research

1. Take notes in `journal/YYYY-MM-DD_entry_NNN.md`
2. Use the template:

   ```markdown
   # Research Entry: [Topic]

   **Date**: YYYY-MM-DD HH:MM
   **Tags**: #tag1, #tag2
   **Status**: draft | in-progress | complete

   ## Question

   ## Findings

   ## Sources

   ## Implications

   ## Next Steps
   ```

### Making Decisions

1. Create `decisions/YYYY-MM-DD_decision_NNN.md`
2. Document:
   - Context
   - Options considered
   - Criteria for decision
   - Decision made
   - Consequences
3. Reference in code comments

### End of Session

1. Update `SESSION_SUMMARY.md`
2. Update `ACTION_PLAN.md` if priorities changed
3. Consolidate new findings into `RESEARCH_FINDINGS.md`

---

## Current State (Quick Reference)

### ✅ Completed

- Modern ML pipeline (DuckDB + Polars + JAX)
- 84 engineered features
- Model trained (100% validation accuracy)
- 7/8 papers downloaded
- Research infrastructure established

### ⏳ Critical Gaps

1. **Test set evaluation** - Model never evaluated on 12,437 held-out samples
2. **Framework decision** - JAX vs PyTorch choice needed
3. **TFT paper** - Paywalled, low priority (alternatives available)

### 🔍 Key Questions

1. **Is 100% accuracy real or overfitting?** (Answer: Run test evaluation)
2. **Which framework for advanced architectures?** (Answer: Read papers, make decision)
3. **Can we deploy on edge devices?** (Answer: After architecture validated)

---

## Paper Reading Order

### Phase 1: Framework Decision (High Priority)

1. **Informer** (`time-series/2012.07436_Informer.pdf`) - Efficient transformer
2. **PatchTST** (`time-series/2211.14730_PatchTST.pdf`) - Current SOTA
3. **N-BEATS** (`time-series/1905.10437_NBEATS.pdf`) - Baseline

### Phase 2: Sensor Fusion Application

4. **Sensor Fusion Survey** (`sensor-fusion/2307.00014_SensorFusion_Survey.pdf`)
5. **Deep Learning Inertial** (`sensor-fusion/2303.03757_DeepLearning_Inertial.pdf`)

### Phase 3: Reference (As Needed)

6. Basics/tutorials in `../papers/` (root level)

---

## Templates

### Research Entry Template

```markdown
# Research Entry: [Topic]

**Date**: YYYY-MM-DD HH:MM
**Tags**: #tag1, #tag2
**Status**: draft | in-progress | complete

## Question

[Research question being investigated]

## Findings

[What was discovered]

## Sources

- [Paper citations]
- [URLs]
- [Code references]

## Implications

[What this means for the project]

## Next Steps

- [ ] Action item 1
- [ ] Action item 2
```

### Decision Record Template

```markdown
# ADR-NNN: [Decision Title]

**Date**: YYYY-MM-DD
**Status**: proposed | accepted | rejected | deprecated | superseded

## Context

[Situation and problem statement]

## Options Considered

1. Option A
2. Option B
3. Option C

## Decision

[Chosen option]

## Rationale

[Why this option was chosen]

## Consequences

- **Positive**: What we gain
- **Negative**: What we lose
- **Risks**: What could go wrong
- **Mitigations**: How we handle risks

## Follow-up Actions

- [ ] Task 1
- [ ] Task 2
```

---

## Related Documents

- `../../STATUS.md` - Overall project status
- `../../MODERN_STACK.md` - Technology stack decisions
- `../../smoke_analysis/IMPLEMENTATION_STATUS.md` - Implementation details
- `../../.claude/CLAUDE.iot-data-science.md` - Agent instructions

---

## Maintenance

### When to Update

- **SESSION_SUMMARY.md** - End of each session
- **ACTION_PLAN.md** - When priorities change
- **RESEARCH_FINDINGS.md** - When consolidating knowledge
- **This README** - When structure changes

### File Lifecycle

- **journal/** - Keep all entries (archive yearly if needed)
- **decisions/** - Keep all ADRs (mark status: superseded if replaced)
- **papers/** - Keep all papers (organize by relevance)

---

**Last Updated**: 2025-12-17 09:25 UTC
**Maintained By**: Val (Architecture Layer)
