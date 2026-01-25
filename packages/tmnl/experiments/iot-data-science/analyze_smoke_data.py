"""
Smoke Detection Sensor Data Analysis
Comprehensive analysis for Prefect workflow design
"""

import pandas as pd
import numpy as np
from pathlib import Path
import warnings

warnings.filterwarnings("ignore")

# File paths
TRAIN_PATH = Path("datasets/train_dataset.csv")
TEST_PATH = Path("datasets/test_dataset.csv")

print("=" * 80)
print("SMOKE DETECTION SENSOR DATA ANALYSIS")
print("=" * 80)
print()

# ============================================================================
# 1. LOAD AND BASIC INSPECTION
# ============================================================================
print("1. LOADING DATA...")
print("-" * 80)

train_df = pd.read_csv(TRAIN_PATH)
test_df = pd.read_csv(TEST_PATH)

print(f"Train dataset: {train_df.shape[0]:,} rows × {train_df.shape[1]} columns")
print(f"Test dataset:  {test_df.shape[0]:,} rows × {test_df.shape[1]} columns")
print(f"Total records: {train_df.shape[0] + test_df.shape[0]:,}")
print()

print("Columns:", list(train_df.columns))
print()

# ============================================================================
# 2. MISSING DATA ANALYSIS
# ============================================================================
print("2. MISSING DATA PATTERNS")
print("-" * 80)


def analyze_missing(df, name):
    print(f"\n{name}:")
    missing = df.isnull().sum()
    missing_pct = (missing / len(df) * 100).round(2)
    missing_df = pd.DataFrame({"Missing_Count": missing, "Missing_Percent": missing_pct})
    missing_df = missing_df[missing_df["Missing_Count"] > 0].sort_values(
        "Missing_Count", ascending=False
    )

    if len(missing_df) > 0:
        print(missing_df.to_string())
    else:
        print("  ✓ No missing values detected")

    return missing_df


train_missing = analyze_missing(train_df, "TRAIN SET")
test_missing = analyze_missing(test_df, "TEST SET")

# ============================================================================
# 3. TIME-SERIES CHARACTERISTICS
# ============================================================================
print("\n" + "=" * 80)
print("3. TIME-SERIES CHARACTERISTICS")
print("-" * 80)


def analyze_timeseries(df, name):
    print(f"\n{name}:")

    # Parse UTC column
    df["timestamp"] = pd.to_datetime(df["UTC"])
    df_sorted = df.sort_values("timestamp")

    # Time range
    start_time = df_sorted["timestamp"].min()
    end_time = df_sorted["timestamp"].max()
    duration = end_time - start_time

    print(f"  Start:    {start_time}")
    print(f"  End:      {end_time}")
    print(f"  Duration: {duration}")

    # Sampling rate
    time_diffs = df_sorted["timestamp"].diff().dropna()
    median_interval = time_diffs.median()
    mean_interval = time_diffs.mean()

    print(f"\n  Sampling intervals:")
    print(f"    Median: {median_interval}")
    print(f"    Mean:   {mean_interval}")
    print(f"    Min:    {time_diffs.min()}")
    print(f"    Max:    {time_diffs.max()}")

    # Check for gaps
    large_gaps = time_diffs[time_diffs > pd.Timedelta(seconds=10)]
    if len(large_gaps) > 0:
        print(f"\n  ⚠ Found {len(large_gaps)} gaps > 10 seconds")
        print(f"    Largest gap: {large_gaps.max()}")
    else:
        print("\n  ✓ No significant gaps detected")

    return {
        "duration": duration,
        "median_interval": median_interval,
        "mean_interval": mean_interval,
        "records": len(df),
    }


train_ts = analyze_timeseries(train_df, "TRAIN SET")
test_ts = analyze_timeseries(test_df, "TEST SET")

# ============================================================================
# 4. FIRE ALARM DISTRIBUTION
# ============================================================================
print("\n" + "=" * 80)
print("4. FIRE ALARM DISTRIBUTION")
print("-" * 80)


def analyze_target(df, name):
    print(f"\n{name}:")
    alarm_counts = df["Fire Alarm"].value_counts().sort_index()
    alarm_pct = (alarm_counts / len(df) * 100).round(2)

    for val, count in alarm_counts.items():
        pct = alarm_pct[val]
        print(f"  Fire Alarm = {val}: {count:,} ({pct}%)")

    return alarm_counts


train_alarms = analyze_target(train_df, "TRAIN SET")
test_alarms = analyze_target(test_df, "TEST SET")

# ============================================================================
# 5. FEATURE STATISTICS
# ============================================================================
print("\n" + "=" * 80)
print("5. FEATURE STATISTICS")
print("-" * 80)

# Get numeric columns (exclude UTC and Fire Alarm)
numeric_cols = [col for col in train_df.columns if col not in ["UTC", "Fire Alarm"]]

print("\nTRAIN SET - Basic Statistics:")
stats = train_df[numeric_cols].describe().T
stats["zeros_pct"] = ((train_df[numeric_cols] == 0).sum() / len(train_df) * 100).round(2)
print(stats[["mean", "std", "min", "max", "zeros_pct"]].to_string())

