# IoT Smoke Detection Project - Comprehensive Summary

## Overview

Complete end-to-end machine learning project for smoke/fire detection using real IoT sensor data. Built with JAX, DuckDB, Polars, and UV package management.

---

## Dataset

### Source
Real IoT sensor measurements from smoke detection systems

### Size
- **Training**: 5,000 samples
- **Test**: 12,437 samples (predictions only, no ground truth)

### Features (13 sensors + 1 meta)
1. Temperature[C]
2. Humidity[%]
3. TVOC[ppb] (Total Volatile Organic Compounds)
4. eCO2[ppm] (Equivalent CO2)
5. Raw H2 (Hydrogen sensor)
6. Raw Ethanol
7. Pressure[hPa]
8. PM1.0 (Particulate Matter)
9. PM2.5
10. NC0.5 (Particle count 0.5µm)
11. NC1.0
12. NC2.5
13. **CNT** (Counter/sensor reading)
14. UTC (timestamp - excluded from training)

### Target
- **Fire Alarm**: Binary (0 = no fire, 1 = fire)
- **Distribution**: 72.3% no fire, 27.7% fire

---

## Model Architecture

### Type
Simple Multi-Layer Perceptron (MLP) implemented in JAX + Equinox

### Structure
```
Input: 13 features
  ↓ GELU
Hidden 1: 64 neurons
  ↓ GELU
Hidden 2: 32 neurons
  ↓ Linear
Output: 2 classes (softmax)
```

### Training Configuration
- **Optimizer**: Adam (lr=1e-3)
- **Loss**: Cross-entropy with class weights
- **Epochs**: 50
- **Batch Size**: 64
- **Train/Val Split**: 80/20

### Class Weighting
Inverse frequency to handle imbalance:
- No Fire (72.3%): weight = 0.692
- Fire (27.7%): weight = 1.807

---

## Results

### Training Performance
- **Training Accuracy**: 100.0%
- **Validation Accuracy**: 99.9%
- **Final Loss**: 0.0007
- **Convergence**: Epoch 20 (continued to 50)
- **Training Time**: ~1.5 minutes (CPU)

### Test Predictions
- **Total Predictions**: 12,437
- **Predicted Distribution**:
  - No Fire: 71.9% (8,936 samples)
  - Fire: 28.1% (3,501 samples)
- **Matches Training**: ✅ (72.3% vs 71.9%)

### Confidence Analysis
| Confidence Level | Count | Percentage |
|-----------------|-------|------------|
| Very High (90-100%) | 3,488 | 28.05% |
| High (70-90%) | 8 | 0.06% |
| Medium (60-70%) | 3 | 0.02% |
| Low (40-60%) | 2 | 0.02% |
| Very Low (0-40%) | 8,936 | 71.85% |

**Key Finding**: 99.9% of predictions are decisive (>90% or <40% probability)

---

## Feature Importance (Gradient-based)

| Rank | Feature | Importance | Notes |
|------|---------|-----------|-------|
| 1 | **CNT** | 43.88% | Dominant predictor |
| 2 | Pressure[hPa] | 12.83% | Secondary importance |
| 3 | Raw Ethanol | 12.46% | Chemical sensor |
| 4 | Raw H2 | 6.75% | Hydrogen detection |
| 5 | Humidity[%] | 5.57% | Environmental |
| ... | ... | ... | ... |
| 13 | eCO2[ppm] | 0.49% | Minimal impact |

**Insight**: CNT sensor alone provides ~44% of discriminative power

---

## Advanced Analysis (DuckDB + SQL)

### 1. Feature Correlations

**Top Correlation with Fire Alarm**:
- CNT: +0.7974 (extremely strong)
- Humidity: +0.3112
- Temperature: -0.1723
- TVOC: -0.1291

**Sensor Correlations**:
- PM2.5 vs PM1.0: 0.9552 (highly correlated - redundant)
- CNT vs Humidity: 0.1335
- CNT vs Temperature: -0.1246

### 2. Anomaly Detection

**Percentile-based (5th/95th percentile)**:
- CNT Anomalies: 499 samples (10%)
- Temperature Anomalies: 498 samples (10%)

**Z-Score Outliers (|z| > 3)**:
- Total Outliers: 49
- **ALL 49 have fire alarms** (100% fire rate!)
- CNT Range: 24,220 - 24,961 (extremely high)

**Insight**: Extreme CNT values are perfect fire indicators

### 3. Co-Occurrence Patterns

**High CNT + Normal Humidity**:
- Fire Rate: 92.1% (663/720)

**Normal CNT + Normal Humidity**:
- Fire Rate: 3.5% (105/3,033)

**Insight**: High CNT is dominant signal regardless of humidity

### 4. Temporal Patterns

Fire alarm rate across 10 time buckets:
- Minimum: 24.8% (bucket 6)
- Maximum: 30.4% (bucket 2)
- **Variance: ±2.8%** (very stable)

**Insight**: Fire occurrence is relatively uniform across time

---

## Files Generated

### Models
```
results/
├── model_run_001.eqx                    # Trained weights (13KB)
```

