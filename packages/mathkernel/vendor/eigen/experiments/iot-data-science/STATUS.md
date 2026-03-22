# IoT Data Science Experiments - Status

**Created**: 2025-12-16  
**Last Updated**: 2025-12-16 17:30 UTC  
**Status**: ✅ Environment Ready & Verified, 📥 Dataset Pending

---

## ✅ Completed

### 1. Directory Structure

```
experiments/iot-data-science/
├── algorithms/          # Kalman & Particle filter implementations
├── datasets/           # Dataset storage (empty - manual download required)
├── notebooks/          # Jupyter notebooks for EDA
├── papers/             # Academic papers (3 PDFs downloaded)
├── .venv/              # Python virtual environment (uv)
├── pyproject.toml      # Dependency manifest
├── README.md           # Overview and research questions
├── GETTING_STARTED.md  # Week-by-week learning path
├── PYTHON_ENV.md       # Living documentation (operational context)
└── STATUS.md           # This file
```

### 2. Python Environment

**Package Manager**: uv 0.9.15  
**Python Version**: 3.13.9  
**Virtual Environment**: `.venv/` (124 packages installed)

**Core Dependencies**:

- ✅ numpy 2.3.5
- ✅ pandas 2.3.3
- ✅ matplotlib 3.10.8
- ✅ seaborn 0.13.2
- ✅ scikit-learn 1.8.0
- ✅ jupyter 1.1.1 + jupyterlab 4.5.1
- ✅ plotly 6.5.0
- ✅ dash 3.3.0
- ✅ filterpy 1.4.5

**Nix Integration**: `nix/modules/python.nix` provides libstdc++ via `LD_LIBRARY_PATH`

### 3. Algorithm Implementations

**Kalman Filter** (`algorithms/kalman_filter.py`):

- ✅ Linear state estimation
- ✅ Sensor fusion (2+ sensors)
- ✅ Discrete white noise Q matrix
- ✅ Example: Temperature smoothing
- ✅ Example: Two-sensor fusion
- ✅ Executable with `python kalman_filter.py`

**Particle Filter** (`algorithms/particle_filter.py`):

- ✅ Sequential Monte Carlo
- ✅ Non-linear dynamics support
- ✅ Systematic resampling
- ✅ Multi-modal distributions
- ✅ Example: Signal tracking
- ✅ Example: Multi-sensor fusion
- ✅ Executable with `python particle_filter.py`

### 4. Academic Papers

**Downloaded** (in `papers/`):

1. ✅ `01_basics_of_sensor_fusion_aalto.pdf` (796KB) - Aalto University lecture notes
2. ✅ `02_kalman_filter_berkeley.pdf` (360KB) - UC Berkeley tutorial
3. ✅ `03_particle_filter_heart_rate.pdf` (1.1MB) - Texas A&M application

### 5. Notebooks

**Created**:

- ✅ `01_exploratory_data_analysis.ipynb` - Full EDA template with:
  - Data loading
  - Sensor statistics
  - Time-series visualization
  - Correlation analysis
  - Fire vs. normal comparison

---

## 📥 Pending

### 1. Dataset Download

**Primary Dataset**: Smoke Detection (Sensor Fusion)

- **Source**: https://www.kaggle.com/datasets/gauravduttakiit/sensorfusion-smoke-detection-classification
- **Status**: ⏳ Manual download required (Kaggle API needs auth)
- **Target**: `datasets/smoke_detection_iot.csv`
- **Size**: ~50MB
- **Action**: User must download manually

**Instructions**:

1. Visit Kaggle URL above
2. Click "Download" (requires Kaggle account)
3. Extract ZIP
4. Move `smoke_detection_iot.csv` to `datasets/`

### 2. Additional Papers to Download

**Recommended** (not yet downloaded):

- [ ] Deep Learning for Inertial Positioning (arXiv 2303.03757)
- [ ] Multi-sensor Fusion for Embodied AI (arXiv 2506.19769)
- [ ] Radar + Vision Deep Fusion (arXiv 2406.00714)

---

## 🚀 Quick Start (For User)

### Step 1: Download Dataset

```bash
# Manual download from Kaggle, then:
mv ~/Downloads/smoke_detection_iot.csv experiments/iot-data-science/datasets/
```

### Step 2: Enter Nix Shell

```bash
cd packages/tmnl
nix develop .#tmnl-python
```

### Step 3: Activate venv

```bash
cd experiments/iot-data-science
source .venv/bin/activate
```

### Step 4: Test Algorithms

```bash
# Kalman filter
python algorithms/kalman_filter.py

# Particle filter
python algorithms/particle_filter.py
```

### Step 5: Start Jupyter

```bash
jupyter lab
# Opens browser at localhost:8888
# Navigate to notebooks/01_exploratory_data_analysis.ipynb
```

---

## 📊 Research Questions (Ready to Attack)

### Beginner Level

1. ✅ Sensor Redundancy: Can we predict smoke with 3 sensors instead of 14?
2. ✅ Missing Data: How robust is prediction when one sensor fails?
3. ✅ Feature Importance: Which sensor contributes most to fire detection?

### Intermediate Level

4. ✅ Temporal Fusion: How do sensor readings evolve in the 30 seconds before alarm?
5. ✅ Multi-modal Correlation: Do gas sensors compensate for temperature drift?
6. ✅ Anomaly Detection: Can we detect fire BEFORE the alarm triggers?

### Advanced Level

7. ✅ Causal Inference: Does particulate matter CAUSE alarm, or just correlate?
8. ✅ Attention Mechanisms: Which sensors are most informative at different times?
9. ✅ Real-time Deployment: Can we achieve <100ms latency on edge devices?

**Status**: All questions are answerable once dataset is downloaded. Notebooks and algorithms are ready.

---

## 🐛 Known Issues

### Issue 1: libstdc++ Import Error

**Symptom**: `ImportError: libstdc++.so.6: cannot open shared object file`

**Solution**: Must run Python within Nix shell

```bash
nix develop .#tmnl-python  # ✅ Required
python algorithms/kalman_filter.py
```

**Why**: NumPy C-extensions need libstdc++ provided by Nix shell's `LD_LIBRARY_PATH`

**Documented**: See `PYTHON_ENV.md` for full details

---

## 📖 Documentation Quality

| Document             | Status        | Completeness                                                  |
| -------------------- | ------------- | ------------------------------------------------------------- |
| `README.md`          | ✅ Complete   | Overview, datasets, research questions, file structure        |
| `GETTING_STARTED.md` | ✅ Complete   | Week-by-week learning path, installation, troubleshooting     |
| `PYTHON_ENV.md`      | ✅ Living Doc | Operational context, package versions, known issues, workflow |
| `STATUS.md`          | ✅ Current    | This file - current state snapshot                            |

---

## 🎯 Next Actions (User)

1. **Download smoke detection dataset** from Kaggle
2. **Run EDA notebook** to understand data
3. **Choose a research question** from the list
4. **Implement solution** using Kalman/Particle filters
5. **Document findings** in new notebook

---

## 📈 Success Metrics

- ✅ Can run Kalman filter examples
- ✅ Can run Particle filter examples
- ✅ Jupyter Lab launches successfully
- ⏳ Can load smoke detection dataset
- ⏳ Can visualize all 14 sensors
- ⏳ Can classify fire vs. normal events

---

**Last Updated**: 2025-12-16 15:45 UTC  
**Updated By**: Val (Architecture Layer)