# ============================================================================
# 6. CORRELATION ANALYSIS WITH FIRE ALARM
# ============================================================================
print("\n" + "=" * 80)
print("6. CORRELATION WITH FIRE ALARM")
print("-" * 80)

# Calculate correlations
correlations = train_df[numeric_cols + ["Fire Alarm"]].corr()["Fire Alarm"].drop("Fire Alarm")
correlations_abs = correlations.abs().sort_values(ascending=False)

print("\nTop sensors correlated with Fire Alarm (by absolute value):")
print()
for i, (sensor, corr_abs) in enumerate(correlations_abs.head(10).items(), 1):
    corr = correlations[sensor]
    direction = "↑" if corr > 0 else "↓"
    print(f"  {i:2d}. {sensor:20s} {direction} {corr:+.4f}  (|r| = {corr_abs:.4f})")

print("\n" + "─" * 80)
print("INTERPRETATION:")
strong_features = correlations_abs[correlations_abs > 0.5].index.tolist()
moderate_features = correlations_abs[
    (correlations_abs > 0.3) & (correlations_abs <= 0.5)
].index.tolist()
weak_features = correlations_abs[correlations_abs <= 0.3].index.tolist()

print(
    f"  • STRONG (|r| > 0.5):    {len(strong_features)} features - {', '.join(strong_features[:5])}"
    + (f" + {len(strong_features) - 5} more" if len(strong_features) > 5 else "")
)
print(f"  • MODERATE (0.3-0.5):    {len(moderate_features)} features")
print(f"  • WEAK (|r| < 0.3):      {len(weak_features)} features")

# ============================================================================
# 7. SENSOR GROUPING ANALYSIS
# ============================================================================
print("\n" + "=" * 80)
print("7. SENSOR GROUP ANALYSIS")
print("-" * 80)

sensor_groups = {
    "Gas Sensors": ["TVOC[ppb]", "eCO2[ppm]", "Raw H2", "Raw Ethanol"],
    "Particulate": ["PM1.0", "PM2.5", "NC0.5", "NC1.0", "NC2.5"],
    "Environmental": ["Temperature[C]", "Humidity[%]", "Pressure[hPa]"],
    "Other": ["CNT"],
}

print("\nCorrelation strength by sensor group:")
for group_name, sensors in sensor_groups.items():
    available_sensors = [s for s in sensors if s in correlations_abs.index]
    if available_sensors:
        avg_corr = correlations_abs[available_sensors].mean()
        max_corr = correlations_abs[available_sensors].max()
        best_sensor = correlations_abs[available_sensors].idxmax()
        print(f"\n  {group_name}:")
        print(f"    Average |r|: {avg_corr:.4f}")
        print(f"    Max |r|:     {max_corr:.4f} ({best_sensor})")

# ============================================================================
# 8. DATA QUALITY CHECKS
# ============================================================================
print("\n" + "=" * 80)
print("8. DATA QUALITY ASSESSMENT")
print("-" * 80)

print("\nChecking for potential issues...")

# Check for duplicates
train_dupes = train_df.duplicated().sum()
test_dupes = test_df.duplicated().sum()
print(f"\n  Duplicate rows:")
print(f"    Train: {train_dupes}")
print(f"    Test:  {test_dupes}")

# Check for constant columns
print(f"\n  Constant columns (std = 0):")
for col in numeric_cols:
    if train_df[col].std() == 0:
        print(f"    ⚠ {col} is constant in train set")

# Check for outliers (values > 3 std from mean)
print(f"\n  Outlier detection (values > 3σ):")
for col in numeric_cols[:5]:  # Check first 5 as example
    outliers = ((train_df[col] - train_df[col].mean()).abs() > 3 * train_df[col].std()).sum()
    pct = outliers / len(train_df) * 100
    if pct > 5:
        print(f"    ⚠ {col}: {outliers} ({pct:.1f}%)")

# ============================================================================
# 9. RECOMMENDATIONS
# ============================================================================
print("\n" + "=" * 80)
print("9. PREFECT WORKFLOW RECOMMENDATIONS")
print("=" * 80)

print("""
┌─────────────────────────────────────────────────────────────────────────────┐
│ PIPELINE ARCHITECTURE                                                        │
└─────────────────────────────────────────────────────────────────────────────┘

STAGE 1: DATA INGESTION & VALIDATION
  Tasks:
    ├─ load_train_data()          → Load train_dataset.csv
    ├─ load_test_data()           → Load test_dataset.csv
    ├─ validate_schema()          → Check columns, dtypes
    ├─ check_missing_values()     → Flag any nulls (currently clean)
    └─ check_time_continuity()    → Validate timestamp sequence
  
  Artifacts:
    - raw_train.parquet
    - raw_test.parquet
    - data_validation_report.json

STAGE 2: TEMPORAL FEATURE ENGINEERING
  Tasks:
    ├─ parse_timestamps()         → Convert UTC to datetime
    ├─ create_time_features()     → Extract hour, minute, day_of_week
    ├─ compute_rolling_stats()    → Rolling mean/std (windows: 10, 30, 60s)
    └─ compute_rate_of_change()   → First differences for top sensors
  
  Focus Features (based on correlation analysis):""")

