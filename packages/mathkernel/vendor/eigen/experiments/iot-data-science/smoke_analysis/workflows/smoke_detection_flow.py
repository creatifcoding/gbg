"""
Smoke Detection ML Pipeline - Main Flow
Based on Prefect 3.0 deployment patterns
"""

from pathlib import Path
from typing import Any
import pandas as pd
from prefect import flow, task
from prefect.cache_policies import TASK_SOURCE
from datetime import timedelta

# Project root
PROJECT_ROOT = Path(__file__).parent.parent


# ============================================================================
# STAGE 1: DATA INGESTION & VALIDATION
# ============================================================================


@task(
    name="load_train_data",
    description="Load and parse training data with Unix timestamp conversion",
    retries=3,
    retry_delay_seconds=60,
    cache_policy=TASK_SOURCE,
    cache_expiration=timedelta(hours=24),
)
def load_train_data(path: str | Path) -> pd.DataFrame:
    """
    Load training dataset and parse timestamps.

    Args:
        path: Path to train_dataset.csv

    Returns:
        DataFrame with parsed timestamps, sorted chronologically
    """
    df = pd.read_csv(path)
    df["timestamp"] = pd.to_datetime(df["UTC"], unit="s")
    return df.sort_values("timestamp").reset_index(drop=True)


@task(
    name="load_test_data",
    description="Load and parse test data (no Fire Alarm column)",
    retries=3,
    retry_delay_seconds=60,
    cache_policy=TASK_SOURCE,
    cache_expiration=timedelta(hours=24),
)
def load_test_data(path: str | Path) -> pd.DataFrame:
    """
    Load test dataset and parse timestamps.

    Args:
        path: Path to test_dataset.csv

    Returns:
        DataFrame with parsed timestamps, sorted chronologically
    """
    df = pd.read_csv(path)
    df["timestamp"] = pd.to_datetime(df["UTC"], unit="s")
    return df.sort_values("timestamp").reset_index(drop=True)


@task(name="validate_schema")
def validate_schema(df: pd.DataFrame, dataset_name: str = "dataset") -> dict[str, Any]:
    """
    Validate column presence, dtypes, and value ranges.

    Args:
        df: DataFrame to validate
        dataset_name: Name for logging

    Returns:
        Validation report dictionary
    """
    required_cols = ["UTC", "Temperature[C]", "Humidity[%]", "timestamp"]
    missing_cols = set(required_cols) - set(df.columns)

    report = {
        "dataset": dataset_name,
        "valid": len(missing_cols) == 0,
        "missing_columns": list(missing_cols),
        "row_count": len(df),
        "column_count": len(df.columns),
        "null_count": int(df.isnull().sum().sum()),
        "duplicate_count": int(df.duplicated().sum()),
    }

    return report


@task(name="check_data_quality")
def check_data_quality(df: pd.DataFrame) -> dict[str, Any]:
    """
    Comprehensive data quality checks.

    Args:
        df: DataFrame to check

    Returns:
        Quality metrics dictionary
    """
    numeric_cols = df.select_dtypes(include=["number"]).columns

    # Outlier detection (values > 3 std from mean)
    outlier_counts = {}
    for col in numeric_cols:
        if col != "UTC":
            outliers = ((df[col] - df[col].mean()).abs() > 3 * df[col].std()).sum()
            outlier_counts[col] = int(outliers)

    return {
        "null_count": int(df.isnull().sum().sum()),
        "duplicate_count": int(df.duplicated().sum()),
        "outlier_summary": outlier_counts,
        "total_outliers": sum(outlier_counts.values()),
    }


# ============================================================================
# STAGE 2: TEMPORAL FEATURE ENGINEERING
# ============================================================================


