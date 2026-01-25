# Smoke Detection Sensor Data Analysis Report

## Executive Summary

Analyzed 17,437 smoke detection sensor records (5,000 train, 12,437 test) for Prefect workflow design. Data quality is excellent with no missing values. **CNT** sensor shows strongest correlation with Fire Alarm (r=+0.7974), followed by Humidity and Raw Ethanol.

---

## Dataset Characteristics

### Size & Structure

- **Train**: 5,000 rows × 15 columns (includes Fire Alarm target)
- **Test**: 12,437 rows × 14 columns (Fire Alarm withheld)
- **Total**: 17,437 sensor readings
- **Time Period**: June 8-13, 2022 (~5 days)

### Sampling Rate

- **Train**: Median 5 seconds (mean 83 seconds)
- **Test**: Median 2 seconds (mean 34 seconds)
- **Assessment**: Variable sampling, suitable for rolling window features

### Data Quality

✅ **Excellent** - Zero missing values in both datasets
✅ Consistent timestamp coverage
✅ No immediate outlier concerns

---

## Target Variable Analysis

### Fire Alarm Distribution (Train Set)

- **No Fire (0)**: 3,616 records (72.32%)
- **Fire (1)**: 1,384 records (27.68%)
- **Class Ratio**: 0.383 (1-to-0)

### Imbalance Handling

⚠️ **Moderate imbalance** - Recommend:

1. SMOTE for oversampling minority class
2. Class weights in model training
3. Stratified cross-validation

---

## Top Predictive Sensors

### Correlation with Fire Alarm (Top 10)

| Rank | Sensor             | Correlation | Direction | Group         |
| ---- | ------------------ | ----------- | --------- | ------------- |
| 1    | **CNT**            | **+0.7974** | ↑         | Counter       |
| 2    | **Humidity[%]**    | **+0.3112** | ↑         | Environmental |
| 3    | **Raw Ethanol**    | **-0.2574** | ↓         | Gas           |
| 4    | **Pressure[hPa]**  | **+0.2278** | ↑         | Environmental |
| 5    | **Temperature[C]** | **-0.1723** | ↓         | Environmental |
| 6    | TVOC[ppb]          | -0.1291     | ↓         | Gas           |
| 7    | NC0.5              | -0.0743     | ↓         | Particulate   |
| 8    | Raw H2             | +0.0699     | ↑         | Gas           |
| 9    | eCO2[ppm]          | -0.0630     | ↓         | Gas           |
| 10   | PM1.0              | -0.0603     | ↓         | Particulate   |

### Key Insights

- **CNT (Counter)** is by far the strongest predictor (r=+0.80)
- **Environmental sensors** (Humidity, Pressure, Temperature) show moderate correlation
- **Gas sensors** have mixed correlations (averaging |r|=0.13)
- **Particulate sensors** show weakest correlations (averaging |r|=0.05)

### Sensor Group Performance

| Group         | Average | r           |         | Best Sensor | Best Correlation |
| ------------- | ------- | ----------- | ------- | ----------- | ---------------- |
| Environmental | 0.2371  | Humidity[%] | +0.3112 |
| Gas           | 0.1298  | Raw Ethanol | -0.2574 |
| Particulate   | 0.0474  | NC0.5       | -0.0743 |

---

## Feature Engineering Recommendations

### Priority 1: Rolling Statistics (Temporal Features)

Focus on top 5 sensors with time-based aggregations:

- **CNT**, **Humidity[%]**, **Raw Ethanol**, **Pressure[hPa]**, **Temperature[C]**

Windows to test:

- 10 seconds (short-term)
- 30 seconds (medium-term)
- 60 seconds (long-term)

Features per sensor:

```python
for sensor in top_sensors:
    for window in [10, 30, 60]:
        df[f'{sensor}_roll_mean_{window}s'] = df[sensor].rolling(window).mean()
        df[f'{sensor}_roll_std_{window}s'] = df[sensor].rolling(window).std()
```

### Priority 2: Rate of Change

Detect rapid sensor changes (fire onset):

```python
df[f'{sensor}_diff'] = df[sensor].diff()
df[f'{sensor}_diff_abs'] = df[sensor].diff().abs()
```

### Priority 3: Cross-Sensor Ratios

```python
df['TVOC_eCO2_ratio'] = df['TVOC[ppb]'] / (df['eCO2[ppm]'] + 1)
df['temp_humidity_product'] = df['Temperature[C]'] * df['Humidity[%]']
```

### Priority 4: Time-of-Day Features

```python
df['hour'] = df['timestamp'].dt.hour
df['minute'] = df['timestamp'].dt.minute
df['day_of_week'] = df['timestamp'].dt.dayofweek
```

---

## Recommended Prefect Workflow Architecture

### 6-Stage Pipeline

