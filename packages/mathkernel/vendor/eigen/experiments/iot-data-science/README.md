# IoT Data Science Experiments

**Created**: 2025-12-16  
**Purpose**: Exploration of sensor fusion, time-series analysis, and IoT data visualization challenges

---

## 📁 Directory Structure

```
experiments/iot-data-science/
├── datasets/           # Downloaded IoT datasets
├── papers/            # Academic papers and research
├── notebooks/         # Jupyter/Python notebooks for exploration
├── algorithms/        # Implementation of fusion algorithms
└── README.md          # This file
```

---

## 🎯 Research Focus Areas

### 1. **Sensor Fusion Challenges**

- Time synchronization across heterogeneous sensors
- Geometric misalignment and calibration
- Multi-modal data integration
- Heterogeneous data quality handling

### 2. **Data Visualization**

- Real-time streaming visualization
- Multi-dimensional data representation
- Cognitive load management
- Uncertainty visualization

### 3. **Algorithms to Implement**

- Kalman Filters (linear state estimation)
- Extended Kalman Filters (non-linear)
- Particle Filters (Bayesian inference)
- Deep Learning fusion architectures

---

## 📊 Datasets

### Primary: Smoke Detection (Sensor Fusion)

**Source**: [Kaggle - Sensor Fusion Smoke Detection](https://www.kaggle.com/datasets/gauravduttakiit/sensorfusion-smoke-detection-classification)

**Sensors**:

- Temperature, Humidity, Pressure
- TVOC (Total Volatile Organic Compounds)
- eCO2 (CO2 equivalent)
- Raw H2, Raw Ethanol
- PM1.0, PM2.5 (Particulate Matter)
- NC0.5, NC1.0, NC2.5 (Particle Number Concentration)

**Use Cases**:

- Multi-sensor classification
- Sensor importance ranking
- Missing data imputation
- Real-time anomaly detection

### Secondary Datasets (Planned)

- Smart Building System (255 sensors, 51 rooms)
- Traffic Signal Sensor Fusion
- Multi-modal sensor fusion datasets

---

## 📚 Key Papers

### Fundamentals

1. **`01_basics_of_sensor_fusion_aalto.pdf`**

   - Authors: Aalto University (Simo Särkkä)
   - Topic: M.Sc. level introduction to sensor fusion
   - Key Algorithms: Kalman filters, Bayesian estimation

2. **`02_kalman_filter_berkeley.pdf`**

   - Authors: UC Berkeley Statistics
   - Topic: Kalman Filter, constrained regression
   - Application: Sequential state estimation

3. **`03_particle_filter_heart_rate.pdf`**
   - Authors: Texas A&M (Jafari Lab)
   - Topic: Particle filtering for robust monitoring
   - Application: Sensor fusion under uncertainty

### Advanced Topics (To Download)

- Deep Learning for Inertial Positioning (arXiv 2303.03757)
- Multi-sensor Fusion for Embodied AI (arXiv 2506.19769)
- Radar + Vision Deep Fusion (arXiv 2406.00714)

---

## 🛠️ Algorithm Implementations

### Planned Implementations:

#### 1. **Kalman Filter** (`algorithms/kalman_filter.py`)

- Linear state estimation
- Use case: Temperature sensor fusion with drift correction

#### 2. **Particle Filter** (`algorithms/particle_filter.py`)

- Non-parametric Bayesian inference
- Use case: Multi-modal smoke detection

#### 3. **Deep Sensor Fusion** (`algorithms/deep_fusion.py`)

- Attention-based temporal fusion
- Use case: Learning sensor weights from data

---

## 🚀 Quick Start

### Step 1: Install Dependencies

```bash
pip install pandas numpy matplotlib seaborn scikit-learn jupyter
pip install plotly dash  # For interactive visualization
```

### Step 2: Download Dataset

```bash
# Manual download from Kaggle required (API key needed)
# Place in datasets/ directory
```

### Step 3: Initial Exploration

```bash
cd notebooks/
jupyter notebook 01_exploratory_data_analysis.ipynb
```

---

## 📈 Research Questions

### Beginner Level

1. **Sensor Redundancy**: Can we predict smoke with 3 sensors instead of 14?
2. **Missing Data**: How robust is prediction when one sensor fails?
3. **Feature Importance**: Which sensor contributes most to fire detection?

### Intermediate Level

4. **Temporal Fusion**: How do sensor readings evolve in the 30 seconds before alarm?
5. **Multi-modal Correlation**: Do gas sensors compensate for temperature drift?
6. **Anomaly Detection**: Can we detect fire BEFORE the alarm triggers?

### Advanced Level

7. **Causal Inference**: Does particulate matter CAUSE alarm, or just correlate?
8. **Attention Mechanisms**: Which sensors are most informative at different times?
9. **Real-time Deployment**: Can we achieve <100ms latency on edge devices?

---

## 🎓 Learning Path

### Week 1: Foundation

- Read `01_basics_of_sensor_fusion_aalto.pdf` (Chapters 1-3)
- Explore smoke detection dataset (EDA)
- Implement basic visualization dashboard

### Week 2: Kalman Filters

- Read `02_kalman_filter_berkeley.pdf`
- Implement 1D Kalman filter for temperature smoothing
- Compare with moving average baseline

### Week 3: Particle Filters

- Read `03_particle_filter_heart_rate.pdf`
- Implement particle filter for multi-modal fusion
- Benchmark against Kalman filter

### Week 4: Deep Learning

- Survey paper: Deep Learning for Sensor Fusion
- Implement attention-based temporal model
- Compare with classical methods

---

## 🔗 External Resources

### Datasets

- [Kaggle IoT Datasets](https://www.kaggle.com/search?q=iot+sensor+tag%3A%22time+series%22)
- [UCI Machine Learning Repository](https://archive.ics.uci.edu/ml/datasets.php?format=&task=&att=&area=&numAtt=&numIns=&type=ts&sort=nameUp&view=table)

### Papers

- [arXiv: Deep Learning for Inertial Positioning](https://arxiv.org/abs/2303.03757)
- [arXiv: Sensor Fusion Survey](https://arxiv.org/abs/2307.00014)

### Tools

- **Grafana**: Real-time IoT visualization
- **InfluxDB**: Time-series database
- **PyKalman**: Kalman filter library
- **FilterPy**: Bayesian filtering library

---

## 📝 Notes

### Known Challenges

- **Kaggle API**: Requires authentication for dataset downloads
- **Paper Access**: Some papers behind paywalls (use arXiv alternatives)
- **Compute**: Large-scale experiments may need GPU access

### Next Steps

1. Set up Jupyter environment
2. Download smoke detection dataset manually
3. Create initial EDA notebook
4. Implement baseline Kalman filter

---

## 🤝 Contributing

This is a personal learning repository, but ideas welcome!

**Contact**: See parent repository for details

---

**Last Updated**: 2025-12-16