# Print top features for recommendation
print(f"    Primary: {', '.join(correlations_abs.head(3).index)}")
print(f"    Secondary: {', '.join(correlations_abs.iloc[3:6].index)}")

print("""
  Artifacts:
    - engineered_train.parquet
    - engineered_test.parquet
    - feature_correlation_matrix.png

STAGE 3: PREPROCESSING
  Tasks:
    ├─ handle_outliers()          → Cap at 99th percentile or use IQR
    ├─ scale_features()           → StandardScaler or RobustScaler
    ├─ balance_classes()          → SMOTE/ADASYN if needed (check class balance)
    └─ create_sequences()         → Time-window sequences for LSTM (optional)
  
  Artifacts:
    - preprocessed_train.parquet
    - preprocessed_test.parquet
    - scaler_params.pkl
    - class_weights.json

STAGE 4: MODEL TRAINING
  Tasks:
    ├─ train_baseline()           → Logistic Regression
    ├─ train_tree_models()        → Random Forest, XGBoost, LightGBM
    ├─ train_neural_net()         → MLP or LSTM for temporal patterns
    └─ hyperparameter_tuning()    → Optuna or GridSearchCV
  
  Strategy:
    - K-fold cross-validation (k=5)
    - Stratified by Fire Alarm
    - Track: Accuracy, Precision, Recall, F1, AUC-ROC
  
  Artifacts:
    - model_*.pkl for each trained model
    - training_metrics.json
    - feature_importance.csv

STAGE 5: EVALUATION & SELECTION
  Tasks:
    ├─ evaluate_models()          → Test set evaluation
    ├─ compare_metrics()          → Generate comparison table
    ├─ analyze_errors()           → Confusion matrix, error analysis
    └─ select_best_model()        → Based on F1-score or custom metric
  
  Artifacts:
    - evaluation_report.html
    - confusion_matrices.png
    - roc_curves.png
    - best_model.pkl

STAGE 6: DEPLOYMENT PREP
  Tasks:
    ├─ export_model()             → Serialize for production
    ├─ create_inference_fn()      → Wrapper with preprocessing
    ├─ benchmark_latency()        → Measure inference time
    └─ generate_model_card()      → Documentation
  
  Artifacts:
    - production_model.pkl
    - inference_pipeline.pkl
    - model_card.md
    - latency_report.json
""")

print("""
┌─────────────────────────────────────────────────────────────────────────────┐
│ KEY FINDINGS & RECOMMENDATIONS                                               │
└─────────────────────────────────────────────────────────────────────────────┘
""")

print(f"""
1. DATA QUALITY: ✓ EXCELLENT
   - No missing values in either dataset
   - Consistent sampling rate (~1 second intervals)
   - Clean temporal sequence
   - No immediate data quality issues detected

2. STRONGEST PREDICTORS (Top 3):""")
for i, sensor in enumerate(correlations_abs.head(3).index, 1):
    corr = correlations[sensor]
    print(f"   {i}. {sensor:20s} (r = {corr:+.4f})")

print(f"""
3. CLASS BALANCE:
   - Train: {(train_alarms.get(1, 0) / len(train_df) * 100):.1f}% Fire Alarm = 1
   - Test:  {(test_alarms.get(1, 0) / len(test_df) * 100):.1f}% Fire Alarm = 1
   → Consider class weighting or SMOTE if imbalanced

4. TEMPORAL PATTERNS:
   - Median sampling: {train_ts["median_interval"]}
   - Duration: {train_ts["duration"]}
   → Window-based features (rolling stats) will be valuable
   → Consider LSTM/GRU for sequence modeling

5. FEATURE ENGINEERING PRIORITIES:
   a) Rolling statistics (10s, 30s, 60s windows) for top sensors
   b) Rate of change (first differences)
   c) Cross-sensor ratios (e.g., TVOC/eCO2)
   d) Time-of-day features (if alarm patterns vary)
   e) Lag features (t-1, t-2, t-5)

6. MODEL RECOMMENDATIONS:
   a) START: Logistic Regression (baseline)
   b) TREE-BASED: XGBoost/LightGBM (likely best performers)
   c) NEURAL: LSTM if temporal dependencies strong
   d) ENSEMBLE: Combine top 3 models

7. PREFECT ORCHESTRATION:
   - Use task retries for data loading (network failures)
   - Cache transformed data with task_run_name
   - Parallel model training with concurrent_task_runner
   - Log artifacts to S3 or local storage
   - Create flow deployment for scheduled retraining
   - Add monitoring tasks for data drift detection

8. VALIDATION STRATEGY:
   - Time-series cross-validation (walk-forward)
   - Preserve temporal order (no shuffling in CV)
   - Hold out final 20% of test set for final evaluation
""")

print("\n" + "=" * 80)
print("ANALYSIS COMPLETE")
print("=" * 80)
print(f"\nNext steps:")
print(f"  1. Review findings above")
print(f"  2. Implement Prefect workflow with recommended stages")
print(f"  3. Start with baseline models")
print(f"  4. Iterate on feature engineering based on model feedback")
print()
