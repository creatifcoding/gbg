# Next Steps - Action Plan

**Created**: 2025-12-17
**Status**: Active

Based on analysis of current pipeline state, here's what needs to happen next:

---

## CRITICAL GAPS IDENTIFIED

### 1. NO TEST SET EVALUATION ❌

- Model trained and saved (`smoke_detector_jax.eqx`)
- Test data processed and exported (`test_features.parquet` - 12,437 samples)
- **BUT**: Never loaded test set and ran inference
- **Risk**: 100% validation accuracy could be overfitting

### 2. NO RESEARCH JOURNAL SYSTEM ❌

- Multiple research sessions with subagents
- Findings scattered (not documented systematically)
- Papers identified but not downloaded

### 3. FRAMEWORK DECISION PENDING ⚠️

- Research revealed PyTorch has mature time-series ecosystem
- JAX requires custom implementations (weeks of work)
- Need decision before building advanced architectures

---

## PROPOSED NEXT ACTIONS (in order)

### ACTION 1: Test Set Evaluation (IMMEDIATE - 15 min)

Create a new task `evaluate_test_set()` that:

- Loads trained model from `smoke_detector_jax.eqx`
- Loads test features from `test_features.parquet`
- Runs inference on all 12,437 test samples
- Reports: accuracy, confusion matrix, per-class metrics
- Saves results to `reports/test_evaluation.json`

**Why first**: Must validate the 100% claim before doing anything else.

---

### ACTION 2: Create Research Journal Structure (30 min)

Create directory structure:

```
experiments/iot-data-science/research/
├── journal/
│   ├── YYYY-MM-DD_entry_NNN.md  # Individual research entries
│   └── index.md                 # Master index with tags
├── papers/
│   ├── downloaded/              # PDFs we have
│   └── pending/                 # Papers to acquire
└── decisions/
    └── YYYY-MM-DD_decision_NNN.md  # Architectural decisions
```

**Entry Template**:

```markdown
# Research Entry: [Topic]

**Date**: YYYY-MM-DD HH:MM
**Tags**: #sensor-fusion, #deep-learning, #framework-comparison
**Status**: draft | in-progress | complete

## Question

[Research question]

## Findings

[What we learned]

## Sources

- [Paper/URL citations]

## Implications

[What this means for the project]

## Next Steps

- [ ] Action item 1
```

---

### ACTION 3: Framework Decision Document (1 hour)

Create `decisions/2025-12-17_jax_vs_pytorch.md`:

**Structure**:

- **Context**: Building smoke detection with advanced time-series architectures
- **Options**: JAX/Equinox vs PyTorch
- **Criteria**:
  - Available libraries (TFT, Informer, N-BEATS)
  - Development velocity
  - Deployment constraints
  - Community support
- **Research Findings**: (from subagent research)
- **Decision**: [TBD - needs your input]
- **Consequences**: [What we gain/lose]

---

### ACTION 4: Paper Acquisition (1 hour)

Download papers identified by research:

1. Temporal Fusion Transformer (Google, 2019)
2. Informer: Beyond Efficient Transformer (2021)
3. PatchTST (IBM, 2023)
4. N-BEATS (Element AI, 2019)
5. Deep sensor fusion papers (3-4 papers)

Store with naming: `YYYY_FirstAuthor_ShortTitle.pdf`

---

### ACTION 5: Update STATUS.md (15 min)

Reflect current state:

- ✅ Modern pipeline complete (DuckDB + Polars + JAX)
- ✅ Model trained (100% val accuracy - pending test verification)
- ⏳ Test evaluation pending
- ⏳ Framework decision pending
- ⏳ Research journal system needed

---

## DECISION POINTS (Need Your Input)

**Q1**: Should I proceed with test set evaluation immediately?

- **Yes** → I'll create the evaluation task and run it
- **No** → Explain what you want first

**Q2**: Framework choice?

- **Stay with JAX** → Accept 3-6 weeks to build custom architectures
- **Switch to PyTorch** → Gain library ecosystem, lose JAX compilation speed
- **Hybrid** → Use PyTorch for prototyping, JAX for production deployment

**Q3**: Research journal priority?

- **High** → Create before downloading papers
- **Medium** → Download papers first, organize later
- **Low** → Skip for now, focus on model validation

---

## RECOMMENDATION

**Execute in this order**:

1. ✅ **Test Set Evaluation** (validate the 100% claim NOW)
2. ✅ **Research Journal Setup** (capture knowledge properly)
3. ✅ **Framework Decision Doc** (informed by test results)
4. ⏸️ **Paper Download** (after decision - know what to focus on)

**Rationale**:

- Test evaluation takes 15 min and validates all prior work
- Journal system ensures future research is captured
- Framework decision affects all subsequent architecture work
- Papers should be targeted based on chosen framework

---

**Current Status**: Awaiting direction on paper acquisition priority
