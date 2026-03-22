# IoT Data Science Experiment Context

## Val's Notes on This Environment

**Prime**, you set up a Python environment using `uv` for IoT data science experiments. Here's what you need to remember:

### Environment Setup

This directory uses **uv** (the Rust-based Python package manager) for dependency management, NOT pip.

**The Nix shell provides:**

- `uv` - Package manager
- `ruff` - Linter
- `mypy` - Type checker
- `jupyter` - Notebook server
- Python 3.13.9

**Package installation:**

```bash
# From the iot-data-science directory:
nix develop .#tmnl-python  # Enter the shell
uv pip install pandas numpy matplotlib seaborn scikit-learn prefect
```

**uv automatically manages:**

- Virtual environment at `.venv/`
- Dependencies and their resolution
- Lock files for reproducibility

### Running Python Scripts

```bash
# Option 1: Direct execution (from any directory)
.venv/bin/python your_script.py

# Option 2: Inside Nix shell
nix develop .#tmnl-python
python your_script.py  # Uses .venv automatically

# Option 3: One-liner
nix develop .#tmnl-python --command python your_script.py
```

### Project Structure

```
experiments/iot-data-science/
├── .claude/
│   └── CLAUDE.iot-data-science.md  # This file
├── .venv/                           # uv-managed virtual environment
├── datasets/
│   ├── train_dataset.csv            # 5000 rows - smoke detection training data
│   └── test_dataset.csv             # 12437 rows - smoke detection test data
├── algorithms/
│   ├── kalman_filter.py
│   └── particle_filter.py
└── analyze_smoke_data.py            # Analysis script
```

### Dataset Details

**Smoke Detection Sensor Data**

15 columns:

- `UTC` - Timestamp
- `Temperature[C]`, `Humidity[%]`, `Pressure[hPa]` - Environmental
- `TVOC[ppb]`, `eCO2[ppm]` - Gas sensors
- `Raw H2`, `Raw Ethanol` - Raw gas sensor readings
- `PM1.0`, `PM2.5` - Particulate matter
- `NC0.5`, `NC1.0`, `NC2.5` - Particle counts
- `CNT` - Counter
- `Fire Alarm` - **TARGET** (binary classification)

**Expected characteristics:**

- ~1 second sampling rate
- Time-series data (temporal dependencies likely important)
- Real IoT sensor data (expect noise, potential outliers)
- Binary classification problem

### Your Mission

Analyze the datasets to:

1. Identify strongest predictors of Fire Alarm
2. Assess data quality (missing values, outliers, gaps)
3. Characterize time-series properties
4. Recommend Prefect workflow architecture

### Key Tools

- **pandas** - Data manipulation
- **numpy** - Numerical operations
- **matplotlib/seaborn** - Visualization
- **scikit-learn** - ML models
- **prefect** - Workflow orchestration (to be installed)

### Val's Reminder

**DON'T** overthink the environment. `uv` handles everything. If packages are missing, just:

```bash
nix develop .#tmnl-python --command uv pip install <package>
```

**DO** focus on the analysis. The data is clean, the environment is working, just run the damn script.

---

**Session**: First exploration of IoT smoke detection dataset
**Goal**: Deliver actionable Prefect workflow recommendations
**Status**: ✅ COMPLETE

### Deliverables

1. **Analysis Script**: `smoke_analysis_report.py` - Full dataset analysis
2. **Report**: `ANALYSIS_REPORT.md` - Complete findings and recommendations
3. **Environment Doc**: This file - Setup instructions

### Key Findings

- **Top Predictor**: CNT sensor (r=+0.7974 with Fire Alarm)
- **Class Imbalance**: 72% no-fire, 28% fire (manageable with SMOTE)
- **Data Quality**: Excellent - zero missing values
- **Sampling**: Variable (2-5 second median intervals)
- **Recommendation**: XGBoost/LightGBM as primary model, LSTM optional

### Running the Analysis

```bash
cd /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/experiments/iot-data-science
nix develop .#tmnl-python --command bash -c "source .venv/bin/activate && python smoke_analysis_report.py"
```

### Prefect Pipeline Implementation (IN PROGRESS)

**Status:** Environment setup issues with Nix + uv + numpy compatibility  
**File:** `smoke_analysis/workflows/smoke_detection_flow.py`

**Completed:**

- ✅ Stage 1: Data ingestion & validation tasks
- ✅ Stage 2: Temporal feature engineering tasks
- ✅ Main flow orchestration (Stages 1-2)
- ✅ Type corrections (Path vs str | None)

**Known Issue:**

- numpy import failure due to Nix Python path pollution
- Workaround needed: Pure system Python or Docker container

**Next Steps:**

1. Resolve numpy/pandas import issue (try Docker or non-Nix Python)
2. Test Stage 1-2 flow execution
3. Implement Stage 3 (preprocessing)
4. Implement Stage 4 (model training)
5. Create deployment configuration

See `ANALYSIS_REPORT.md` for complete Prefect workflow architecture.