```
STAGE 1: Ingestion & Validation
    ├─ load_train_data()
    ├─ load_test_data()
    ├─ validate_schema()
    └─ check_data_quality()

STAGE 2: Temporal Feature Engineering
    ├─ create_time_features()
    ├─ compute_rolling_stats()      # Focus on CNT, Humidity, Raw Ethanol
    └─ compute_rate_of_change()

STAGE 3: Preprocessing & Scaling
    ├─ handle_outliers()
    ├─ scale_features()             # StandardScaler or RobustScaler
    └─ balance_classes()            # SMOTE for class imbalance

STAGE 4: Model Training (Parallel)
    ├─ train_baseline_model()       # Logistic Regression
    ├─ train_tree_model()           # XGBoost/LightGBM/RandomForest
    └─ train_lstm_model()           # Optional: for temporal sequences

STAGE 5: Evaluation & Selection
    ├─ evaluate_model()             # Metrics: Accuracy, Precision, Recall, F1, AUC
    ├─ compare_metrics()
    └─ select_best_model()

STAGE 6: Deployment Prep
    ├─ export_model()
    ├─ create_inference_fn()
    └─ benchmark_latency()
```

### Prefect Task Configuration

```python
@task(
    retries=3,
    retry_delay_seconds=60,
    cache_key_fn=task_input_hash,
    cache_expiration=timedelta(hours=24)
)
def load_train_data(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    df['timestamp'] = pd.to_datetime(df['UTC'], unit='s')
    return df.sort_values('timestamp')
```

### Parallel Execution Pattern

```python
from prefect import flow
from prefect_dask import DaskTaskRunner

@flow(task_runner=DaskTaskRunner())
def training_flow(X_train, y_train):
    # Train multiple models concurrently
    baseline = train_baseline_model.submit(X_train, y_train)
    xgb_model = train_tree_model.submit(X_train, y_train, 'xgboost')
    lgbm_model = train_tree_model.submit(X_train, y_train, 'lightgbm')
    rf_model = train_tree_model.submit(X_train, y_train, 'randomforest')

    return {
        'baseline': baseline.result(),
        'xgboost': xgb_model.result(),
        'lightgbm': lgbm_model.result(),
        'randomforest': rf_model.result()
    }
```

---

## Model Recommendations

### Start With: Tree-Based Models

**XGBoost** or **LightGBM** - Best fit for:

- Tabular sensor data
- Non-linear relationships
- Mixed feature types
- Handles class imbalance well

### Baseline: Logistic Regression

For comparison and interpretability

### Advanced: LSTM (Optional)

If initial results show strong temporal dependencies:

- Sequence length: 30-60 readings (~2-5 minutes)
- Use rolling windows as input features

### Evaluation Strategy

- **5-Fold Stratified Cross-Validation** (preserve class ratio)
- **Time-Series Split** (walk-forward validation)
- **Metrics**: F1-score (primary), Precision, Recall, AUC-ROC

---

## Orchestration Best Practices

### 1. Task Retries & Caching

```python
@task(retries=3, cache_key_fn=task_input_hash)
```

### 2. Artifact Storage

```python
from prefect.artifacts import create_link_artifact

@task
def save_model(model, run_id):
    path = f"s3://models/{run_id}/model.pkl"
    joblib.dump(model, path)
    create_link_artifact(key="model", link=path)
```

### 3. Scheduling

```python
# Daily retraining at 2 AM
flow.serve(
    name="smoke-detection-pipeline",
    cron="0 2 * * *"
)
```

### 4. Monitoring & Alerting

```python
@task
def check_data_drift(current_data, reference_data):
    from scipy.stats import ks_2samp

    for col in reference_data.columns:
        statistic, p_value = ks_2samp(
            reference_data[col],
            current_data[col]
        )
        if p_value < 0.05:
            logger.warning(f"Data drift detected in {col}")
```

---

## Next Steps

### Immediate Actions

1. ✅ **Analysis complete** - This report
2. **Implement Stage 1** - Data ingestion with validation
3. **Feature engineering spike** - Test rolling windows on CNT + top 5
4. **Baseline model** - Quick XGBoost to establish performance floor

### Week 1

- Complete Stages 1-3 (ingestion, features, preprocessing)
- Train baseline + XGBoost/LightGBM models
- Establish evaluation metrics baseline

### Week 2

- Hyperparameter tuning with Optuna
- Add LSTM if temporal patterns strong
- Model selection and ensemble experiments

### Week 3

- Prefect workflow integration
- Artifact storage setup (S3/local)
- Monitoring and alerting configuration

### Week 4

- Production deployment
- Schedule automated retraining
- Documentation and handoff

---

## Files Generated

```
experiments/iot-data-science/
├── .claude/
│   └── CLAUDE.iot-data-science.md      # Environment context for Val
├── datasets/
│   ├── train_dataset.csv               # 5,000 rows
│   └── test_dataset.csv                # 12,437 rows
├── smoke_analysis_report.py            # Analysis script
└── ANALYSIS_REPORT.md                  # This file
```

---

## Contact & Support

For questions about this analysis or Prefect workflow implementation, reference:

- **Analysis Script**: `smoke_analysis_report.py`
- **Environment Setup**: `.claude/CLAUDE.iot-data-science.md`
- **Original Datasets**: `datasets/train_dataset.csv`, `datasets/test_dataset.csv`

---

**Analysis Date**: 2024-12-16
**Analyst**: Val (TMNL Architectural Conscience)
**Environment**: Nix + uv + Python 3.13.9 + pandas