@task(name="create_time_features")
def create_time_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Extract temporal features from timestamp.

    Args:
        df: DataFrame with 'timestamp' column

    Returns:
        DataFrame with added time features
    """
    df = df.copy()
    df["hour"] = df["timestamp"].dt.hour
    df["minute"] = df["timestamp"].dt.minute
    df["day_of_week"] = df["timestamp"].dt.dayofweek
    df["is_weekend"] = df["day_of_week"].isin([5, 6]).astype(int)

    return df


@task(name="compute_rolling_stats")
def compute_rolling_stats(
    df: pd.DataFrame, sensors: list[str], windows: list[int] = [10, 30, 60]
) -> pd.DataFrame:
    """
    Compute rolling statistics for key sensors.

    Args:
        df: DataFrame with sensor columns
        sensors: List of sensor column names
        windows: Window sizes in rows (roughly seconds)

    Returns:
        DataFrame with added rolling feature columns
    """
    df = df.copy()

    for sensor in sensors:
        if sensor in df.columns:
            for window in windows:
                # Rolling mean
                df[f"{sensor}_roll_mean_{window}s"] = (
                    df[sensor].rolling(window=window, min_periods=1).mean()
                )
                # Rolling std
                df[f"{sensor}_roll_std_{window}s"] = (
                    df[sensor].rolling(window=window, min_periods=1).std()
                )

    return df


@task(name="compute_rate_of_change")
def compute_rate_of_change(df: pd.DataFrame, sensors: list[str]) -> pd.DataFrame:
    """
    Compute first differences for rapid change detection.

    Args:
        df: DataFrame with sensor columns
        sensors: List of sensor column names

    Returns:
        DataFrame with added diff columns
    """
    df = df.copy()

    for sensor in sensors:
        if sensor in df.columns:
            df[f"{sensor}_diff"] = df[sensor].diff()
            df[f"{sensor}_diff_abs"] = df[sensor].diff().abs()

    return df


# ============================================================================
# MAIN FLOW: SMOKE DETECTION PIPELINE
# ============================================================================


@flow(
    name="smoke-detection-pipeline",
    description="End-to-end ML pipeline for smoke detection from IoT sensor data",
    flow_run_name="smoke-pipeline-{date}",
    log_prints=True,
)
def smoke_detection_pipeline(
    train_path: str | Path | None = None,
    test_path: str | Path | None = None,
    top_sensors: list[str] | None = None,
):
    """
    Main orchestration flow for smoke detection ML pipeline.

    Args:
        train_path: Path to training dataset (defaults to project data)
        test_path: Path to test dataset (defaults to project data)
        top_sensors: List of top sensor names for feature engineering

    Returns:
        Dictionary with pipeline artifacts and metrics
    """
    # Default paths - ensure they're Path objects for consistency
    if train_path is None:
        train_path = PROJECT_ROOT / "data/raw/train_dataset.csv"
    else:
        train_path = Path(train_path)

    if test_path is None:
        test_path = PROJECT_ROOT / "data/raw/test_dataset.csv"
    else:
        test_path = Path(test_path)

    # Top sensors from analysis (CNT, Humidity, Raw Ethanol, Pressure, Temperature)
    if top_sensors is None:
        top_sensors = ["CNT", "Humidity[%]", "Raw Ethanol", "Pressure[hPa]", "Temperature[C]"]

    print(f"🚀 Starting Smoke Detection Pipeline")
    print(f"   Train: {train_path}")
    print(f"   Test:  {test_path}")
    print(f"   Top sensors: {', '.join(top_sensors)}")

    # ========================================================================
    # STAGE 1: Data Ingestion & Validation
    # ========================================================================
    print("\n📥 STAGE 1: Data Ingestion & Validation")

    train_df = load_train_data(train_path)
    test_df = load_test_data(test_path)

    train_validation = validate_schema(train_df, "train")
    test_validation = validate_schema(test_df, "test")

    print(
        f"   ✓ Train: {train_validation['row_count']:,} rows, {train_validation['column_count']} cols"
    )
    print(
        f"   ✓ Test:  {test_validation['row_count']:,} rows, {test_validation['column_count']} cols"
    )

    train_quality = check_data_quality(train_df)
    test_quality = check_data_quality(test_df)

    print(f"   ✓ Train quality: {train_quality['total_outliers']} outliers detected")
    print(f"   ✓ Test quality:  {test_quality['total_outliers']} outliers detected")

    # ========================================================================
    # STAGE 2: Temporal Feature Engineering
    # ========================================================================
    print("\n⚙️  STAGE 2: Temporal Feature Engineering")

    # Add time features
    train_df = create_time_features(train_df)
    test_df = create_time_features(test_df)
    print(f"   ✓ Time features added (hour, minute, day_of_week, is_weekend)")

    # Rolling statistics
    train_df = compute_rolling_stats(train_df, top_sensors, windows=[10, 30, 60])
    test_df = compute_rolling_stats(test_df, top_sensors, windows=[10, 30, 60])
    print(f"   ✓ Rolling stats computed for {len(top_sensors)} sensors × 3 windows")

    # Rate of change
    train_df = compute_rate_of_change(train_df, top_sensors)
    test_df = compute_rate_of_change(test_df, top_sensors)
    print(f"   ✓ Rate of change computed for {len(top_sensors)} sensors")

    # Save interim data
    interim_dir = PROJECT_ROOT / "data/interim"
    interim_dir.mkdir(parents=True, exist_ok=True)

    train_interim_path = interim_dir / "train_features.parquet"
    test_interim_path = interim_dir / "test_features.parquet"

    train_df.to_parquet(train_interim_path)
    test_df.to_parquet(test_interim_path)

    print(f"   ✓ Interim data saved:")
    print(f"     - {train_interim_path}")
    print(f"     - {test_interim_path}")

    # ========================================================================
    # Return Summary
    # ========================================================================
    summary = {
        "stage_1_validation": {"train": train_validation, "test": test_validation},
        "stage_1_quality": {"train": train_quality, "test": test_quality},
        "stage_2_features": {
            "time_features": 4,  # hour, minute, day_of_week, is_weekend
            "rolling_features": len(top_sensors) * 3 * 2,  # sensors × windows × (mean, std)
            "diff_features": len(top_sensors) * 2,  # sensors × (diff, diff_abs)
            "total_new_features": 4 + (len(top_sensors) * 3 * 2) + (len(top_sensors) * 2),
        },
        "artifacts": {
            "train_features": str(train_interim_path),
            "test_features": str(test_interim_path),
        },
    }

    print(f"\n✅ Pipeline Stage 1-2 Complete")
    print(f"   Total new features: {summary['stage_2_features']['total_new_features']}")

    return summary


# ============================================================================
# CLI ENTRY POINT (for testing)
# ============================================================================

if __name__ == "__main__":
    # Run the flow locally for testing
    result = smoke_detection_pipeline()
    print(f"\nPipeline returned: {result}")
