"""
Prefect Prediction Flow for Smoke Detection Model.

This flow orchestrates prediction on test data:
1. Load test dataset
2. Load trained model
3. Normalize test features (using training stats)
4. Generate predictions
5. Save predictions as artifact

Run:
    uv run python flows/predict_flow.py
"""

import csv
import sys
from pathlib import Path
from typing import Tuple, List

import jax
import jax.numpy as jnp
import equinox as eqx
from prefect import flow, task, get_run_logger
from prefect.artifacts import create_table_artifact, create_markdown_artifact

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
from train_simple import MLP, load_csv


# ============================================================================
# Tasks
# ============================================================================


@task(name="Load Test Data", retries=2)
def load_test_data(filepath: str) -> jnp.ndarray:
    """Load test dataset from CSV (no labels)."""
    logger = get_run_logger()
    logger.info(f"Loading test data from: {filepath}")

    X_test, _ = load_csv(filepath)

    logger.info(
        f"Loaded {X_test.shape[0]:,} test samples with {X_test.shape[1]} features"
    )

    return X_test


@task(name="Load Trained Model")
def load_trained_model(model_path: str, seed: int = 42) -> MLP:
    """Load trained model from disk."""
    logger = get_run_logger()
    logger.info(f"Loading model from: {model_path}")

    # Initialize model with same architecture
    key = jax.random.PRNGKey(seed)
    model = MLP(key)

    # Load weights
    model = eqx.tree_deserialise_leaves(model_path, model)

    logger.info("✓ Model loaded successfully")

    return model


@task(name="Normalize Test Data")
def normalize_test_data(X_test: jnp.ndarray, train_data_path: str) -> jnp.ndarray:
    """Normalize test data using training statistics."""
    logger = get_run_logger()
    logger.info("Computing normalization from training data...")

    # Load training data to compute statistics
    X_train_full, _ = load_csv(train_data_path)

    # Use first 80% for normalization stats (same as training)
    n_train = int(0.8 * X_train_full.shape[0])
    X_train = X_train_full[:n_train]

    # Compute normalization statistics
    mean = jnp.mean(X_train, axis=0)
    std = jnp.std(X_train, axis=0) + 1e-8

    # Normalize test data
    X_test_norm = (X_test - mean) / std

    logger.info(f"✓ Test data normalized (shape: {X_test_norm.shape})")

    return X_test_norm


@task(name="Generate Predictions", log_prints=True)
def generate_predictions(
    model: MLP, X_test_norm: jnp.ndarray, batch_size: int = 1000
) -> Tuple[List[int], List[float]]:
    """Generate predictions on test set in batches."""
    logger = get_run_logger()
    logger.info(f"Generating predictions in batches of {batch_size}...")

    n_samples = X_test_norm.shape[0]
    n_batches = (n_samples + batch_size - 1) // batch_size

    all_predictions = []
    all_probabilities = []

    for i in range(n_batches):
        start_idx = i * batch_size
        end_idx = min(start_idx + batch_size, n_samples)

        X_batch = X_test_norm[start_idx:end_idx]

        # Get logits and probabilities
        logits = jax.vmap(model)(X_batch)
        probs = jax.nn.softmax(logits, axis=-1)
        preds = jnp.argmax(logits, axis=-1)

        all_predictions.extend(preds.tolist())
        all_probabilities.extend(probs[:, 1].tolist())  # Probability of fire

        if (i + 1) % 5 == 0 or (i + 1) == n_batches:
            logger.info(f"  Processed {end_idx:,}/{n_samples:,} samples...")

    logger.info(f"✓ Generated {len(all_predictions):,} predictions")

    return all_predictions, all_probabilities


