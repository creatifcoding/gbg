"""
Prefect Training Flow for Smoke Detection Model.

This flow orchestrates the complete training pipeline:
1. Load and validate training data
2. Split into train/validation sets
3. Normalize features
4. Train JAX/Equinox MLP model
5. Evaluate performance
6. Save model artifact

Run:
    uv run python flows/train_flow.py
"""

import sys
from pathlib import Path
from typing import Tuple

import jax
import jax.numpy as jnp
import equinox as eqx
import optax
from prefect import flow, task, get_run_logger
from prefect.artifacts import create_markdown_artifact

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
from train_simple import MLP, load_csv, normalize, train_epoch, accuracy, loss_fn


# ============================================================================
# Tasks
# ============================================================================


@task(name="Load Training Data", retries=2, retry_delay_seconds=5)
def load_training_data(filepath: str) -> Tuple[jnp.ndarray, jnp.ndarray]:
    """Load training dataset from CSV."""
    logger = get_run_logger()
    logger.info(f"Loading training data from: {filepath}")

    X, y = load_csv(filepath)

    logger.info(f"Loaded {X.shape[0]} samples with {X.shape[1]} features")
    logger.info(f"Label distribution: {jnp.bincount(y)}")

    return X, y


@task(name="Split Train/Validation")
def split_data(
    X: jnp.ndarray, y: jnp.ndarray, train_ratio: float = 0.8
) -> Tuple[jnp.ndarray, jnp.ndarray, jnp.ndarray, jnp.ndarray]:
    """Split data into training and validation sets."""
    logger = get_run_logger()

    split_idx = int(train_ratio * X.shape[0])
    X_train, y_train = X[:split_idx], y[:split_idx]
    X_val, y_val = X[split_idx:], y[split_idx:]

    logger.info(f"Train set: {len(X_train)} samples")
    logger.info(f"Validation set: {len(X_val)} samples")

    return X_train, y_train, X_val, y_val


@task(name="Normalize Features")
def normalize_features(
    X_train: jnp.ndarray, X_val: jnp.ndarray
) -> Tuple[jnp.ndarray, jnp.ndarray, jnp.ndarray, jnp.ndarray]:
    """Normalize features using training statistics."""
    logger = get_run_logger()
    logger.info("Normalizing features...")

    X_train_norm, X_val_norm = normalize(X_train, X_val)

    # Save normalization stats for later use
    mean = jnp.mean(X_train, axis=0)
    std = jnp.std(X_train, axis=0) + 1e-8

    logger.info(
        f"Feature mean range: [{float(jnp.min(mean)):.2f}, {float(jnp.max(mean)):.2f}]"
    )
    logger.info(
        f"Feature std range: [{float(jnp.min(std)):.2f}, {float(jnp.max(std)):.2f}]"
    )

    return X_train_norm, X_val_norm, mean, std


@task(name="Calculate Class Weights")
def calculate_class_weights(y_train: jnp.ndarray) -> jnp.ndarray:
    """Calculate class weights for imbalanced dataset."""
    logger = get_run_logger()

    n_no_fire = jnp.sum(y_train == 0)
    n_fire = jnp.sum(y_train == 1)
    total = len(y_train)

    class_weights = jnp.array([total / (2 * n_no_fire), total / (2 * n_fire)])

    logger.info(f"Class distribution: {int(n_no_fire)} no-fire, {int(n_fire)} fire")
    logger.info(f"Class weights: [{class_weights[0]:.3f}, {class_weights[1]:.3f}]")

    return class_weights


