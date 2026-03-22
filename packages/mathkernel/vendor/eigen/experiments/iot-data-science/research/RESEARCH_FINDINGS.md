# Research Findings - Smoke Detection Project

**Created**: 2025-12-17
**Last Updated**: 2025-12-17

This document captures key research findings from subagent investigations and literature review.

---

## Current State Summary

### What We Did

**1. Validated the Modern Stack Pipeline (DuckDB + Polars + JAX + Prefect)**

- **Successfully ran complete 4-stage ML pipeline** on smoke detection data:
  - Stage 1: Ingested 5,000 train + 12,437 test samples into DuckDB
  - Stage 2: Generated 84 features via SQL (temporal, rolling windows, differentials)
  - Stage 3: Exported to Parquet (2.06 MB train, 4.79 MB test)
  - Stage 4: Trained JAX/Equinox MLP achieving **100% validation accuracy**

**2. Fixed Technical Issues**

- **SQL column naming bug**: `Humidity[%]` → `Humidity_pct` (preserves semantic meaning)
- **NaN loss problem**: Added data cleaning + gradient clipping
- **Package installations**: equinox, optax, scikit-learn via `uv` in Nix shell

**3. Deep Research via Subagents**

- Researched cutting-edge sensor fusion papers
- Investigated JAX/Equinox vs PyTorch ecosystem maturity
- Explored evaluation methodologies for safety-critical systems
- Analyzed streaming ML pipeline architectures

---

## Files Modified/Created

### Modified

- `experiments/iot-data-science/smoke_analysis/workflows/smoke_detection_flow_modern.py` - Complete working pipeline

### Created

- `experiments/iot-data-science/smoke_analysis/data/smoke.db` - DuckDB with raw + feature tables
- `experiments/iot-data-science/smoke_analysis/data/processed/*.parquet` - Train/test features
- `experiments/iot-data-science/smoke_analysis/models/smoke_detector_jax.eqx` - Trained model

### Papers Status

- Only 3 basic PDFs downloaded (Kalman/particle filter fundamentals)
- **Missing**: Modern deep learning papers from research findings

---

## Critical Discoveries

### 1. JAX Ecosystem Gap ⚠️

**Finding**: Most SOTA time-series architectures (TFT, Informer, PatchTST) **only exist in PyTorch**

**Evidence**:

- JAX/Equinox requires building custom architectures (3-6 weeks effort)
- PyTorch has mature libraries: PyTorch Forecasting, Darts, Time-Series-Library
- Pre-built TFT, Informer, N-BEATS implementations ready to use in PyTorch

**Implication**:

- **User concern validated**: PyTorch dominance is due to compounding library efforts, not technical superiority
- **Trade-off**: JAX offers speed, PyTorch offers velocity
- **Decision needed**: Choose framework before building advanced architectures

### 2. 100% Accuracy Is Suspicious ⚠️

**Finding**: Model achieved 100% validation accuracy, but test set evaluation never performed

**Risk**:

- Could be overfitting
- Could indicate problem is genuinely simple with engineered features
- **MUST validate on test set** (12,437 samples) before trusting results

**Action Required**:

- Create `evaluate_test_set()` task
- Run inference on held-out test data
- Report confusion matrix, per-class metrics

### 3. Feature Engineering Quality ✅

**Finding**: SQL-based feature engineering in DuckDB is powerful and maintainable

**Evidence**:

- Generated 84 features from 5 base sensors
- Temporal features (hour, day_of_week, is_weekend)
- Rolling windows (10, 30, 60 samples)
- Differentials (rate of change)

**Implication**:

- Feature engineering likely contributes to high accuracy
- DuckDB SQL is production-ready for this use case
- Could be replicated in streaming context

---

## Untouched Components

- ❌ Kalman/Particle filters (implemented but not integrated)
- ❌ Jupyter notebooks (template exists, not run)
- ❌ Dash dashboard (installed, not built)
- ❌ **Test set evaluation (critical gap!)**
- ❌ Model explainability (SHAP/LIME)
- ❌ Streaming pipeline (researched, not implemented)

---

## Key Papers Identified (Not Yet Downloaded)

### Time-Series Architectures

1. **Temporal Fusion Transformer (TFT)** - Google, 2019
   - Interpretable multi-horizon forecasting
   - Attention mechanisms for variable selection
2. **Informer** - 2021
   - Efficient long-sequence time-series
   - ProbSparse self-attention
3. **PatchTST** - IBM, 2023
   - Current SOTA for time-series
   - Channel-independence assumption
4. **N-BEATS** - Element AI, 2019
   - Pure deep learning, no feature engineering
   - Trend + seasonality decomposition

### Sensor Fusion

5. **Deep Learning for Inertial Positioning** (arXiv 2303.03757)
6. **Multi-sensor Fusion for Embodied AI** (arXiv 2506.19769)
7. **Radar + Vision Deep Fusion** (arXiv 2406.00714)
8. **Sensor Fusion Survey** (arXiv 2307.00014)

---

## Framework Decision Context

### JAX/Equinox

**Pros**:

- Compilation speed (XLA)
- Functional programming paradigm
- Clean gradient transformations

**Cons**:

- Limited ecosystem for time-series
- Must build TFT/Informer from scratch
- 3-6 weeks development time

### PyTorch

**Pros**:

- Mature time-series libraries
- Pre-built SOTA architectures
- Large community support

**Cons**:

- Slower than JAX (no XLA)
- More imperative style
- Potentially messier gradients

### Recommendation

**Hybrid approach**:

1. Prototype with PyTorch (fast iteration)
2. Validate architectures work
3. Port to JAX for production (if speed critical)

---

## Next Research Questions

1. **Why 100% validation accuracy?**

   - Is the problem too easy?
   - Are features too good?
   - Is there data leakage?
   - Answer: Run test set evaluation

2. **Which time-series architecture is best for smoke detection?**

   - TFT for interpretability?
   - Informer for long sequences?
   - N-BEATS for simplicity?
   - Answer: Benchmark all after framework decision

3. **Can we deploy this on edge devices?**
   - Latency requirements?
   - Model size constraints?
   - Answer: Requires deployment research

---

## Status

**Completed**:

- ✅ Modern pipeline (DuckDB + Polars + JAX)
- ✅ 84 engineered features
- ✅ Trained model (100% val accuracy)
- ✅ Research on frameworks/architectures

**Pending**:

- ⏳ Test set evaluation (CRITICAL)
- ⏳ Framework decision
- ⏳ Paper acquisition
- ⏳ Advanced architecture implementation
- ⏳ Deployment planning

---

**Last Updated**: 2025-12-17 by Val