@task(name="Save Predictions")
def save_predictions(
    predictions: List[int],
    probabilities: List[float],
    output_path: str = "results/test_predictions_run_001.csv",
) -> Tuple[str, dict]:
    """Save predictions to CSV and create summary stats."""
    logger = get_run_logger()

    # Create results directory
    Path(output_path).parent.mkdir(exist_ok=True)

    # Save predictions to CSV
    with open(output_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["sample_id", "fire_alarm_prediction", "fire_probability"])

        for i, (pred, prob) in enumerate(zip(predictions, probabilities)):
            writer.writerow([i, pred, f"{prob:.6f}"])

    logger.info(f"✓ Predictions saved to: {output_path}")

    # Compute summary statistics
    n_fire = sum(predictions)
    n_no_fire = len(predictions) - n_fire
    avg_fire_prob = sum(probabilities) / len(probabilities)

    high_conf = sum(1 for p in probabilities if p > 0.9 or p < 0.1)
    med_conf = sum(1 for p in probabilities if 0.4 <= p <= 0.6)

    stats = {
        "total_samples": len(predictions),
        "n_fire": n_fire,
        "n_no_fire": n_no_fire,
        "pct_fire": (n_fire / len(predictions)) * 100,
        "avg_fire_prob": avg_fire_prob,
        "high_confidence": high_conf,
        "high_confidence_pct": (high_conf / len(predictions)) * 100,
        "medium_confidence": med_conf,
        "medium_confidence_pct": (med_conf / len(predictions)) * 100,
    }

    logger.info(f"  Fire predictions: {n_fire:,} ({stats['pct_fire']:.1f}%)")
    logger.info(f"  Average fire probability: {avg_fire_prob:.4f}")
    logger.info(
        f"  High confidence: {high_conf:,} ({stats['high_confidence_pct']:.1f}%)"
    )

    # Create Prefect artifacts
    create_markdown_artifact(
        key="prediction-summary",
        markdown=f"""# Test Set Prediction Summary

## Overall Statistics
- **Total Samples**: {stats["total_samples"]:,}
- **Predicted Fire Alarms**: {stats["n_fire"]:,} ({stats["pct_fire"]:.1f}%)
- **Predicted No-Fire**: {stats["n_no_fire"]:,} ({100 - stats["pct_fire"]:.1f}%)
- **Average Fire Probability**: {stats["avg_fire_prob"]:.4f}

## Confidence Distribution
- **High Confidence (>90%)**: {stats["high_confidence"]:,} ({stats["high_confidence_pct"]:.1f}%)
- **Medium Confidence (40-60%)**: {stats["medium_confidence"]:,} ({stats["medium_confidence_pct"]:.1f}%)

## Output File
- **Path**: `{output_path}`
""",
        description="Test set prediction statistics",
    )

    # Sample predictions table (first 10)
    table_data = [
        {
            "Sample ID": i,
            "Prediction": predictions[i],
            "Fire Probability": f"{probabilities[i]:.4f}",
        }
        for i in range(min(10, len(predictions)))
    ]

    create_table_artifact(
        key="sample-predictions",
        table=table_data,
        description="Sample of first 10 predictions",
    )

    return output_path, stats


# ============================================================================
# Main Flow
# ============================================================================


@flow(name="Smoke Detection Prediction", log_prints=True)
def prediction_flow(
    test_data_path: str = "smoke_analysis/data/raw/test_dataset.csv",
    train_data_path: str = "smoke_analysis/data/raw/train_dataset.csv",
    model_path: str = "results/model_run_001.eqx",
    output_path: str = "results/test_predictions_run_001.csv",
    batch_size: int = 1000,
    seed: int = 42,
):
    """
    Complete prediction pipeline for smoke detection test set.

    Args:
        test_data_path: Path to test CSV file
        train_data_path: Path to training CSV (for normalization stats)
        model_path: Path to trained model weights
        output_path: Where to save predictions
        batch_size: Batch size for prediction
        seed: Random seed (must match training)
    """
    logger = get_run_logger()
    logger.info("=" * 70)
    logger.info("SMOKE DETECTION PREDICTION PIPELINE")
    logger.info("=" * 70)

    # Task 1: Load test data
    X_test = load_test_data(test_data_path)

    # Task 2: Load trained model
    model = load_trained_model(model_path, seed)

    # Task 3: Normalize test data
    X_test_norm = normalize_test_data(X_test, train_data_path)

    # Task 4: Generate predictions
    predictions, probabilities = generate_predictions(model, X_test_norm, batch_size)

    # Task 5: Save predictions and create artifacts
    output_file, stats = save_predictions(predictions, probabilities, output_path)

    logger.info("=" * 70)
    logger.info("✓ PREDICTION PIPELINE COMPLETE")
    logger.info("=" * 70)
    logger.info(f"Predictions saved to: {output_file}")
    logger.info(f"Fire alarm rate: {stats['pct_fire']:.1f}%")

    return {"output_path": output_file, "stats": stats}


# ============================================================================
# Entry Point
# ============================================================================


if __name__ == "__main__":
    # Run the flow
    result = prediction_flow()
    print(f"\n✓ Flow completed successfully!")
    print(f"Predictions: {result['output_path']}")
    print(f"Fire alarm rate: {result['stats']['pct_fire']:.1f}%")
