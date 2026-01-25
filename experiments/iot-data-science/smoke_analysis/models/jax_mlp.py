"""
JAX + Equinox MLP for Smoke Detection

Real Dataset:
- 5,000 training samples, 12,437 test samples
- 14 sensor features (Temperature, Humidity, TVOC, eCO2, PM1.0, PM2.5, etc.)
- UTC timestamp excluded from features
- Binary target: Fire Alarm (0=no fire, 1=fire)
- Class imbalance: 72.3% no fire, 27.7% fire

Architecture:
- Input: 14 sensor features
- Hidden layers: [64, 32, 16] with GELU activation
- Output: 2 classes (no fire / fire)
- Dropout for regularization (0.2)
- Weight initialization: Xavier for better gradient flow

Design rationale:
- MLP is appropriate for tabular sensor data
- Deeper than wide (64→32→16) to learn hierarchical patterns
- GELU activation for smoother gradients than ReLU
- Dropout (0.2) to prevent overfitting to majority class
- Binary cross-entropy loss with class weights [0.277, 0.723] to handle imbalance
"""

import jax
import jax.numpy as jnp
import equinox as eqx
from typing import Optional


class SmokeDetectorMLP(eqx.Module):
    """
    Multi-layer perceptron for smoke detection from IoT sensor data.

    Input shape: (batch_size, 15) - 15 sensor features
    Output shape: (batch_size, 2) - logits for [no_fire, fire]
    """

    layers: list
    dropout: eqx.nn.Dropout

    def __init__(
        self,
        in_features: int = 14,
        hidden_dims: Optional[list[int]] = None,
        out_features: int = 2,
        dropout_rate: float = 0.2,
        *,
        key: jax.Array,
    ):
        """
        Initialize the MLP.

        Args:
            in_features: Number of input features (default: 14 sensors, UTC excluded)
            hidden_dims: List of hidden layer dimensions (default: [64, 32, 16])
            out_features: Number of output classes (default: 2 for binary)
            dropout_rate: Dropout probability (default: 0.2)
            key: JAX random key for initialization
        """
        if hidden_dims is None:
            hidden_dims = [64, 32, 16]

        keys = jax.random.split(key, len(hidden_dims) + 1)

        # Build layers
        self.layers = []
        dims = [in_features] + hidden_dims + [out_features]

        for i in range(len(dims) - 1):
            layer = eqx.nn.Linear(dims[i], dims[i + 1], key=keys[i])
            self.layers.append(layer)

        self.dropout = eqx.nn.Dropout(dropout_rate)

    def __call__(
        self,
        x: jax.Array,
        *,
        key: Optional[jax.Array] = None,
        enable_dropout: bool = False,
    ) -> jax.Array:
        """
        Forward pass.

        Args:
            x: Input tensor of shape (batch_size, 15) or (15,)
            key: JAX random key for dropout (required if enable_dropout=True)
            enable_dropout: Whether to apply dropout (training=True, inference=False)

        Returns:
            Logits of shape (batch_size, 2) or (2,)
        """
        # Handle single sample (no batch dimension)
        squeeze_output = False
        if x.ndim == 1:
            x = jnp.expand_dims(x, axis=0)
            squeeze_output = True

        # Forward through hidden layers with GELU activation
        for i, layer in enumerate(self.layers[:-1]):
            x = layer(x)
            x = jax.nn.gelu(x)  # GELU is smoother than ReLU

            # Apply dropout during training
            if enable_dropout and key is not None:
                key, subkey = jax.random.split(key)
                x = self.dropout(x, key=subkey)

        # Output layer (no activation - logits)
        x = self.layers[-1](x)

        if squeeze_output:
            x = jnp.squeeze(x, axis=0)

        return x

    def predict_proba(self, x: jax.Array) -> jax.Array:
        """
        Get class probabilities using softmax.

        Args:
            x: Input tensor of shape (batch_size, 15) or (15,)

        Returns:
            Probabilities of shape (batch_size, 2) or (2,)
        """
        logits = self(x, enable_dropout=False)
        return jax.nn.softmax(logits, axis=-1)

    def predict(self, x: jax.Array) -> jax.Array:
        """
        Get class predictions (argmax).

        Args:
            x: Input tensor of shape (batch_size, 15) or (15,)

        Returns:
            Class indices of shape (batch_size,) or scalar
        """
        probs = self.predict_proba(x)
        return jnp.argmax(probs, axis=-1)


