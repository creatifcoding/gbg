"""
Smoke Detection ML Pipeline - Modern Stack (DuckDB + Polars + JAX)
Architecture: CSV → DuckDB → Polars → Parquet → JAX → Predictions
"""

from pathlib import Path
from typing import Any
import polars as pl
import duckdb
from prefect import flow, task
from prefect.cache_policies import TASK_SOURCE
from datetime import timedelta

# Project root
PROJECT_ROOT = Path(__file__).parent.parent


# ============================================================================
# STAGE 1: DATA INGESTION WITH DUCKDB
# ============================================================================


@task(
    name="ingest_to_duckdb",
    description="Load CSV into DuckDB for fast SQL operations",
    retries=3,
    retry_delay_seconds=60,
)
def ingest_to_duckdb(
    csv_path: str | Path, db_path: str | Path, table_name: str = "smoke_data"
) -> dict[str, Any]:
    """
    Ingest CSV into DuckDB with timestamp parsing.

    Args:
        csv_path: Path to CSV file
        db_path: Path to DuckDB database file
        table_name: Name of table to create

    Returns:
        Metadata dict with row count, columns
    """
    con = duckdb.connect(str(db_path))

    # Create table with timestamp conversion
    con.execute(f"""
        CREATE OR REPLACE TABLE {table_name} AS
        SELECT 
            *,
            epoch_ms(CAST("UTC" AS BIGINT) * 1000) as timestamp
        FROM read_csv('{csv_path}', auto_detect=true)
        ORDER BY "UTC"
    """)

    # Get metadata
    row_count = con.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
    columns = con.execute(f"PRAGMA table_info({table_name})").fetchall()

    con.close()

    return {
        "table_name": table_name,
        "row_count": row_count,
        "column_count": len(columns),
        "db_path": str(db_path),
    }


@task(name="validate_data_duckdb")
def validate_data_duckdb(db_path: str | Path, table_name: str) -> dict[str, Any]:
    """
    Validate data quality using DuckDB SQL.

    Args:
        db_path: Path to DuckDB database
        table_name: Table to validate

    Returns:
        Validation report
    """
    con = duckdb.connect(str(db_path))

    # Check for nulls
    null_check = con.execute(f"""
        SELECT 
            SUM(CASE WHEN "CNT" IS NULL THEN 1 ELSE 0 END) as cnt_nulls,
            SUM(CASE WHEN "Temperature[C]" IS NULL THEN 1 ELSE 0 END) as temp_nulls,
            SUM(CASE WHEN "Humidity[%]" IS NULL THEN 1 ELSE 0 END) as humidity_nulls
        FROM {table_name}
    """).fetchone()

    # Check for duplicates
    dup_count = con.execute(f"""
        SELECT COUNT(*) FROM (
            SELECT "UTC", COUNT(*) as cnt 
            FROM {table_name} 
            GROUP BY "UTC" 
            HAVING cnt > 1
        )
    """).fetchone()[0]

    con.close()

    return {
        "null_counts": {
            "cnt": null_check[0],
            "temperature": null_check[1],
            "humidity": null_check[2],
        },
        "duplicate_count": dup_count,
    }


# ============================================================================
# STAGE 2: FEATURE ENGINEERING WITH DUCKDB SQL
# ============================================================================


