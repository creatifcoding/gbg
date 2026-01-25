"""
Simple smoke detection training with JAX.

Dataset: 5,000 training samples with 14 sensor features
Goal: Binary classification (fire alarm yes/no)

Requirements:
  uv pip install jax jaxlib equinox optax

Run:
  python train_simple.py
"""

import csv
import time
from pathlib import Path
from typing import Tuple

import jax
import jax.numpy as jnp
import equinox as eqx
import optax


# ============================================================================
# Data Loading
# ============================================================================


def load_csv(filepath: str) -> Tuple[jnp.ndarray, jnp.ndarray]:
    """Load CSV and return features (14) and labels."""
    with open(filepath, "r") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    # 13 sensor features + CNT (exclude UTC timestamp)
    features = [
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

    X = jnp.array([[float(row[f]) for f in features] for row in rows])
    y = (
        jnp.array([int(row["Fire Alarm"]) for row in rows])
        if "Fire Alarm" in rows[0]
        else None
    )

    return X, y


def normalize(X_train, X_val=None):
    """Normalize using training statistics."""
    mean = jnp.mean(X_train, axis=0)
    std = jnp.std(X_train, axis=0) + 1e-8

    X_train_norm = (X_train - mean) / std
    X_val_norm = (X_val - mean) / std if X_val is not None else None

    return X_train_norm, X_val_norm


# ============================================================================
# Model
# ============================================================================


class MLP(eqx.Module):
    """Simple MLP: 13 → 64 → 32 → 2"""

    layers: list

    def __init__(self, key):
        keys = jax.random.split(key, 3)
        self.layers = [
            eqx.nn.Linear(13, 64, key=keys[0]),
            eqx.nn.Linear(64, 32, key=keys[1]),
            eqx.nn.Linear(32, 2, key=keys[2]),
        ]

    def __call__(self, x):
        x = jax.nn.gelu(self.layers[0](x))
        x = jax.nn.gelu(self.layers[1](x))
        return self.layers[2](x)


def loss_fn(model, X, y, class_weights):
    """Binary cross-entropy with class weights."""
    logits = jax.vmap(model)(X)
    y_onehot = jax.nn.one_hot(y, 2)

    log_probs = jax.nn.log_softmax(logits, axis=-1)
    loss = -jnp.sum(y_onehot * log_probs, axis=-1)

    weights = class_weights[y]
    return jnp.mean(loss * weights)


def accuracy(model, X, y):
    """Compute accuracy."""
    logits = jax.vmap(model)(X)
    preds = jnp.argmax(logits, axis=-1)
    return jnp.mean(preds == y)


# ============================================================================
# Training
# ============================================================================


def train_epoch(model, opt_state, optimizer, X, y, batch_size, class_weights):
    """Train one epoch."""
    n = X.shape[0]
    n_batches = n // batch_size
    total_loss = 0.0

    # Shuffle
    perm = jax.random.permutation(jax.random.PRNGKey(int(time.time())), n)
    X = X[perm]
    y = y[perm]

    for i in range(n_batches):
        start = i * batch_size
        end = start + batch_size

        X_batch = X[start:end]
        y_batch = y[start:end]

        # Gradient update
        loss_and_grad = eqx.filter_value_and_grad(
            lambda m: loss_fn(m, X_batch, y_batch, class_weights)
        )
        loss, grads = loss_and_grad(model)

        updates, opt_state = optimizer.update(grads, opt_state)
        model = eqx.apply_updates(model, updates)

        total_loss += loss

    return model, opt_state, total_loss / n_batches


# ============================================================================
# Main
# ============================================================================


def main():
    print("=" * 60)
    print("SMOKE DETECTION TRAINING")
    print("=" * 60)

    # Load data
    print("\nLoading data...")
    X, y = load_csv("smoke_analysis/data/raw/train_dataset.csv")
    print(f"  Dataset: {X.shape[0]} samples × {X.shape[1]} features")

    # Train/val split (80/20)
    split = int(0.8 * X.shape[0])
    X_train, y_train = X[:split], y[:split]
    X_val, y_val = X[split:], y[split:]

    # Normalize
    X_train, X_val = normalize(X_train, X_val)

    # Class weights (inverse frequency)
    n_no_fire = jnp.sum(y_train == 0)
    n_fire = jnp.sum(y_train == 1)
    total = len(y_train)
    class_weights = jnp.array([total / (2 * n_no_fire), total / (2 * n_fire)])

    print(f"  Train: {len(X_train)} | Val: {len(X_val)}")
    print(f"  Class balance: {int(n_no_fire)} no-fire, {int(n_fire)} fire")
    print(f"  Class weights: [{class_weights[0]:.3f}, {class_weights[1]:.3f}]")

    # Model
    print("\nInitializing model...")
    model = MLP(jax.random.PRNGKey(42))

    # Optimizer
    optimizer = optax.adam(1e-3)
    opt_state = optimizer.init(eqx.filter(model, eqx.is_array))

    # Train
    print("\nTraining...")
    n_epochs = 50
    batch_size = 64

    for epoch in range(n_epochs):
        model, opt_state, train_loss = train_epoch(
            model, opt_state, optimizer, X_train, y_train, batch_size, class_weights
        )

        if (epoch + 1) % 10 == 0:
            train_acc = accuracy(model, X_train, y_train)
            val_acc = accuracy(model, X_val, y_val)

            print(
                f"Epoch {epoch + 1:2d} | Loss: {train_loss:.4f} | "
                f"Train Acc: {train_acc:.3f} | Val Acc: {val_acc:.3f}"
            )

    # Final eval
    print("\n" + "=" * 60)
    print("FINAL RESULTS")
    print("=" * 60)
    print(f"Train Accuracy: {accuracy(model, X_train, y_train):.3f}")
    print(f"Val Accuracy:   {accuracy(model, X_val, y_val):.3f}")


if __name__ == "__main__":
    main()
