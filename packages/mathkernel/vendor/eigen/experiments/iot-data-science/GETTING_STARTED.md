# Getting Started with IoT Data Science

This guide will get you up and running with the smoke detection dataset and sensor fusion algorithms.

---

## 📦 Installation

### 1. Create Python Environment

```bash
# Using venv
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Or using conda
conda create -n iot-sensor python=3.10
conda activate iot-sensor
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

If `requirements.txt` doesn't exist yet, install manually:

```bash
pip install pandas numpy matplotlib seaborn scikit-learn jupyter
pip install plotly dash  # For interactive dashboards
pip install filterpy     # Kalman filter library
```

---

## 📊 Download Dataset

### Option 1: Manual Download (Recommended)

1. Go to [Kaggle Smoke Detection Dataset](https://www.kaggle.com/datasets/gauravduttakiit/sensorfusion-smoke-detection-classification)
2. Click **Download** (requires Kaggle account)
3. Extract the ZIP file
4. Move `smoke_detection_iot.csv` to `experiments/iot-data-science/datasets/`

### Option 2: Kaggle API

```bash
# Install Kaggle CLI
pip install kaggle

# Set up API credentials (see https://github.com/Kaggle/kaggle-api)
# Place kaggle.json in ~/.kaggle/

# Download dataset
cd experiments/iot-data-science/datasets
kaggle datasets download -d gauravduttakiit/sensorfusion-smoke-detection-classification
unzip sensorfusion-smoke-detection-classification.zip
```

### Verify Download

```bash
cd experiments/iot-data-science/datasets
ls -lh smoke_detection_iot.csv
# Should show ~50MB file
```

---

## 🚀 Quick Start

### 1. Exploratory Data Analysis

```bash
cd experiments/iot-data-science/notebooks
jupyter notebook 01_exploratory_data_analysis.ipynb
```

Run all cells to:

- Load the dataset
- Visualize sensor distributions
- Identify correlations
- Compare fire vs. normal events

### 2. Run Kalman Filter Example

```bash
cd experiments/iot-data-science/algorithms
python kalman_filter.py
```

Expected output:

```
Kalman Filter Temperature Smoothing
==================================================
True temperature: 25.00°C
Raw measurement mean: 25.12°C
Raw measurement std: 0.51°C
Filtered estimate: 25.03°C
Final uncertainty: 0.15°C

==================================================
Two-Sensor Fusion Example
==================================================
Sensor 1 mean: 25.18°C (std: 0.79)
Sensor 2 mean: 24.98°C (std: 0.31)
Fused estimate: 24.99°C
Fused uncertainty: 0.14°C
Improvement: 82.3% reduction in uncertainty
```

### 3. Run Particle Filter Example

```bash
cd experiments/iot-data-science/algorithms
python particle_filter.py
```

---

## 📚 Learning Path

### Week 1: Foundation (4-6 hours)

**Goal**: Understand the data and basic sensor characteristics

1. **Read**: `papers/01_basics_of_sensor_fusion_aalto.pdf` (Chapters 1-3)

   - Focus: Bayesian filtering basics
   - Time: 2 hours

2. **Explore**: Run `01_exploratory_data_analysis.ipynb`

   - Understand 14 sensor channels
   - Identify key patterns
   - Time: 1-2 hours

3. **Experiment**: Modify the notebook
   - Plot different time windows
   - Try different correlation thresholds
   - Visualize rolling averages
   - Time: 1-2 hours

**Deliverable**: Can you answer:

- Which sensors are most correlated?
- How many fire events are in the dataset?
- What's the average temperature during fire vs. normal?

---

### Week 2: Kalman Filters (6-8 hours)

**Goal**: Implement and understand linear sensor fusion

1. **Read**: `papers/02_kalman_filter_berkeley.pdf`

   - Focus: Prediction and update equations
   - Time: 2-3 hours

2. **Code**: Study `algorithms/kalman_filter.py`

   - Run the examples
   - Understand prediction/update cycle
   - Time: 1 hour

3. **Apply**: Create `02_sensor_fusion_kalman.ipynb`
   - Load smoke detection data
   - Apply Kalman filter to temperature sensor
   - Compare with raw data (plot both)
   - Experiment with process/measurement noise
   - Time: 3-4 hours

**Challenge Questions**:

- Can you smooth the humidity sensor?
- Can you fuse temperature + humidity into a "comfort index"?
- What happens if you set process_var = 0?

---

### Week 3: Particle Filters (6-8 hours)

**Goal**: Handle non-linear sensor fusion

1. **Read**: `papers/03_particle_filter_heart_rate.pdf`

   - Focus: Sequential Monte Carlo basics
   - Time: 2-3 hours

2. **Code**: Study `algorithms/particle_filter.py`

   - Run multi-sensor fusion example
   - Visualize particle evolution (add plotting)
   - Time: 2 hours

3. **Apply**: Create `03_particle_filter_fusion.ipynb`
   - Fuse TVOC + eCO2 sensors
   - Handle outliers (simulate sensor spikes)
   - Compare with Kalman filter
   - Time: 2-3 hours

**Challenge**:

- Modify particle filter to track 2D state (temp + humidity)
- Implement a "measurement rejection" feature (ignore outliers)

---

### Week 4: Real-Time Visualization (6-8 hours)

**Goal**: Build an interactive dashboard

1. **Research**: IoT visualization best practices

   - TechTarget article (see papers directory)
   - Grafana/Plotly documentation
   - Time: 1-2 hours

2. **Prototype**: Create Plotly Dash app
   - Real-time streaming simulation
   - Display 14 sensors without overwhelming
   - Use subplots, color coding, animations
   - Time: 4-6 hours

**Starter Code**:

```python
import dash
from dash import dcc, html
import plotly.graph_objs as go

