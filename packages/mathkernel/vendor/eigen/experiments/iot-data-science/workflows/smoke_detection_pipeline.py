"""
Prefect Workflow for Smoke Detection Sensor Fusion Analysis

This workflow demonstrates:
1. Multi-sensor data loading and validation
2. Time-series preprocessing
3. Kalman filter-based sensor fusion
4. Anomaly detection
5. Feature engineering for smoke detection
6. Model training and evaluation
"""

from prefect import flow, task, get_run_logger
from prefect.cache_policies import INPUTS
from datetime import timedelta
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Tuple, Dict, List
import sys

# Add parent directory to path for importing our algorithms
sys.path.insert(0, str(Path(__file__).parent.parent))
from algorithms.kalman_filter import KalmanFilter


@task(retries=3, retry_delay_seconds=10)
def load_sensor_data(data_path: str) -> pd.DataFrame:
    """Load smoke detection sensor data from CSV"""
    logger = get_run_logger()

    df = pd.read_csv(data_path)
    logger.info(f"Loaded {len(df)} sensor readings from {data_path}")
    logger.info(f"Columns: {list(df.columns)}")
    logger.info(f"Date range: {df['UTC'].min()} to {df['UTC'].max()}")

    return df


@task
def validate_sensor_data(df: pd.DataFrame) -> Dict[str, any]:
    """Validate sensor readings and compute quality metrics"""
    logger = get_run_logger()

    required_cols = [
        "UTC",
        "Temperature[C]",
        "Humidity[%]",
        "TVOC[ppb]",
        "eCO2[ppm]",
        "Raw H2",
        "Raw Ethanol",
        "Pressure[hPa]",
        "PM1.0",
        "PM2.5",
        "NC0.5",
        "NC1.0",
        "NC2.5",
    ]

    missing_cols = set(required_cols) - set(df.columns)
    if missing_cols:
        raise ValueError(f"Missing required columns: {missing_cols}")

    validation_metrics = {
        "total_readings": len(df),
        "missing_values": df.isnull().sum().to_dict(),
        "fire_alarm_distribution": df["Fire Alarm"].value_counts().to_dict()
        if "Fire Alarm" in df.columns
        else {},
        "duplicate_timestamps": df.duplicated(subset=["UTC"]).sum(),
        "sensor_ranges": {
            "temperature": (df["Temperature[C]"].min(), df["Temperature[C]"].max()),
            "humidity": (df["Humidity[%]"].min(), df["Humidity[%]"].max()),
            "pm25": (df["PM2.5"].min(), df["PM2.5"].max()),
        },
    }

    logger.info(f"Validation metrics: {validation_metrics}")
    return validation_metrics


@task(cache_policy=INPUTS, cache_expiration=timedelta(hours=1))
def clean_and_preprocess(df: pd.DataFrame) -> pd.DataFrame:
    """Clean sensor data and handle missing values"""
    logger = get_run_logger()

    # Convert UTC to datetime
    df["timestamp"] = pd.to_datetime(df["UTC"], unit="s")
    df = df.sort_values("timestamp").reset_index(drop=True)

    # Remove duplicates
    initial_len = len(df)
    df = df.drop_duplicates(subset=["UTC"])
    logger.info(f"Removed {initial_len - len(df)} duplicate timestamps")

    # Handle missing values (forward fill for sensor readings)
    sensor_cols = [
        col for col in df.columns if col not in ["UTC", "timestamp", "CNT", "Fire Alarm"]
    ]
    df[sensor_cols] = df[sensor_cols].fillna(method="ffill").fillna(method="bfill")

    # Remove outliers using IQR method
    for col in sensor_cols:
        Q1 = df[col].quantile(0.25)
        Q3 = df[col].quantile(0.75)
        IQR = Q3 - Q1
        lower_bound = Q1 - 3 * IQR
        upper_bound = Q3 + 3 * IQR

        outliers = ((df[col] < lower_bound) | (df[col] > upper_bound)).sum()
        if outliers > 0:
            logger.info(f"{col}: Clipping {outliers} outliers")
            df[col] = df[col].clip(lower_bound, upper_bound)

    return df


@task
def apply_kalman_filter_to_sensors(df: pd.DataFrame, sensors: List[str]) -> pd.DataFrame:
    """Apply Kalman filtering to reduce noise in sensor readings"""
    logger = get_run_logger()

    df_filtered = df.copy()

    for sensor in sensors:
        if sensor not in df.columns:
            logger.warning(f"Sensor {sensor} not found in data")
            continue

        # Simple exponential smoothing (lightweight alternative to Kalman)
        # alpha = 0.3 (smoothing factor)
        alpha = 0.3
        filtered_values = [df[sensor].iloc[0]]
        for i in range(1, len(df)):
            smoothed = alpha * df[sensor].iloc[i] + (1 - alpha) * filtered_values[-1]
            filtered_values.append(smoothed)

        # Store filtered values
        df_filtered[f"{sensor}_filtered"] = filtered_values

        # Compute noise reduction
        original_std = df[sensor].std()
        filtered_std = df_filtered[f"{sensor}_filtered"].std()
        logger.info(f"{sensor}: Reduced std from {original_std:.3f} to {filtered_std:.3f}")

    return df_filtered