@task(
    name="engineer_features_sql",
    description="Use DuckDB SQL for blazing-fast feature engineering",
)
def engineer_features_sql(
    db_path: str | Path,
    source_table: str,
    target_table: str,
    top_sensors: list[str],
) -> dict[str, Any]:
    """
    Feature engineering using DuckDB SQL (10-50x faster than pandas).

    Generates:
    - Temporal features (hour, minute, day_of_week)
    - Rolling statistics (mean, stddev for windows [10, 30, 60])
    - Rate of change (diff, abs diff)

    Args:
        db_path: DuckDB database path
        source_table: Source table name
        target_table: Target table name for features
        top_sensors: List of sensor columns for feature engineering

    Returns:
        Feature engineering metadata
    """
    con = duckdb.connect(str(db_path))

    # Build rolling window SQL for each sensor
    rolling_features = []
    diff_features = []

    for sensor in top_sensors:
        # Escape column names with double quotes
        sensor_quoted = f'"{sensor}"'

        # Create valid SQL alias: Humidity[%] -> Humidity_pct
        sensor_alias = (
            sensor.replace("[%]", "_pct")
            .replace("[", "_")
            .replace("]", "")
            .replace("%", "pct")
            .replace(" ", "_")
        )

        # Rolling statistics (10, 30, 60 second windows)
        for window in [10, 30, 60]:
            rolling_features.append(
                f"AVG({sensor_quoted}) OVER w{window} as {sensor_alias}_roll_mean_{window}s"
            )
            rolling_features.append(
                f"STDDEV({sensor_quoted}) OVER w{window} as {sensor_alias}_roll_std_{window}s"
            )

        # Rate of change
        diff_features.append(
            f"{sensor_quoted} - LAG({sensor_quoted}, 1) OVER time_order as {sensor_alias}_diff"
        )
        diff_features.append(
            f"ABS({sensor_quoted} - LAG({sensor_quoted}, 1) OVER time_order) as {sensor_alias}_diff_abs"
        )

        # Rolling statistics (10, 30, 60 second windows)
        for window in [10, 30, 60]:
            rolling_features.append(
                f"AVG({sensor_quoted}) OVER w{window} as {sensor_alias}_roll_mean_{window}s"
            )
            rolling_features.append(
                f"STDDEV({sensor_quoted}) OVER w{window} as {sensor_alias}_roll_std_{window}s"
            )

        # Rate of change
        diff_features.append(
            f"{sensor_quoted} - LAG({sensor_quoted}, 1) OVER time_order as {sensor_alias}_diff"
        )
        diff_features.append(
            f"ABS({sensor_quoted} - LAG({sensor_quoted}, 1) OVER time_order) as {sensor_alias}_diff_abs"
        )

    # Temporal features
    temporal_features = [
        "HOUR(timestamp) as hour",
        "MINUTE(timestamp) as minute",
        "DAYOFWEEK(timestamp) as day_of_week",
        "CASE WHEN DAYOFWEEK(timestamp) IN (6, 7) THEN 1 ELSE 0 END as is_weekend",
    ]

    # Combine all features
    all_features = temporal_features + rolling_features + diff_features
    features_sql = ",\n            ".join(all_features)

    # Create feature table
    query = f"""
        CREATE OR REPLACE TABLE {target_table} AS
        SELECT 
            *,
            {features_sql}
        FROM {source_table}
        WINDOW 
            w10 AS (ORDER BY "UTC" ROWS BETWEEN 10 PRECEDING AND CURRENT ROW),
            w30 AS (ORDER BY "UTC" ROWS BETWEEN 30 PRECEDING AND CURRENT ROW),
            w60 AS (ORDER BY "UTC" ROWS BETWEEN 60 PRECEDING AND CURRENT ROW),
            time_order AS (ORDER BY "UTC")
    """

    con.execute(query)

    # Get feature count
    columns = con.execute(f"PRAGMA table_info({target_table})").fetchall()
    original_cols = con.execute(f"PRAGMA table_info({source_table})").fetchall()

    new_feature_count = len(columns) - len(original_cols)

    con.close()

    return {
        "source_table": source_table,
        "target_table": target_table,
        "original_columns": len(original_cols),
        "total_columns": len(columns),
        "new_features": new_feature_count,
        "temporal_features": len(temporal_features),
        "rolling_features": len(rolling_features),
        "diff_features": len(diff_features),
    }


# ============================================================================
# STAGE 3: EXPORT TO PARQUET WITH POLARS
# ============================================================================


@task(name="export_to_parquet")
def export_to_parquet(
    db_path: str | Path,
    table_name: str,
    output_path: str | Path,
) -> dict[str, Any]:
    """
    Export DuckDB table to Parquet using Polars for efficient storage.

    Args:
        db_path: DuckDB database path
        table_name: Table to export
        output_path: Parquet file output path

    Returns:
        Export metadata
    """
    con = duckdb.connect(str(db_path))

    # Export to Parquet (DuckDB native - very fast)
    con.execute(f"""
        COPY {table_name} TO '{output_path}' (FORMAT PARQUET, COMPRESSION ZSTD)
    """)

    con.close()

    # Read with Polars to get metadata
    df = pl.scan_parquet(str(output_path))
    schema = df.collect_schema()

    # Get file size
    file_size = Path(output_path).stat().st_size

    return {
        "output_path": str(output_path),
        "columns": len(schema),
        "file_size_mb": round(file_size / 1024 / 1024, 2),
        "dtypes": {name: str(dtype) for name, dtype in schema.items()},
    }