@task(name="Train Model", log_prints=True)
def train_model(
    X_train: jnp.ndarray,
    y_train: jnp.ndarray,
    X_val: jnp.ndarray,
    y_val: jnp.ndarray,
    class_weights: jnp.ndarray,
    n_epochs: int = 50,
    batch_size: int = 64,
    learning_rate: float = 1e-3,
    seed: int = 42,
) -> Tuple[MLP, dict]:
    """Train the MLP model."""
    logger = get_run_logger()
    logger.info("Initializing model...")

    # Initialize model
    key = jax.random.PRNGKey(seed)
    model = MLP(key)

    # Initialize optimizer
    optimizer = optax.adam(learning_rate)
    opt_state = optimizer.init(eqx.filter(model, eqx.is_array))

    logger.info(f"Training for {n_epochs} epochs with batch size {batch_size}")

    # Training loop
    history = {"train_loss": [], "train_acc": [], "val_acc": []}

    for epoch in range(n_epochs):
        # Train one epoch
        model, opt_state, train_loss = train_epoch(
            model, opt_state, optimizer, X_train, y_train, batch_size, class_weights
        )

        history["train_loss"].append(float(train_loss))

        # Log every 10 epochs
        if (epoch + 1) % 10 == 0:
            train_acc = accuracy(model, X_train, y_train)
            val_acc = accuracy(model, X_val, y_val)

            history["train_acc"].append(float(train_acc))
            history["val_acc"].append(float(val_acc))

            logger.info(
                f"Epoch {epoch + 1:2d} | "
                f"Loss: {train_loss:.4f} | "
                f"Train Acc: {train_acc:.3f} | "
                f"Val Acc: {val_acc:.3f}"
            )

    # Final evaluation
    final_train_acc = accuracy(model, X_train, y_train)
    final_val_acc = accuracy(model, X_val, y_val)

    history["final_train_acc"] = float(final_train_acc)
    history["final_val_acc"] = float(final_val_acc)

    logger.info(f"✓ Training complete!")
    logger.info(f"  Final Train Accuracy: {final_train_acc:.3f}")
    logger.info(f"  Final Val Accuracy: {final_val_acc:.3f}")

    return model, history


@task(name="Save Model Artifact")
def save_model_artifact(
    model: MLP, history: dict, output_path: str = "results/model_run_001.eqx"
) -> str:
    """Save trained model to disk."""
    logger = get_run_logger()

    # Create results directory
    Path(output_path).parent.mkdir(exist_ok=True)

    # Save model
    eqx.tree_serialise_leaves(output_path, model)

    logger.info(f"✓ Model saved to: {output_path}")

    # Create Prefect markdown artifact with training summary
    markdown_content = f"""# Training Run Summary

## Model Performance
- **Final Training Accuracy**: {history["final_train_acc"]:.3f}
- **Final Validation Accuracy**: {history["final_val_acc"]:.3f}

## Training Configuration
- **Epochs**: {len(history["train_loss"])}
- **Final Training Loss**: {history["train_loss"][-1]:.4f}

## Model Location
- **Path**: `{output_path}`
"""

    create_markdown_artifact(
        key="training-summary",
        markdown=markdown_content,
        description="Training run summary and metrics",
    )

    return output_path


# ============================================================================
# Main Flow
# ============================================================================


@flow(name="Smoke Detection Training", log_prints=True)
def training_flow(
    train_data_path: str = "smoke_analysis/data/raw/train_dataset.csv",
    model_output_path: str = "results/model_run_001.eqx",
    n_epochs: int = 50,
    batch_size: int = 64,
    learning_rate: float = 1e-3,
    train_ratio: float = 0.8,
    seed: int = 42,
):
    """
    Complete training pipeline for smoke detection model.

    Args:
        train_data_path: Path to training CSV file
        model_output_path: Where to save the trained model
        n_epochs: Number of training epochs
        batch_size: Training batch size
        learning_rate: Adam optimizer learning rate
        train_ratio: Ratio of data to use for training (rest is validation)
        seed: Random seed for reproducibility
    """
    logger = get_run_logger()
    logger.info("=" * 70)
    logger.info("SMOKE DETECTION TRAINING PIPELINE")
    logger.info("=" * 70)

    # Task 1: Load data
    X, y = load_training_data(train_data_path)

    # Task 2: Split data
    X_train, y_train, X_val, y_val = split_data(X, y, train_ratio)

    # Task 3: Normalize features
    X_train_norm, X_val_norm, mean, std = normalize_features(X_train, X_val)

    # Task 4: Calculate class weights
    class_weights = calculate_class_weights(y_train)

    # Task 5: Train model
    model, history = train_model(
        X_train_norm,
        y_train,
        X_val_norm,
        y_val,
        class_weights,
        n_epochs=n_epochs,
        batch_size=batch_size,
        learning_rate=learning_rate,
        seed=seed,
    )

    # Task 6: Save model
    model_path = save_model_artifact(model, history, model_output_path)

    logger.info("=" * 70)
    logger.info("✓ TRAINING PIPELINE COMPLETE")
    logger.info("=" * 70)
    logger.info(f"Model saved to: {model_path}")
    logger.info(f"Final validation accuracy: {history['final_val_acc']:.3f}")

    return {"model_path": model_path, "metrics": history}


# ============================================================================
# Entry Point
# ============================================================================


if __name__ == "__main__":
    # Run the flow
    result = training_flow()
    print(f"\n✓ Flow completed successfully!")
    print(f"Model: {result['model_path']}")
    print(f"Validation Accuracy: {result['metrics']['final_val_acc']:.3f}")
