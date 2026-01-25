# Training Run 001 - Baseline MLP

**Date**: 2025-12-16  
**Duration**: ~1.5 minutes (50 epochs on CPU)  
**Status**: ✅ Complete

---

## Model Configuration

### Architecture

```
Input: 13 features (Temperature, Humidity, TVOC, eCO2, PM sensors, CNT)
  ↓
Layer 1: Linear(13 → 64) + GELU
  ↓
Layer 2: Linear(64 → 32) + GELU
  ↓
Layer 3: Linear(32 → 2)
  ↓
Output: 2 classes (no fire / fire)
```

**Total Parameters**: ~3,000

### Training Hyperparameters

- **Optimizer**: Adam
- **Learning Rate**: 1e-3
- **Batch Size**: 64
- **Epochs**: 50
- **Loss**: Binary cross-entropy with class weights
- **Class Weights**: [0.688, 1.833] (inverse frequency)

### Dataset Split

- **Total Training Data**: 5,000 samples
- **Train Set**: 4,000 samples (80%)
- **Validation Set**: 1,000 samples (20%)
- **Class Distribution**:
  - No Fire: 2,909 samples (72.7%)
  - Fire: 1,091 samples (27.3%)

---

## Results

### Final Metrics

```
Train Accuracy:      100.0%
Validation Accuracy:  99.9%
Final Loss:          0.0007
```

### Training Progression

| Epoch | Loss   | Train Acc | Val Acc |
| ----- | ------ | --------- | ------- |
| 10    | 0.0081 | 99.9%     | 99.7%   |
| 20    | 0.0030 | 100.0%    | 99.9%   |
| 30    | 0.0011 | 100.0%    | 99.9%   |
| 40    | 0.0009 | 100.0%    | 99.9%   |
| 50    | 0.0007 | 100.0%    | 99.9%   |

### Convergence

- Model converged by **epoch 20**
- Validation accuracy plateaued at **99.9%**
- No signs of overfitting (train/val gap minimal)

---

## Analysis

### Why Such High Accuracy?

The **CNT sensor** has a very strong correlation (+0.7974) with fire alarms, making this a relatively easy classification task. The model essentially learned to rely heavily on CNT values.

### Feature Importance (from DuckDB analysis)

```
CNT:            +0.7974  ← Primary predictor
Humidity:       +0.3112
Temperature:    -0.1723
TVOC:           -0.1291
PM2.5:          -0.0415
```

### Potential Issues

1. **Too Perfect?** - 99.9% accuracy might indicate:

   - Data leakage (unlikely - different train/val split)
   - Extremely clean/synthetic patterns in IoT data
   - Very separable classes in feature space

2. **Generalization Concern** - Need to test on the 12,437 held-out test samples to confirm performance.

---

## Training Environment

### Hardware

- **Device**: CPU (no GPU detected)
- **CPU Usage**: ~122% (multi-core utilization)
- **Memory**: ~615 MB

### Software Stack

```
Python:       3.14.0
JAX:          0.8.1
JAXlib:       0.8.1 (CPU-only)
Equinox:      0.13.2
Optax:        0.2.6
```

### System

```
WARNING: An NVIDIA GPU may be present on this machine, but a
CUDA-enabled jaxlib is not installed. Falling back to cpu.
```

---

## Files Generated

- **Training Log**: `training.log`
- **Model Code**: `train_simple.py`
- **Data Analysis**: `analyze_with_duckdb.py`
- **Processed Data**: `smoke_analysis/data/processed/train_with_features.parquet`

---

## Next Steps

1. **Generate Test Predictions**

   - Load 12,437 test samples
   - Run inference with trained model
   - Export predictions to CSV for submission

2. **Model Analysis**

   - Confusion matrix breakdown
   - Per-class precision/recall
   - Feature importance visualization

3. **Model Improvements** (if needed)

   - Add dropout for regularization
   - Experiment with deeper architectures
   - Try ensemble methods

4. **Production Deployment**
   - Export model to ONNX format
   - Create REST API endpoint
   - Real-time inference pipeline

---

## Conclusion

The baseline MLP achieved **99.9% validation accuracy** with minimal training time. The model successfully learned to classify smoke detection events using IoT sensor data, primarily leveraging the CNT sensor's strong predictive signal.

**Ready for test set evaluation.**
