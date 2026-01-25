"""
Generate predictions on test set using trained model.

Loads the trained model weights and generates predictions
for the 12,437 test samples.

Requirements:
  uv pip install jax jaxlib equinox

Run:
  python predict_test.py
"""

import csv
import pickle
from pathlib import Path

import jax
import jax.numpy as jnp
import equinox as eqx

from train_simple import MLP, load_csv, normalize


def save_model(model, filepath):
    """Save model to disk using equinox serialization."""
    eqx.tree_serialise_leaves(filepath, model)
    print(f"Model saved to: {filepath}")


def load_model(filepath, key):
    """Load model from disk."""
    model = MLP(key)
    return eqx.tree_deserialise_leaves(filepath, model)


def main():
    print("=" * 80)
    print("TEST SET PREDICTION")
    print("=" * 80)

    # Paths
    train_path = "smoke_analysis/data/raw/train_dataset.csv"
    test_path = "smoke_analysis/data/raw/test_dataset.csv"
    model_path = "results/model_run_001.eqx"
    output_path = "results/test_predictions_run_001.csv"

    # Create results directory
    Path("results").mkdir(exist_ok=True)

    # ========================================================================
    # Step 1: Re-train model to save weights
    # ========================================================================
    print("\n[1/4] Re-training model to save weights...")

    # Load training data
    X_train_full, y_train_full = load_csv(train_path)

    # Split train/val (same as training)
    n_train = int(0.8 * X_train_full.shape[0])
    X_train = X_train_full[:n_train]

    # Normalize
    mean = jnp.mean(X_train, axis=0)
    std = jnp.std(X_train, axis=0) + 1e-8

    # Initialize model (same seed for reproducibility)
    key = jax.random.PRNGKey(42)
    model = MLP(key)

    # Quick training (we already know it converges)
    from train_simple import train_epoch
    import optax

    optimizer = optax.adam(1e-3)
    opt_state = optimizer.init(eqx.filter(model, eqx.is_array))

    # Class weights
    n_no_fire = jnp.sum(y_train_full[:n_train] == 0)
    n_fire = jnp.sum(y_train_full[:n_train] == 1)
    total = len(y_train_full[:n_train])
    class_weights = jnp.array([total / (2 * n_no_fire), total / (2 * n_fire)])

    # Normalize training data
    X_train_norm = (X_train - mean) / std
    y_train = y_train_full[:n_train]

    # Train for 50 epochs (fast on CPU)
    print("  Training 50 epochs...")
    for epoch in range(50):
        model, opt_state, loss = train_epoch(
            model, opt_state, optimizer, X_train_norm, y_train, 64, class_weights
        )
        if (epoch + 1) % 10 == 0:
            print(f"  Epoch {epoch + 1}: Loss = {loss:.4f}")

    # Save model
    save_model(model, model_path)

    # ========================================================================
    # Step 2: Load test data
    # ========================================================================
    print(f"\n[2/4] Loading test data...")
    X_test, _ = load_csv(test_path)
    print(f"  Test samples: {X_test.shape[0]:,}")
    print(f"  Test features: {X_test.shape[1]}")

    # ========================================================================
    # Step 3: Normalize test data
    # ========================================================================
    print(f"\n[3/4] Normalizing test data...")
    X_test_norm = (X_test - mean) / std
    print(f"  Normalized shape: {X_test_norm.shape}")

    # ========================================================================
    # Step 4: Generate predictions
    # ========================================================================
    print(f"\n[4/4] Generating predictions...")

    # Predict in batches for memory efficiency
    batch_size = 1000
    n_samples = X_test_norm.shape[0]
    n_batches = (n_samples + batch_size - 1) // batch_size

    all_predictions = []
    all_probabilities = []

    for i in range(n_batches):
        start_idx = i * batch_size
        end_idx = min(start_idx + batch_size, n_samples)

        X_batch = X_test_norm[start_idx:end_idx]

        # Get logits
        logits = jax.vmap(model)(X_batch)

        # Get probabilities
        probs = jax.nn.softmax(logits, axis=-1)

        # Get predictions
        preds = jnp.argmax(logits, axis=-1)

        all_predictions.extend(preds.tolist())
        all_probabilities.extend(probs[:, 1].tolist())  # Probability of fire

        if (i + 1) % 5 == 0:
            print(f"  Processed {end_idx:,}/{n_samples:,} samples...")

    print(f"  ✓ All {len(all_predictions):,} predictions generated")

    # ========================================================================
    # Step 5: Save predictions
    # ========================================================================
    print(f"\nSaving predictions to: {output_path}")

    with open(output_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["sample_id", "fire_alarm_prediction", "fire_probability"])

        for i, (pred, prob) in enumerate(zip(all_predictions, all_probabilities)):
            writer.writerow([i, pred, f"{prob:.6f}"])

    # ========================================================================
    # Summary Statistics
    # ========================================================================
    print("\n" + "=" * 80)
    print("PREDICTION SUMMARY")
    print("=" * 80)

    n_fire = sum(all_predictions)
    n_no_fire = len(all_predictions) - n_fire

    print(f"\nTest Set Predictions:")
    print(
        f"  No Fire (0): {n_no_fire:,} ({n_no_fire / len(all_predictions) * 100:.1f}%)"
    )
    print(f"  Fire (1):    {n_fire:,} ({n_fire / len(all_predictions) * 100:.1f}%)")

    avg_fire_prob = sum(all_probabilities) / len(all_probabilities)
    print(f"\nAverage Fire Probability: {avg_fire_prob:.4f}")

    # Confidence distribution
    high_conf = sum(1 for p in all_probabilities if p > 0.9 or p < 0.1)
    med_conf = sum(1 for p in all_probabilities if 0.4 <= p <= 0.6)

    print(f"\nPrediction Confidence:")
    print(
        f"  High confidence (>90%): {high_conf:,} ({high_conf / len(all_probabilities) * 100:.1f}%)"
    )
    print(
        f"  Medium confidence (40-60%): {med_conf:,} ({med_conf / len(all_probabilities) * 100:.1f}%)"
    )

    print("\n" + "=" * 80)
    print("✓ Predictions complete!")
    print("=" * 80)
    print(f"\nFiles generated:")
    print(f"  - {model_path}")
    print(f"  - {output_path}")


if __name__ == "__main__":
    main()
