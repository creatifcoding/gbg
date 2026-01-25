"""
Training script for smoke detection using JAX + Equinox

This script:
1. Loads the REAL smoke detection dataset (5,000 train, 12,437 test)
2. Preprocesses features (normalize, handle UTC timestamp)
3. Trains MLP with class-weighted loss
4. Evaluates on validation set
5. Generates predictions for test set

Dataset info:
- 14 sensor features: Temperature, Humidity, TVOC, eCO2, PM sensors, etc.
- Binary target: Fire Alarm (0/1)
- Class imbalance: 72.3% no fire, 27.7% fire
"""

import jax
import jax.numpy as jnp
import equinox as eqx
import optax
from pathlib import Path
import csv
from typing import Tuple
import time

from smoke_analysis.models.jax_mlp import (
    SmokeDetectorMLP,
    binary_cross_entropy_loss,
    compute_metrics,
)


def load_csv_data(filepath: str) -> Tuple[jnp.ndarray, jnp.ndarray]:
    """
    Load smoke detection CSV data.

    Args:
        filepath: Path to CSV file

    Returns:
        features: (N, 14) array - sensor readings (UTC excluded)
        labels: (N,) array - Fire Alarm binary labels (or None for test set)
    """
    with open(filepath, "r") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    # Feature columns (exclude UTC and Fire Alarm)
    feature_cols = [
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
        "CNT",
    ]

    # Extract features
    X = []
    for row in rows:
        features = [float(row[col]) for col in feature_cols]
        X.append(features)

    X = jnp.array(X)

    # Extract labels if present
    y = None
    if "Fire Alarm" in rows[0]:
        y = jnp.array([int(row["Fire Alarm"]) for row in rows])

    return X, y


def normalize_features(
    X_train: jnp.ndarray, X_val: jnp.ndarray = None
) -> Tuple[jnp.ndarray, jnp.ndarray, dict]:
    """
    Normalize features using training set statistics.

    Args:
        X_train: Training features
        X_val: Validation features (optional)

    Returns:
        X_train_norm: Normalized training features
        X_val_norm: Normalized validation features (or None)
        stats: Dictionary with mean and std for each feature
    """
    mean = jnp.mean(X_train, axis=0)
    std = jnp.std(X_train, axis=0) + 1e-8  # Avoid division by zero

    X_train_norm = (X_train - mean) / std

    X_val_norm = None
    if X_val is not None:
        X_val_norm = (X_val - mean) / std

    stats = {"mean": mean, "std": std}
    return X_train_norm, X_val_norm, stats


def train_epoch(
    model: SmokeDetectorMLP,
    opt_state: optax.OptState,
    optimizer: optax.GradientTransformation,
    X: jnp.ndarray,
    y: jnp.ndarray,
    batch_size: int,
    class_weights: jnp.ndarray,
    key: jax.Array,
) -> Tuple[SmokeDetectorMLP, optax.OptState, float]:
    """
    Train for one epoch.

    Args:
        model: Current model
        opt_state: Optimizer state
        optimizer: Optax optimizer
        X: Training features (N, 14)
        y: Training labels (N,)
        batch_size: Batch size
        class_weights: Class weights for loss
        key: JAX random key

    Returns:
        model: Updated model
        opt_state: Updated optimizer state
        avg_loss: Average loss for epoch
    """
    n_samples = X.shape[0]
    n_batches = n_samples // batch_size

    total_loss = 0.0

    # Shuffle data
    key, subkey = jax.random.split(key)
    perm = jax.random.permutation(subkey, n_samples)
    X_shuffled = X[perm]
    y_shuffled = y[perm]

    for i in range(n_batches):
        start_idx = i * batch_size
        end_idx = start_idx + batch_size

        X_batch = X_shuffled[start_idx:end_idx]
        y_batch = y_shuffled[start_idx:end_idx]

        # Compute loss and gradients
        key, subkey = jax.random.split(key)
        loss_fn = lambda m: binary_cross_entropy_loss(
            m, X_batch, y_batch, key=subkey, class_weights=class_weights
        )

        loss, grads = eqx.filter_value_and_grad(loss_fn)(model)

        # Update parameters
        updates, opt_state = optimizer.update(grads, opt_state)
        model = eqx.apply_updates(model, updates)

        total_loss += loss

    avg_loss = total_loss / n_batches
    return model, opt_state, float(avg_loss)