### Predictions
```
results/
├── test_predictions_run_001.csv         # All 12,437 predictions
```

### Analysis Outputs
```
results/
├── feature_importance.csv               # Gradient-based rankings
├── confidence_distribution.csv          # Prediction confidence stats
├── medium_confidence_predictions.csv    # 2 uncertain samples
├── sensor_correlations.csv              # Multi-sensor correlations
├── temporal_patterns.csv                # Time bucket analysis
├── train_with_rolling_features.parquet  # Rolling window features
```

### Processed Data
```
smoke_analysis/data/processed/
├── train_with_features.parquet          # DuckDB feature engineering
```

### Documentation
```
├── COMPREHENSIVE_SUMMARY.md             # This file
├── FINAL_SUMMARY.md                     # Quick overview
├── results/training_run_001.md          # Training details
├── results/test_predictions_summary.md  # Prediction analysis
```

---

## Technology Stack

### Python Packages (via UV)
```bash
jax==0.8.1              # ML framework
jaxlib==0.8.1           # JAX backend
equinox==0.13.2         # Neural networks in JAX
optax==0.2.6            # Optimizers
duckdb==1.4.3           # SQL analytics
polars==1.36.1          # Fast DataFrames
pyarrow==22.0.0         # Arrow integration
```

### Infrastructure
- **Package Manager**: UV (Python venv manager)
- **SQL Engine**: DuckDB CLI (via Nix)
- **Platform**: Linux (CPU-only)

---

## Key Insights

### 1. CNT Sensor Dominance
The CNT sensor has:
- +0.7974 correlation with fire alarms
- 43.88% feature importance
- Perfect separation at extreme values (z > 3)

**Implication**: Model heavily relies on single feature - consider ensemble methods or feature engineering to reduce over-reliance

### 2. Near-Perfect Separation
99.9% validation accuracy suggests:
- Classes are highly separable
- Simple MLP is sufficient
- Limited need for complex architectures

**Caveat**: Performance on true test set (with labels) may differ

### 3. Medium-Confidence Samples
Only 2 samples (0.02%) have uncertain predictions (40-60% probability):
- Sample 10435: 50.95% fire
- Sample 2323: 54.60% fire

**Characteristics**:
- Both have CNT ≈ 3,800 (mid-range)
- Similar temperature, humidity, pressure
- Near decision boundary

**Insight**: Model is decisive except at rare CNT mid-range values

### 4. Class Distribution Consistency
Training (72.3%/27.7%) vs Test Predictions (71.9%/28.1%) match closely

**Implication**: Model learned generalizable patterns, not just memorization

---

## Production Readiness Checklist

- [x] Model trained and validated (99.9% accuracy)
- [x] Test predictions generated (12,437 samples)
- [x] Feature importance analyzed
- [x] Anomaly patterns identified
- [x] Confidence levels assessed
- [x] Results documented
- [ ] Ground truth evaluation (requires labeled test set)
- [ ] Confusion matrix (requires labels)
- [ ] Precision/Recall metrics (requires labels)
- [ ] Model deployment (ONNX export, REST API)
- [ ] Real-time inference pipeline
- [ ] Monitoring/alerting system

---

## Future Work

### Model Improvements
1. **Ensemble Methods**: Combine multiple models to reduce CNT over-reliance
2. **Feature Engineering**: Rolling averages, derivatives, rate of change
3. **Deeper Networks**: Try 3-4 hidden layers
4. **Regularization**: Add dropout to prevent overfitting
5. **Hyperparameter Tuning**: Grid search over learning rates, batch sizes

### Data Science
1. **Time-Series Analysis**: Detect fire propagation patterns
2. **SHAP Values**: More robust feature importance
3. **Clustering**: Identify fire "profiles" (smoldering vs flaming)
4. **Synthetic Data**: Generate edge cases for robustness testing

### Engineering
1. **ONNX Export**: Deploy to embedded systems
2. **REST API**: Create inference endpoint
3. **Streaming Pipeline**: Real-time sensor data processing
4. **A/B Testing**: Compare model versions in production
5. **Model Monitoring**: Track drift, degradation over time

---

## How to Reproduce

### 1. Setup Environment
```bash
cd experiments/iot-data-science
uv pip install jax jaxlib equinox optax duckdb polars pyarrow
```

### 2. Run DuckDB Analysis
```bash
uv run python analyze_with_duckdb.py
```

### 3. Train Model
```bash
uv run python train_simple.py
```

### 4. Generate Predictions
```bash
uv run python predict_test.py
```

### 5. Analyze Results
```bash
uv run python analyze_model.py
uv run python advanced_duckdb_analysis.py
```

---

## Contact / Notes

- **Project Type**: Kaggle-style ML competition submission
- **Dataset**: Real IoT sensor measurements (not synthetic)
- **Status**: Model trained, predictions ready for evaluation
- **Next Step**: Submit predictions OR deploy model for real-time inference

---

**Last Updated**: 2025-12-16
**Training Platform**: Linux CPU (no GPU acceleration)
**Total Development Time**: ~2 hours (setup + training + analysis)