def binary_cross_entropy_loss(
    model: SmokeDetectorMLP,
    x: jax.Array,
    y: jax.Array,
    *,
    key: jax.Array,
    class_weights: Optional[jax.Array] = None,
) -> jax.Array:
    """
    Compute binary cross-entropy loss with optional class weighting.

    Args:
        model: The SmokeDetectorMLP model
        x: Input features of shape (batch_size, 15)
        y: True labels of shape (batch_size,) with values in {0, 1}
        key: JAX random key for dropout
        class_weights: Optional weights for classes [weight_no_fire, weight_fire]
                      e.g., [0.125, 0.875] to compensate for 12.5% fire alarm rate

    Returns:
        Scalar loss value
    """
    # Forward pass with dropout enabled
    logits = model(x, key=key, enable_dropout=True)

    # One-hot encode labels
    y_onehot = jax.nn.one_hot(y, num_classes=2)

    # Compute cross-entropy
    log_probs = jax.nn.log_softmax(logits, axis=-1)
    loss = -jnp.sum(y_onehot * log_probs, axis=-1)

    # Apply class weights if provided
    if class_weights is not None:
        weights = class_weights[y]
        loss = loss * weights

    return jnp.mean(loss)


def compute_metrics(
    model: SmokeDetectorMLP, x: jax.Array, y: jax.Array
) -> dict[str, float]:
    """
    Compute evaluation metrics.

    Args:
        model: The SmokeDetectorMLP model
        x: Input features of shape (batch_size, 15)
        y: True labels of shape (batch_size,) with values in {0, 1}

    Returns:
        Dictionary with metrics: accuracy, precision, recall, f1
    """
    # Get predictions
    y_pred = model.predict(x)

    # Compute confusion matrix components
    tp = jnp.sum((y_pred == 1) & (y == 1))
    fp = jnp.sum((y_pred == 1) & (y == 0))
    tn = jnp.sum((y_pred == 0) & (y == 0))
    fn = jnp.sum((y_pred == 0) & (y == 1))

    # Metrics
    accuracy = (tp + tn) / (tp + fp + tn + fn)
    precision = tp / (tp + fp + 1e-8)  # Add epsilon to avoid division by zero
    recall = tp / (tp + fn + 1e-8)
    f1 = 2 * (precision * recall) / (precision + recall + 1e-8)

    return {
        "accuracy": float(accuracy),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "true_positives": int(tp),
        "false_positives": int(fp),
        "true_negatives": int(tn),
        "false_negatives": int(fn),
    }


# Example usage:
if __name__ == "__main__":
    # Create model
    key = jax.random.PRNGKey(0)
    model = SmokeDetectorMLP(key=key)

    # Dummy data
    key, subkey = jax.random.split(key)
    x_batch = jax.random.normal(subkey, (32, 15))  # Batch of 32 samples
    y_batch = jax.random.randint(key, (32,), 0, 2)  # Binary labels

    # Forward pass
    logits = model(x_batch)
    print(f"Input shape: {x_batch.shape}")
    print(f"Output logits shape: {logits.shape}")
    print(f"Logits sample: {logits[0]}")

    # Predictions
    probs = model.predict_proba(x_batch)
    preds = model.predict(x_batch)
    print(f"\nProbabilities shape: {probs.shape}")
    print(f"Predictions shape: {preds.shape}")
    print(f"Sample probability: {probs[0]}")
    print(f"Sample prediction: {preds[0]}")

    # Loss
    key, subkey = jax.random.split(key)
    loss = binary_cross_entropy_loss(model, x_batch, y_batch, key=subkey)
    print(f"\nLoss: {loss:.4f}")

    # Metrics
    metrics = compute_metrics(model, x_batch, y_batch)
    print(f"\nMetrics:")
    for k, v in metrics.items():
        print(f"  {k}: {v}")
