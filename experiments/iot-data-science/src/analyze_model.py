"""
Model Analysis: Feature importance, prediction confidence distribution, error analysis
"""

import equinox as eqx
import jax
import jax.numpy as jnp
import numpy as np
import polars as pl
import duckdb
from pathlib import Path

# Define the same model architecture used in training
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

# Load trained model
model_path = Path("results/model_run_001.eqx")
model = eqx.tree_deserialise_leaves(model_path, MLP(jax.random.PRNGKey(0)))

# Load training data for feature importance
train_df = pl.read_csv("smoke_analysis/data/raw/train_dataset.csv")
features = [
    "Temperature[C]", "Humidity[%]", "TVOC[ppb]", "eCO2[ppm]",
    "Raw H2", "Raw Ethanol", "Pressure[hPa]", "PM1.0", "PM2.5",
    "NC0.5", "NC1.0", "NC2.5", "CNT"
]
X_train = train_df.select(features).to_numpy()
y_train = train_df['Fire Alarm'].to_numpy()

# Normalize (same as training)
mean = jnp.mean(X_train, axis=0)
std = jnp.std(X_train, axis=0) + 1e-8
X_train_norm = (X_train - mean) / std

# Load predictions
pred_df = pl.read_csv("results/test_predictions_run_001.csv")

print("=" * 80)
print("MODEL ANALYSIS")
print("=" * 80)

# 1. FEATURE IMPORTANCE (via gradient-based attribution)
print("\n1. FEATURE IMPORTANCE (Gradient-based)")
print("-" * 80)

def predict_fn(x):
    logits = jax.vmap(model)(x)
    return jax.nn.softmax(logits)[:, 1]  # Probability of fire

# Compute gradients for a sample of inputs
sample_size = 100
sample_indices = jax.random.choice(jax.random.PRNGKey(42), len(X_train_norm), shape=(sample_size,), replace=False)
X_sample = X_train_norm[sample_indices].astype('float32')

grad_fn = jax.vmap(jax.grad(lambda x: predict_fn(x.reshape(1, -1))[0]))
gradients = grad_fn(X_sample)
feature_importance = jnp.abs(gradients).mean(axis=0)

# Normalize to percentages
feature_importance_pct = (feature_importance / feature_importance.sum()) * 100

# Convert to numpy for Polars
importance_df = pl.DataFrame({
    'Feature': features,
    'Importance': np.array(feature_importance_pct),
}).sort('Importance', descending=True)

print(importance_df)

# 2. PREDICTION CONFIDENCE DISTRIBUTION
print("\n\n2. PREDICTION CONFIDENCE DISTRIBUTION")
print("-" * 80)

confidence_stats = duckdb.query("""
    SELECT 
        CASE 
            WHEN fire_probability >= 0.9 THEN 'Very High (90-100%)'
            WHEN fire_probability >= 0.7 THEN 'High (70-90%)'
            WHEN fire_probability >= 0.6 THEN 'Medium (60-70%)'
            WHEN fire_probability >= 0.4 THEN 'Low (40-60%)'
            ELSE 'Very Low (0-40%)'
        END as Confidence_Level,
        COUNT(*) as Count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as Percentage,
        ROUND(AVG(fire_probability), 4) as Avg_Probability,
        ROUND(MIN(fire_probability), 4) as Min_Probability,
        ROUND(MAX(fire_probability), 4) as Max_Probability
    FROM pred_df
    GROUP BY Confidence_Level
    ORDER BY Min_Probability DESC
""").pl()

print(confidence_stats)

# 3. MEDIUM CONFIDENCE SAMPLES (potential errors)
print("\n\n3. MEDIUM CONFIDENCE SAMPLES (40-60% probability)")
print("-" * 80)

medium_conf = pred_df.filter(
    (pl.col('fire_probability') >= 0.4) & (pl.col('fire_probability') <= 0.6)
).sort('fire_probability')

if len(medium_conf) > 0:
    print(f"Found {len(medium_conf)} medium-confidence predictions:")
    print(medium_conf)
    
    # Load corresponding test samples
    test_df = pl.read_csv("smoke_analysis/data/raw/test_dataset.csv")
    test_features = test_df.select(features)
    
    print("\n\nFeature values for medium-confidence samples:")
    for idx, row_idx in enumerate(medium_conf['sample_id'].to_list()):
        print(f"\nSample {row_idx} (Pred: Fire={medium_conf['fire_alarm_prediction'][idx]}, "
              f"Prob={medium_conf['fire_probability'][idx]:.4f}):")
        sample_data = test_features[row_idx].to_dicts()[0]
        for feat, val in sample_data.items():
            print(f"  {feat:20s}: {val:8.4f}")
else:
    print("No medium-confidence predictions found!")

# 4. CLASS DISTRIBUTION COMPARISON
print("\n\n4. CLASS DISTRIBUTION: Training vs Test Predictions")
print("-" * 80)

train_dist = duckdb.query("""
    SELECT 
        'Training' as Dataset,
        COUNT(*) as Total,
        SUM(CASE WHEN "Fire Alarm" = 0 THEN 1 ELSE 0 END) as No_Fire,
        SUM(CASE WHEN "Fire Alarm" = 1 THEN 1 ELSE 0 END) as Fire,
        ROUND(SUM(CASE WHEN "Fire Alarm" = 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as No_Fire_Pct,
        ROUND(SUM(CASE WHEN "Fire Alarm" = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as Fire_Pct
    FROM train_df
""").pl()

pred_dist = duckdb.query("""
    SELECT 
        'Test Predictions' as Dataset,
        COUNT(*) as Total,
        SUM(CASE WHEN fire_alarm_prediction = 0 THEN 1 ELSE 0 END) as No_Fire,
        SUM(CASE WHEN fire_alarm_prediction = 1 THEN 1 ELSE 0 END) as Fire,
        ROUND(SUM(CASE WHEN fire_alarm_prediction = 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as No_Fire_Pct,
        ROUND(SUM(CASE WHEN fire_alarm_prediction = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as Fire_Pct
    FROM pred_df
""").pl()

comparison = pl.concat([train_dist, pred_dist])
print(comparison)

# 5. SAVE ANALYSIS RESULTS
print("\n\n5. SAVING ANALYSIS RESULTS")
print("-" * 80)

output_dir = Path("results")

# Save feature importance
importance_df.write_csv(output_dir / "feature_importance.csv")
print(f"✓ Saved: {output_dir / 'feature_importance.csv'}")

# Save confidence distribution
confidence_stats.write_csv(output_dir / "confidence_distribution.csv")
print(f"✓ Saved: {output_dir / 'confidence_distribution.csv'}")

# Save medium-confidence samples (if any)
if len(medium_conf) > 0:
    medium_conf.write_csv(output_dir / "medium_confidence_predictions.csv")
    print(f"✓ Saved: {output_dir / 'medium_confidence_predictions.csv'}")

print("\n" + "=" * 80)
print("ANALYSIS COMPLETE")
print("=" * 80)