@task(name="load_parquet_with_polars")
def load_parquet_with_polars(
    parquet_path: str | Path,
    feature_cols: list[str] | None = None,
) -> tuple[pl.DataFrame, pl.Series]:
    """
    Load Parquet with Polars (lazy evaluation for speed).

    Args:
        parquet_path: Path to Parquet file
        feature_cols: Optional list of feature columns to select

    Returns:
        (X, y) tuple - features and target
    """
    # Lazy scan (doesn't load into memory yet)
    df = pl.scan_parquet(str(parquet_path))

    # Select features if specified
    if feature_cols:
        X = df.select(feature_cols).collect()
    else:
        # Auto-detect: exclude UTC, timestamp, Fire Alarm
        exclude = ["UTC", "timestamp", "Fire Alarm"]
        X = df.select([col for col in df.collect_schema().names() if col not in exclude]).collect()

    # Target
    y = df.select("Fire Alarm").collect().to_series()

    return X, y


# ============================================================================
# STAGE 4: MODEL TRAINING WITH JAX (PLACEHOLDER)
# ============================================================================


@task(name="train_jax_model")
def train_jax_model(
    train_parquet: str | Path,
    feature_cols: list[str],
    model_output_path: str | Path,
    epochs: int = 100,
    learning_rate: float = 1e-3,
    hidden_dim: int = 128,
    batch_size: int = 256,
) -> dict[str, Any]:
    """
    Train JAX-based binary classifier for smoke detection using Equinox.

    Args:
        train_parquet: Path to training Parquet
        feature_cols: List of feature column names
        model_output_path: Where to save trained model
        epochs: Number of training epochs
        learning_rate: Learning rate for Adam optimizer
        hidden_dim: Hidden layer dimension
        batch_size: Batch size for training

    Returns:
        Training metrics
    """
    import jax
    import jax.numpy as jnp
    import equinox as eqx
    import optax
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import StandardScaler

    # Load data with Polars
    X, y = load_parquet_with_polars(train_parquet, feature_cols)

    print(f"Loaded training data: X shape {X.shape}, y shape {y.shape}")
    print(f"Class distribution: {y.value_counts()}")

    # Convert to numpy arrays
    X_np = X.to_numpy().astype(jnp.float32)
    y_np = y.to_numpy().astype(jnp.int32)

    # Clean data: replace NaN/Inf with 0
    import numpy as np

    X_np = np.nan_to_num(X_np, nan=0.0, posinf=0.0, neginf=0.0)

    print(f"Data cleaned - NaN check: {np.isnan(X_np).sum()} NaNs, {np.isinf(X_np).sum()} Infs")

    # Train/val split
    X_train, X_val, y_train, y_val = train_test_split(
        X_np, y_np, test_size=0.2, random_state=42, stratify=y_np
    )

    # Standardize features
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_val = scaler.transform(X_val)

    # Final safety check
    X_train = np.nan_to_num(X_train, nan=0.0, posinf=0.0, neginf=0.0)
    X_val = np.nan_to_num(X_val, nan=0.0, posinf=0.0, neginf=0.0)

    # Convert to JAX arrays
    X_train = jnp.array(X_train)
    X_val = jnp.array(X_val)
    y_train = jnp.array(y_train)
    y_val = jnp.array(y_val)

    print(f"Train: X={X_train.shape}, y={y_train.shape}")
    print(f"Val:   X={X_val.shape}, y={y_val.shape}")

    # Define model
    class SmokeDetectorMLP(eqx.Module):
        layers: list

        def __init__(self, key, input_dim, hidden_dim=128):
            keys = jax.random.split(key, 3)
            self.layers = [
                eqx.nn.Linear(input_dim, hidden_dim, key=keys[0]),
                eqx.nn.Linear(hidden_dim, hidden_dim, key=keys[1]),
                eqx.nn.Linear(hidden_dim, 2, key=keys[2]),  # Binary classification
            ]

        def __call__(self, x):
            for layer in self.layers[:-1]:
                x = jax.nn.relu(layer(x))
            return self.layers[-1](x)

    # Initialize model and optimizer with gradient clipping
    key = jax.random.PRNGKey(0)
    model = SmokeDetectorMLP(key, input_dim=X_train.shape[1], hidden_dim=hidden_dim)
    optimizer = optax.chain(
        optax.clip_by_global_norm(1.0),  # Gradient clipping to prevent explosions
        optax.adam(learning_rate),
    )
    opt_state = optimizer.init(eqx.filter(model, eqx.is_inexact_array))

    # Loss function
    @eqx.filter_jit
    def loss_fn(model, x, y):
        logits = jax.vmap(model)(x)
        return optax.softmax_cross_entropy_with_integer_labels(logits, y).mean()

    # Accuracy function
    @eqx.filter_jit
    def accuracy_fn(model, x, y):
        logits = jax.vmap(model)(x)
        preds = jnp.argmax(logits, axis=1)
        return jnp.mean(preds == y)

    # Train step
    @eqx.filter_jit
    def train_step(model, opt_state, x, y):
        loss, grads = eqx.filter_value_and_grad(loss_fn)(model, x, y)
        updates, opt_state = optimizer.update(grads, opt_state, model)
        model = eqx.apply_updates(model, updates)
        return model, opt_state, loss

    # Training loop
    print(f"\nTraining for {epochs} epochs...")
    best_val_acc = 0.0
    best_model = model
    history = {"train_loss": [], "val_loss": [], "val_acc": []}

    for epoch in range(epochs):
        # Mini-batch training
        num_batches = len(X_train) // batch_size
        epoch_losses = []

        for i in range(num_batches):
            start_idx = i * batch_size
            end_idx = start_idx + batch_size
            batch_x = X_train[start_idx:end_idx]
            batch_y = y_train[start_idx:end_idx]

            model, opt_state, loss = train_step(model, opt_state, batch_x, batch_y)
            epoch_losses.append(float(loss))

        # Validation
        val_loss = float(loss_fn(model, X_val, y_val))
        val_acc = float(accuracy_fn(model, X_val, y_val))

        history["train_loss"].append(float(jnp.mean(jnp.array(epoch_losses))))
        history["val_loss"].append(val_loss)
        history["val_acc"].append(val_acc)

        # Save best model
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            best_model = model

        # Log every 10 epochs
        if (epoch + 1) % 10 == 0 or epoch == 0:
            print(
                f"Epoch {epoch + 1}/{epochs} - "
                f"train_loss: {history['train_loss'][-1]:.4f}, "
                f"val_loss: {val_loss:.4f}, "
                f"val_acc: {val_acc:.4f}"
            )

    # Save best model
    print(f"\nBest validation accuracy: {best_val_acc:.4f}")
    eqx.tree_serialise_leaves(str(model_output_path), best_model)
    print(f"Model saved to: {model_output_path}")

    return {
        "status": "success",
        "epochs": epochs,
        "best_val_accuracy": float(best_val_acc),
        "final_train_loss": float(history["train_loss"][-1]),
        "final_val_loss": float(history["val_loss"][-1]),
        "num_features": X_train.shape[1],
        "train_samples": len(X_train),
        "val_samples": len(X_val),
        "model_path": str(model_output_path),
    }