app = dash.Dash(__name__)

app.layout = html.Div([
    dcc.Graph(id='live-sensor-graph'),
    dcc.Interval(id='interval-component', interval=1000)  # 1 sec updates
])

# Update graph callback
@app.callback(...)
def update_graph(...):
    # Read next batch of sensor data
    # Return plotly figure
    pass

if __name__ == '__main__':
    app.run_server(debug=True)
```

---

## 🎯 Research Project Ideas

### Beginner Projects

1. **Sensor Redundancy Analysis**

   - Goal: Predict fire with minimal sensors
   - Method: Feature importance (Random Forest, permutation)
   - Deliverable: "Top 3 sensors" recommendation

2. **Missing Data Robustness**

   - Goal: Handle sensor failures
   - Method: Imputation (forward-fill, interpolation, KNN)
   - Deliverable: Compare prediction accuracy with 10%, 20%, 30% missing

3. **Baseline Comparison**
   - Goal: Kalman vs. moving average vs. raw
   - Method: MSE, smoothness metrics
   - Deliverable: Table of results

### Intermediate Projects

4. **Temporal Attention Model**

   - Goal: Which sensors matter most at T-30s before fire?
   - Method: LSTM with attention mechanism
   - Deliverable: Attention heatmap over time

5. **Multi-Modal Fusion Optimization**

   - Goal: Learn sensor weights from data
   - Method: Weighted average, optimize weights via gradient descent
   - Deliverable: Learned weight vector

6. **Anomaly Detection**
   - Goal: Detect fire BEFORE alarm triggers
   - Method: Autoencoder, one-class SVM
   - Deliverable: ROC curve, early detection time

### Advanced Projects

7. **Causal Inference**

   - Goal: PM2.5 → Alarm causation vs. correlation
   - Method: Granger causality, structural causal models
   - Deliverable: Causal graph

8. **Real-Time Edge Deployment**

   - Goal: <100ms latency on Raspberry Pi
   - Method: Model quantization, TensorFlow Lite
   - Deliverable: Benchmark table

9. **Multi-Building Transfer Learning**
   - Goal: Train on one building, deploy to another
   - Method: Domain adaptation, fine-tuning
   - Deliverable: Cross-building accuracy

---

## 🛠️ Troubleshooting

### Dataset not loading

```python
# In Jupyter notebook
import os
print(os.getcwd())  # Check current directory
print(os.listdir('../datasets'))  # List files
```

### Kalman filter diverging

- Reduce process variance `Q`
- Increase measurement variance `R`
- Check state transition matrix `F`

### Particle filter degeneracy

- Increase number of particles (e.g., 10000)
- Lower resample threshold (e.g., 0.3)
- Add more process noise

### Out of memory

```python
# Sample data
df_sample = df.sample(frac=0.1, random_state=42)
```

---

## 📖 Additional Resources

### Papers (to download)

- [Deep Learning for Inertial Positioning](https://arxiv.org/abs/2303.03757)
- [Sensor Fusion Survey 2024](https://arxiv.org/abs/2307.00014)
- [Multi-Modal Fusion](https://arxiv.org/abs/2506.19769)

### Libraries

- **FilterPy**: https://filterpy.readthedocs.io/
- **PyKalman**: https://pykalman.github.io/
- **PyStan**: Bayesian modeling (advanced)

### Tutorials

- [Kalman Filter Tutorial (Bzarg)](https://www.bzarg.com/p/how-a-kalman-filter-works-in-pictures/)
- [Particle Filter from Scratch](https://machinelearningmastery.com/particle-filter/)

---

## 🤝 Contributing

Found a bug? Have an improvement? Create an issue or pull request!

**Last Updated**: 2025-12-16