def main():
    """Main training pipeline."""

    print("=" * 80)
    print("SMOKE DETECTION TRAINING - JAX + Equinox")
    print("=" * 80)

    # Paths
    data_dir = Path("smoke_analysis/data/raw")
    train_path = data_dir / "train_dataset.csv"
    test_path = data_dir / "test_dataset.csv"

    # Load data
    print("\n[1/6] Loading data...")
    X_train_full, y_train_full = load_csv_data(str(train_path))
    print(
        f"  Train: {X_train_full.shape[0]:,} samples × {X_train_full.shape[1]} features"
    )

    # Split train into train/val (80/20)
    n_train = int(0.8 * X_train_full.shape[0])
    X_train = X_train_full[:n_train]
    y_train = y_train_full[:n_train]
    X_val = X_train_full[n_train:]
    y_val = y_train_full[n_train:]

    print(f"  Split: {X_train.shape[0]:,} train, {X_val.shape[0]:,} validation")

    # Normalize features
    print("\n[2/6] Normalizing features...")
    X_train, X_val, stats = normalize_features(X_train, X_val)
    print(f"  Mean: {stats['mean'][:3]}...")
    print(f"  Std:  {stats['std'][:3]}...")

    # Compute class weights
    n_no_fire = jnp.sum(y_train == 0)
    n_fire = jnp.sum(y_train == 1)
    total = len(y_train)

    # Inverse frequency weighting
    weight_no_fire = total / (2 * n_no_fire)
    weight_fire = total / (2 * n_fire)
    class_weights = jnp.array([weight_no_fire, weight_fire])

    print(f"\n[3/6] Class distribution:")
    print(f"  No fire: {int(n_no_fire):,} ({n_no_fire / total * 100:.1f}%)")
    print(f"  Fire:    {int(n_fire):,} ({n_fire / total * 100:.1f}%)")
    print(f"  Class weights: [{weight_no_fire:.3f}, {weight_fire:.3f}]")

    # Initialize model
    print("\n[4/6] Initializing model...")
    key = jax.random.PRNGKey(42)
    key, subkey = jax.random.split(key)

    model = SmokeDetectorMLP(
        in_features=14, hidden_dims=[64, 32, 16], dropout_rate=0.2, key=subkey
    )

    # Count parameters
    params = eqx.filter(model, eqx.is_array)
    n_params = sum(p.size for p in jax.tree_util.tree_leaves(params))
    print(f"  Parameters: {n_params:,}")
    print(f"  Architecture: 14 → 64 → 32 → 16 → 2")

    # Setup optimizer
    learning_rate = 1e-3
    optimizer = optax.adam(learning_rate)
    opt_state = optimizer.init(eqx.filter(model, eqx.is_array))

    # Training loop
    print(f"\n[5/6] Training...")
    n_epochs = 50
    batch_size = 64

    best_val_f1 = 0.0
    best_model = model

    for epoch in range(n_epochs):
        start_time = time.time()

        # Train
        key, subkey = jax.random.split(key)
        model, opt_state, train_loss = train_epoch(
            model,
            opt_state,
            optimizer,
            X_train,
            y_train,
            batch_size,
            class_weights,
            subkey,
        )

        # Validate every 5 epochs
        if (epoch + 1) % 5 == 0:
            train_metrics = compute_metrics(model, X_train, y_train)
            val_metrics = compute_metrics(model, X_val, y_val)

            epoch_time = time.time() - start_time

            print(f"\nEpoch {epoch + 1}/{n_epochs} ({epoch_time:.2f}s)")
            print(f"  Loss: {train_loss:.4f}")
            print(
                f"  Train - Acc: {train_metrics['accuracy']:.3f}, "
                f"P: {train_metrics['precision']:.3f}, "
                f"R: {train_metrics['recall']:.3f}, "
                f"F1: {train_metrics['f1']:.3f}"
            )
            print(
                f"  Val   - Acc: {val_metrics['accuracy']:.3f}, "
                f"P: {val_metrics['precision']:.3f}, "
                f"R: {val_metrics['recall']:.3f}, "
                f"F1: {val_metrics['f1']:.3f}"
            )

            # Save best model
            if val_metrics["f1"] > best_val_f1:
                best_val_f1 = val_metrics["f1"]
                best_model = model
                print(f"  ★ New best F1: {best_val_f1:.3f}")

    # Final evaluation
    print(f"\n[6/6] Final evaluation...")
    final_train_metrics = compute_metrics(best_model, X_train, y_train)
    final_val_metrics = compute_metrics(best_model, X_val, y_val)

    print(f"\n{'=' * 80}")
    print(f"FINAL RESULTS (Best Model)")
    print(f"{'=' * 80}")
    print(f"\nTraining Set:")
    print(f"  Accuracy:  {final_train_metrics['accuracy']:.3f}")
    print(f"  Precision: {final_train_metrics['precision']:.3f}")
    print(f"  Recall:    {final_train_metrics['recall']:.3f}")
    print(f"  F1 Score:  {final_train_metrics['f1']:.3f}")
    print(f"  Confusion Matrix:")
    print(
        f"    TN: {final_train_metrics['true_negatives']:4d}  FP: {final_train_metrics['false_positives']:4d}"
    )
    print(
        f"    FN: {final_train_metrics['false_negatives']:4d}  TP: {final_train_metrics['true_positives']:4d}"
    )

    print(f"\nValidation Set:")
    print(f"  Accuracy:  {final_val_metrics['accuracy']:.3f}")
    print(f"  Precision: {final_val_metrics['precision']:.3f}")
    print(f"  Recall:    {final_val_metrics['recall']:.3f}")
    print(f"  F1 Score:  {final_val_metrics['f1']:.3f}")
    print(f"  Confusion Matrix:")
    print(
        f"    TN: {final_val_metrics['true_negatives']:4d}  FP: {final_val_metrics['false_positives']:4d}"
    )
    print(
        f"    FN: {final_val_metrics['false_negatives']:4d}  TP: {final_val_metrics['true_positives']:4d}"
    )

    print(f"\n{'=' * 80}")
    print("Training complete!")
    print(f"{'=' * 80}")


if __name__ == "__main__":
    main()