# ============================================================================
# MAIN FLOW: MODERN SMOKE DETECTION PIPELINE
# ============================================================================


@flow(
    name="smoke-detection-modern",
    description="Modern ML pipeline: DuckDB → Polars → JAX",
    log_prints=True,
)
def smoke_detection_pipeline_modern(
    train_csv: str | Path | None = None,
    test_csv: str | Path | None = None,
    db_path: str | Path | None = None,
    top_sensors: list[str] | None = None,
):
    """
    Modern smoke detection pipeline using DuckDB, Polars, and JAX.

    Architecture:
        CSV → DuckDB (ingest + SQL feature engineering)
            → Parquet (storage)
            → Polars (load)
            → JAX (train)

    Args:
        train_csv: Path to training CSV
        test_csv: Path to test CSV
        db_path: Path to DuckDB database file
        top_sensors: List of top sensor names

    Returns:
        Pipeline summary with metrics
    """
    # Default paths
    if train_csv is None:
        train_csv = PROJECT_ROOT / "data/raw/train_dataset.csv"
    if test_csv is None:
        test_csv = PROJECT_ROOT / "data/raw/test_dataset.csv"
    if db_path is None:
        db_path = PROJECT_ROOT / "data/smoke.db"

    # Top sensors from analysis
    if top_sensors is None:
        top_sensors = ["CNT", "Humidity[%]", "Raw Ethanol", "Pressure[hPa]", "Temperature[C]"]

    print("🦆 Modern Smoke Detection Pipeline (DuckDB + Polars + JAX)")
    print(f"   Train CSV: {train_csv}")
    print(f"   Test CSV:  {test_csv}")
    print(f"   DuckDB:    {db_path}")
    print(f"   Top sensors: {', '.join(top_sensors)}")

    # ========================================================================
    # STAGE 1: Ingest to DuckDB
    # ========================================================================
    print("\n📥 STAGE 1: Ingesting CSV to DuckDB")

    train_meta = ingest_to_duckdb(train_csv, db_path, "train_raw")
    test_meta = ingest_to_duckdb(test_csv, db_path, "test_raw")

    print(f"   ✓ Train: {train_meta['row_count']:,} rows, {train_meta['column_count']} cols")
    print(f"   ✓ Test:  {test_meta['row_count']:,} rows, {test_meta['column_count']} cols")

    train_validation = validate_data_duckdb(db_path, "train_raw")
    test_validation = validate_data_duckdb(db_path, "test_raw")

    print(f"   ✓ Train validation: {train_validation['duplicate_count']} duplicates")
    print(f"   ✓ Test validation:  {test_validation['duplicate_count']} duplicates")

    # ========================================================================
    # STAGE 2: Feature Engineering with SQL
    # ========================================================================
    print("\n⚙️  STAGE 2: Feature Engineering with DuckDB SQL")

    train_features = engineer_features_sql(db_path, "train_raw", "train_features", top_sensors)
    test_features = engineer_features_sql(db_path, "test_raw", "test_features", top_sensors)

    print(f"   ✓ Train: {train_features['new_features']} new features")
    print(f"      - Temporal: {train_features['temporal_features']}")
    print(f"      - Rolling:  {train_features['rolling_features']}")
    print(f"      - Diff:     {train_features['diff_features']}")

    # ========================================================================
    # STAGE 3: Export to Parquet
    # ========================================================================
    print("\n💾 STAGE 3: Exporting to Parquet")

    parquet_dir = PROJECT_ROOT / "data/processed"
    parquet_dir.mkdir(parents=True, exist_ok=True)

    train_parquet = parquet_dir / "train_features.parquet"
    test_parquet = parquet_dir / "test_features.parquet"

    train_export = export_to_parquet(db_path, "train_features", train_parquet)
    test_export = export_to_parquet(db_path, "test_features", test_parquet)

    print(f"   ✓ Train Parquet: {train_export['file_size_mb']} MB")
    print(f"   ✓ Test Parquet:  {test_export['file_size_mb']} MB")

    # ========================================================================
    # STAGE 4: Train JAX Model (Placeholder)
    # ========================================================================
    print("\n🧠 STAGE 4: Training JAX Model")

    # Get feature columns (exclude metadata columns)
    feature_cols = [
        col
        for col in train_export["dtypes"].keys()
        if col not in ["UTC", "timestamp", "Fire Alarm"]
    ]

    model_path = PROJECT_ROOT / "models/smoke_detector_jax.eqx"
    model_path.parent.mkdir(parents=True, exist_ok=True)

    training_result = train_jax_model(train_parquet, feature_cols, model_path)

    print(f"   ✓ Training status: {training_result['status']}")
    print(f"   ✓ Features: {training_result['num_features']}")

    # ========================================================================
    # Summary
    # ========================================================================
    summary = {
        "stage_1_ingest": {
            "train": train_meta,
            "test": test_meta,
        },
        "stage_1_validation": {
            "train": train_validation,
            "test": test_validation,
        },
        "stage_2_features": {
            "train": train_features,
            "test": test_features,
        },
        "stage_3_export": {
            "train": train_export,
            "test": test_export,
        },
        "stage_4_training": training_result,
        "artifacts": {
            "duckdb": str(db_path),
            "train_parquet": str(train_parquet),
            "test_parquet": str(test_parquet),
            "model": str(model_path),
        },
    }

    print(f"\n✅ Pipeline Complete")
    print(f"   DuckDB: {db_path}")
    print(f"   Features: {train_features['new_features']} engineered")
    print(f"   Artifacts ready for JAX training")

    return summary


# ============================================================================
# CLI ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    # Run the flow locally
    result = smoke_detection_pipeline_modern()
    print(f"\n📊 Pipeline Summary:")
    print(f"   Total features: {result['stage_2_features']['train']['total_columns']}")
    print(f"   Train rows: {result['stage_1_ingest']['train']['row_count']:,}")
    print(f"   Parquet size: {result['stage_3_export']['train']['file_size_mb']} MB")