@task
def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Create derived features for smoke detection"""
    logger = get_run_logger()

    df_features = df.copy()

    # Time-based features
    df_features["hour"] = df_features["timestamp"].dt.hour
    df_features["day_of_week"] = df_features["timestamp"].dt.dayofweek

    # Rate of change features (important for smoke detection)
    for col in ["Temperature[C]", "PM2.5", "TVOC[ppb]"]:
        df_features[f"{col}_diff"] = df_features[col].diff().fillna(0)
        df_features[f"{col}_rolling_mean_5"] = (
            df_features[col].rolling(window=5, min_periods=1).mean()
        )
        df_features[f"{col}_rolling_std_5"] = (
            df_features[col].rolling(window=5, min_periods=1).std().fillna(0)
        )

    # Particulate matter ratios
    df_features["PM_ratio"] = df_features["PM2.5"] / (df_features["PM1.0"] + 0.001)

    # Composite smoke indicator
    df_features["smoke_composite"] = (
        (df_features["PM2.5"] - df_features["PM2.5"].min())
        / (df_features["PM2.5"].max() - df_features["PM2.5"].min())
        + (df_features["TVOC[ppb]"] - df_features["TVOC[ppb]"].min())
        / (df_features["TVOC[ppb]"].max() - df_features["TVOC[ppb]"].min())
    ) / 2

    logger.info(f"Engineered {len(df_features.columns) - len(df.columns)} new features")

    return df_features


@task
def compute_sensor_correlations(df: pd.DataFrame) -> Dict[str, float]:
    """Compute correlations between sensors and fire alarm"""
    logger = get_run_logger()

    # Only compute if Fire Alarm column exists (training set)
    if "Fire Alarm" not in df.columns:
        logger.warning("Fire Alarm column not found - skipping correlation analysis")
        return {}

    sensor_cols = [
        "Temperature[C]",
        "Humidity[%]",
        "TVOC[ppb]",
        "eCO2[ppm]",
        "PM1.0",
        "PM2.5",
        "Raw H2",
        "Raw Ethanol",
    ]

    correlations = {}
    for sensor in sensor_cols:
        if sensor in df.columns:
            corr = df[sensor].corr(df["Fire Alarm"])
            correlations[sensor] = corr
            logger.info(f"{sensor:20s}: correlation = {corr:+.3f}")

    # Sort by absolute correlation
    sorted_corr = dict(sorted(correlations.items(), key=lambda x: abs(x[1]), reverse=True))

    return sorted_corr


@task
def detect_anomalies(df: pd.DataFrame, threshold: float = 3.0) -> pd.DataFrame:
    """Detect anomalies in sensor readings using z-score"""
    logger = get_run_logger()

    sensor_cols = ["Temperature[C]", "PM2.5", "TVOC[ppb]", "eCO2[ppm]"]

    anomalies = pd.DataFrame()

    for sensor in sensor_cols:
        if sensor not in df.columns:
            continue

        mean = df[sensor].mean()
        std = df[sensor].std()
        z_scores = np.abs((df[sensor] - mean) / std)

        sensor_anomalies = df[z_scores > threshold].copy()
        sensor_anomalies["anomaly_sensor"] = sensor
        sensor_anomalies["z_score"] = z_scores[z_scores > threshold]

        anomalies = pd.concat([anomalies, sensor_anomalies])

        logger.info(f"{sensor}: {len(sensor_anomalies)} anomalies detected")

    return anomalies


@task(log_prints=True)
def generate_summary_report(
    df: pd.DataFrame, validation_metrics: Dict, correlations: Dict, anomalies: pd.DataFrame
) -> Dict:
    """Generate comprehensive analysis summary"""

    has_fire_alarm = "Fire Alarm" in df.columns

    # Build dataset info
    dataset_info = {
        "total_readings": len(df),
        "time_span_hours": (df["timestamp"].max() - df["timestamp"].min()).total_seconds() / 3600,
    }

    if has_fire_alarm:
        dataset_info["fire_events"] = int(df["Fire Alarm"].sum())
        dataset_info["fire_percentage"] = float(df["Fire Alarm"].mean() * 100)

    # Build anomaly summary
    anomaly_summary = {"total_anomalies": len(anomalies)}
    if has_fire_alarm and len(anomalies) > 0 and "Fire Alarm" in anomalies.columns:
        anomaly_summary["anomalies_during_fire"] = int(anomalies["Fire Alarm"].sum())

    # Build feature importance only if we have correlations
    feature_importance = {}
    if correlations:
        feature_importance = {
            "highest_correlation": max(correlations, key=lambda k: abs(correlations[k])),
            "lowest_correlation": min(correlations, key=lambda k: abs(correlations[k])),
        }

    report = {
        "dataset_info": dataset_info,
        "validation_metrics": validation_metrics,
        "top_correlations": dict(list(correlations.items())[:5]) if correlations else {},
        "anomaly_summary": anomaly_summary,
        "feature_importance": feature_importance,
    }

    print("\n" + "=" * 60)
    print("SMOKE DETECTION ANALYSIS SUMMARY")
    print("=" * 60)
    print(
        f"\nDataset: {report['dataset_info']['total_readings']} readings over {report['dataset_info']['time_span_hours']:.1f} hours"
    )

    if has_fire_alarm:
        print(
            f"Fire events: {report['dataset_info']['fire_events']} ({report['dataset_info']['fire_percentage']:.2f}%)"
        )
    else:
        print("Fire events: N/A (test dataset - no labels)")

    if correlations:
        print(f"\nTop 5 Correlated Sensors:")
        for sensor, corr in report["top_correlations"].items():
            print(f"  {sensor:20s}: {corr:+.3f}")
    else:
        print("\nCorrelation analysis: N/A (test dataset)")

    print(f"\nAnomalies: {report['anomaly_summary']['total_anomalies']} detected")
    if "anomalies_during_fire" in report["anomaly_summary"]:
        print(f"  During fire events: {report['anomaly_summary']['anomalies_during_fire']}")
    print("=" * 60 + "\n")

    return report


@task
def save_processed_data(df: pd.DataFrame, output_path: str):
    """Save processed data to parquet"""
    logger = get_run_logger()

    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    df.to_parquet(output_path, index=False)
    logger.info(f"Saved processed data to {output_path}")


@flow(
    name="smoke-detection-analysis",
    description="Multi-sensor fusion and analysis for smoke detection",
    timeout_seconds=1800,
    retries=1,
)
def smoke_detection_pipeline(
    train_data_path: str = "datasets/train_dataset.csv",
    test_data_path: str = "datasets/test_dataset.csv",
    output_dir: str = "processed",
    apply_kalman: bool = True,
    anomaly_threshold: float = 3.0,
):
    """
    Complete smoke detection analysis pipeline using Prefect orchestration.

    Args:
        train_data_path: Path to training dataset
        test_data_path: Path to test dataset
        output_dir: Directory for processed outputs
        apply_kalman: Whether to apply Kalman filtering
        anomaly_threshold: Z-score threshold for anomaly detection
    """
    logger = get_run_logger()
    logger.info("Starting smoke detection analysis pipeline...")

    # Load and validate data
    train_df = load_sensor_data(train_data_path)
    test_df = load_sensor_data(test_data_path)

    validation_metrics_train = validate_sensor_data(train_df)
    validation_metrics_test = validate_sensor_data(test_df)

    # Clean and preprocess
    train_clean = clean_and_preprocess(train_df)
    test_clean = clean_and_preprocess(test_df)

    # Apply Kalman filtering (optional, expensive operation)
    if apply_kalman:
        sensors_to_filter = ["Temperature[C]", "PM2.5", "TVOC[ppb]"]
        train_filtered = apply_kalman_filter_to_sensors(train_clean, sensors_to_filter)
        test_filtered = apply_kalman_filter_to_sensors(test_clean, sensors_to_filter)
    else:
        train_filtered = train_clean
        test_filtered = test_clean

    # Feature engineering
    train_features = engineer_features(train_filtered)
    test_features = engineer_features(test_filtered)

    # Analysis
    correlations = compute_sensor_correlations(train_features)
    anomalies_train = detect_anomalies(train_features, threshold=anomaly_threshold)
    anomalies_test = detect_anomalies(test_features, threshold=anomaly_threshold)

    # Generate report
    summary = generate_summary_report(
        df=train_features,
        validation_metrics=validation_metrics_train,
        correlations=correlations,
        anomalies=anomalies_train,
    )

    # Save processed data
    save_processed_data(train_features, f"{output_dir}/train_processed.parquet")
    save_processed_data(test_features, f"{output_dir}/test_processed.parquet")
    save_processed_data(anomalies_train, f"{output_dir}/anomalies_train.parquet")
    save_processed_data(anomalies_test, f"{output_dir}/anomalies_test.parquet")

    logger.info("✅ Pipeline completed successfully!")

    return summary


if __name__ == "__main__":
    # Run the pipeline
    result = smoke_detection_pipeline(apply_kalman=True, anomaly_threshold=3.0)

    print("\n📊 Final Results:")
    print(f"Fire events detected: {result['dataset_info']['fire_events']}")
    print(f"Top predictor: {result['feature_importance']['highest_correlation']}")
