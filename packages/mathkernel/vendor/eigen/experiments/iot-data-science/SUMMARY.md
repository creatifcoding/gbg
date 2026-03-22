# 🎯 IoT Data Science - Complete Setup Summary

**Date**: 2025-12-16  
**Status**: ✅ READY FOR USE  
**Next Step**: Download dataset from Kaggle

---

## 📦 What's Been Assembled

### 1. Full Python Environment (NixOS + uv)
- **Python**: 3.13.9 (from Nix store)
- **Package Manager**: uv 0.9.15
- **Virtual Environment**: `.venv/` with 124 packages
- **Nix Integration**: `nix/modules/python.nix` provides libstdc++

### 2. Implemented Algorithms
- ✅ **Kalman Filter** (350 lines) - Temperature smoothing, 2-sensor fusion
- ✅ **Particle Filter** (350 lines) - Non-linear tracking, multi-sensor fusion

### 3. Academic Papers (3 PDFs downloaded)
- Aalto: Basics of Sensor Fusion (796KB)
- Berkeley: Kalman Filter Tutorial (360KB)
- Texas A&M: Particle Filter Application (1.1MB)

### 4. Documentation (Living Docs)
- `README.md` - Research overview & questions
- `GETTING_STARTED.md` - Week-by-week learning path
- `PYTHON_ENV.md` - Operational context (THIS IS THE KEY DOC)
- `STATUS.md` - Current state snapshot

### 5. Jupyter Notebook Template
- `01_exploratory_data_analysis.ipynb` - Ready for dataset

---

## 🚀 Quick Start (Copy-Paste)

```bash
# 1. Download dataset manually from:
# https://www.kaggle.com/datasets/gauravduttakiit/sensorfusion-smoke-detection-classification
# Place smoke_detection_iot.csv in experiments/iot-data-science/datasets/

# 2. Enter Nix shell (REQUIRED for libstdc++)
cd packages/tmnl
nix develop .#tmnl-python

# 3. Activate venv
cd experiments/iot-data-science
source .venv/bin/activate

# 4. Test algorithms
python algorithms/kalman_filter.py
python algorithms/particle_filter.py

# 5. Launch Jupyter
jupyter lab  # Browser opens at localhost:8888
```

---

## 📊 Installed Packages (Key)

| Package | Version | Purpose |
|---------|---------|---------|
| numpy | 2.3.5 | Numerical arrays |
| pandas | 2.3.3 | DataFrames |
| matplotlib | 3.10.8 | Plotting |
| seaborn | 0.13.2 | Statistical viz |
| scikit-learn | 1.8.0 | ML algorithms |
| plotly | 6.5.0 | Interactive plots |
| dash | 3.3.0 | Dashboards |
| filterpy | 1.4.5 | Kalman filters |
| jupyter | 1.1.1 | Notebooks |

---

## 🎯 Research Questions Ready to Attack

### Beginner
1. Sensor redundancy: 3 sensors instead of 14?
2. Missing data robustness: 10%, 20%, 30% missing
3. Feature importance: Which sensor matters most?

### Intermediate
4. Temporal fusion: 30s before alarm patterns
5. Multi-modal correlation: Gas sensors compensate for temp drift?
6. Anomaly detection: Detect fire BEFORE alarm?

### Advanced
7. Causal inference: PM2.5 → Alarm causation
8. Attention mechanisms: Which sensors when?
9. Real-time edge: <100ms latency on Raspberry Pi

---

## ⚠️ CRITICAL: libstdc++ Issue

**Problem**: NumPy C-extensions need libstdc++.so.6

**Solution**: ALWAYS run Python inside Nix shell:
```bash
nix develop .#tmnl-python  # Sets LD_LIBRARY_PATH
```

**See**: `PYTHON_ENV.md` for full details

---

## 📁 Directory Structure

```
experiments/iot-data-science/
├── algorithms/
│   ├── kalman_filter.py          # Linear sensor fusion
│   └── particle_filter.py        # Non-linear sensor fusion
├── datasets/
│   └── (empty - download smoke_detection_iot.csv here)
├── notebooks/
│   └── 01_exploratory_data_analysis.ipynb
├── papers/
│   ├── 01_basics_of_sensor_fusion_aalto.pdf
│   ├── 02_kalman_filter_berkeley.pdf
│   └── 03_particle_filter_heart_rate.pdf
├── .venv/                        # Virtual environment (124 packages)
├── pyproject.toml                # Dependency manifest
├── GETTING_STARTED.md            # Learning path
├── PYTHON_ENV.md                 # ⭐ OPERATIONAL CONTEXT (READ THIS)
├── README.md                     # Overview
├── STATUS.md                     # Current state
└── SUMMARY.md                    # This file
```

---

## 📖 Read This Next

1. **`PYTHON_ENV.md`** - Understand the Nix/uv setup
2. **`GETTING_STARTED.md`** - Week-by-week plan
3. **Download dataset** - Manual step required
4. **Run `01_exploratory_data_analysis.ipynb`**

---

## 🔗 External Resources

### Datasets
- [Smoke Detection (Primary)](https://www.kaggle.com/datasets/gauravduttakiit/sensorfusion-smoke-detection-classification)
- [Smart Building](https://www.kaggle.com/datasets/ranakrc/smart-building-system)
- [Traffic Fusion](https://www.kaggle.com/datasets/zoya77/dynamic-traffic-signal-sensor-fusion-dataset)

### Papers
- [Deep Learning Inertial (arXiv 2303.03757)](https://arxiv.org/abs/2303.03757)
- [Sensor Fusion Survey (arXiv 2307.00014)](https://arxiv.org/abs/2307.00014)
- [Multi-Modal Fusion (arXiv 2506.19769)](https://arxiv.org/abs/2506.19769)

---

**Ready to dive in? Start with the dataset download!**
