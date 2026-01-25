"""
Train ensemble models to reduce CNT sensor over-reliance.

Models:
1. Random Forest (sklearn)
2. XGBoost (gradient boosting)
3. Neural Network (different architecture from JAX model)

Requirements:
    uv pip install scikit-learn xgboost

Run:
    uv run python train_ensemble.py
"""

import polars as pl
import numpy as np
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    classification_report, confusion_matrix
)
import xgboost as xgb
import pickle
import time

print("=" * 80)
print("ENSEMBLE MODEL TRAINING")
print("=" * 80)

# Load data
print("\nLoading data...")
train_df = pl.read_csv("smoke_analysis/data/raw/train_dataset.csv")

features = [
    "Temperature[C]", "Humidity[%]", "TVOC[ppb]", "eCO2[ppm]",
    "Raw H2", "Raw Ethanol", "Pressure[hPa]", "PM1.0", "PM2.5",
    "NC0.5", "NC1.0", "NC2.5", "CNT"
]

X = train_df.select(features).to_numpy()
y = train_df['Fire Alarm'].to_numpy()

print(f"  Dataset: {X.shape[0]} samples × {X.shape[1]} features")
print(f"  Classes: {np.unique(y, return_counts=True)}")

# Train/val split (80/20)
X_train, X_val, y_train, y_val = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

print(f"  Train: {len(X_train)} | Val: {len(X_val)}")

# Normalize
mean = np.mean(X_train, axis=0)
std = np.std(X_train, axis=0) + 1e-8

X_train_norm = (X_train - mean) / std
X_val_norm = (X_val - mean) / std

# Class weights
class_counts = np.bincount(y_train)
class_weights = {0: len(y_train) / (2 * class_counts[0]),
                 1: len(y_train) / (2 * class_counts[1])}
print(f"  Class weights: {class_weights}")

# ============================================================================
# Model 1: Random Forest
# ============================================================================
print("\n" + "=" * 80)
print("MODEL 1: RANDOM FOREST")
print("=" * 80)

start = time.time()
rf = RandomForestClassifier(
    n_estimators=100,
    max_depth=10,
    min_samples_split=10,
    min_samples_leaf=5,
    class_weight=class_weights,
    random_state=42,
    n_jobs=-1,
    verbose=0
)

rf.fit(X_train_norm, y_train)
rf_time = time.time() - start

rf_train_acc = accuracy_score(y_train, rf.predict(X_train_norm))
rf_val_acc = accuracy_score(y_val, rf.predict(X_val_norm))

print(f"Training time: {rf_time:.2f}s")
print(f"Train accuracy: {rf_train_acc:.4f}")
print(f"Val accuracy: {rf_val_acc:.4f}")

# Feature importance
rf_importance = rf.feature_importances_
print("\nFeature Importance (top 5):")
for i in np.argsort(rf_importance)[::-1][:5]:
    print(f"  {features[i]:20s}: {rf_importance[i]:.4f}")

# ============================================================================
# Model 2: XGBoost
# ============================================================================
print("\n" + "=" * 80)
print("MODEL 2: XGBOOST")
print("=" * 80)

# Calculate scale_pos_weight for XGBoost
scale_pos_weight = class_counts[0] / class_counts[1]

start = time.time()
xgb_model = xgb.XGBClassifier(
    n_estimators=100,
    max_depth=6,
    learning_rate=0.1,
    scale_pos_weight=scale_pos_weight,
    random_state=42,
    n_jobs=-1,
    verbosity=0
)

xgb_model.fit(X_train_norm, y_train)
xgb_time = time.time() - start

xgb_train_acc = accuracy_score(y_train, xgb_model.predict(X_train_norm))
xgb_val_acc = accuracy_score(y_val, xgb_model.predict(X_val_norm))

print(f"Training time: {xgb_time:.2f}s")
print(f"Train accuracy: {xgb_train_acc:.4f}")
print(f"Val accuracy: {xgb_val_acc:.4f}")

# Feature importance
xgb_importance = xgb_model.feature_importances_
print("\nFeature Importance (top 5):")
for i in np.argsort(xgb_importance)[::-1][:5]:
    print(f"  {features[i]:20s}: {xgb_importance[i]:.4f}")

# ============================================================================
# Model 3: Neural Network (sklearn)
# ============================================================================
print("\n" + "=" * 80)
print("MODEL 3: NEURAL NETWORK (sklearn)")
print("=" * 80)

start = time.time()
nn = MLPClassifier(
    hidden_layer_sizes=(100, 50, 25),  # Deeper than JAX model
    activation='relu',
    solver='adam',
    learning_rate_init=0.001,
    max_iter=100,
    random_state=42,
    verbose=0
)

nn.fit(X_train_norm, y_train)
nn_time = time.time() - start

nn_train_acc = accuracy_score(y_train, nn.predict(X_train_norm))
nn_val_acc = accuracy_score(y_val, nn.predict(X_val_norm))

print(f"Training time: {nn_time:.2f}s")
print(f"Train accuracy: {nn_train_acc:.4f}")
print(f"Val accuracy: {nn_val_acc:.4f}")

# ============================================================================
# Voting Ensemble
# ============================================================================
print("\n" + "=" * 80)
print("VOTING ENSEMBLE (Soft Voting)")
print("=" * 80)

start = time.time()
ensemble = VotingClassifier(
    estimators=[
        ('rf', rf),
        ('xgb', xgb_model),
        ('nn', nn)
    ],
    voting='soft'  # Use predicted probabilities
)

# Already fitted, just need to predict
ensemble_val_preds = []
for model_name, model in ensemble.named_estimators_.items():
    ensemble_val_preds.append(model.predict_proba(X_val_norm))

# Average probabilities
ensemble_probs = np.mean(ensemble_val_preds, axis=0)
ensemble_preds = np.argmax(ensemble_probs, axis=1)

ensemble_train_acc = accuracy_score(y_train, 
    np.argmax(np.mean([m.predict_proba(X_train_norm) 
                       for _, m in ensemble.named_estimators_.items()], axis=0), axis=1))
ensemble_val_acc = accuracy_score(y_val, ensemble_preds)
ensemble_time = time.time() - start

print(f"Ensemble time: {ensemble_time:.2f}s")
print(f"Train accuracy: {ensemble_train_acc:.4f}")
print(f"Val accuracy: {ensemble_val_acc:.4f}")

# Detailed metrics for ensemble
print("\nDetailed Metrics (Validation Set):")
print(classification_report(y_val, ensemble_preds, 
                           target_names=['No Fire', 'Fire'], 
                           digits=4))

print("\nConfusion Matrix:")
cm = confusion_matrix(y_val, ensemble_preds)
print(f"  True Negatives:  {cm[0,0]:4d} | False Positives: {cm[0,1]:4d}")
print(f"  False Negatives: {cm[1,0]:4d} | True Positives:  {cm[1,1]:4d}")

# ============================================================================
# Model Comparison
# ============================================================================
print("\n" + "=" * 80)
print("MODEL COMPARISON")
print("=" * 80)

comparison = [
    ("Random Forest", rf_train_acc, rf_val_acc, rf_time),
    ("XGBoost", xgb_train_acc, xgb_val_acc, xgb_time),
    ("Neural Network", nn_train_acc, nn_val_acc, nn_time),
    ("Ensemble", ensemble_train_acc, ensemble_val_acc, ensemble_time),
]

print(f"{'Model':<20s} {'Train Acc':>10s} {'Val Acc':>10s} {'Time (s)':>10s}")
print("-" * 80)
for name, train_acc, val_acc, train_time in comparison:
    print(f"{name:<20s} {train_acc:>10.4f} {val_acc:>10.4f} {train_time:>10.2f}")

# ============================================================================
# Save Models
# ============================================================================
print("\n" + "=" * 80)
print("SAVING MODELS")
print("=" * 80)

output_dir = Path("results")

# Save individual models
with open(output_dir / "random_forest_model.pkl", "wb") as f:
    pickle.dump(rf, f)
print(f"✓ Saved: {output_dir / 'random_forest_model.pkl'}")

with open(output_dir / "xgboost_model.pkl", "wb") as f:
    pickle.dump(xgb_model, f)
print(f"✓ Saved: {output_dir / 'xgboost_model.pkl'}")

with open(output_dir / "neural_network_model.pkl", "wb") as f:
    pickle.dump(nn, f)
print(f"✓ Saved: {output_dir / 'neural_network_model.pkl'}")

# Save ensemble
with open(output_dir / "ensemble_model.pkl", "wb") as f:
    pickle.dump(ensemble, f)
print(f"✓ Saved: {output_dir / 'ensemble_model.pkl'}")

# Save normalization stats
with open(output_dir / "normalization_stats.pkl", "wb") as f:
    pickle.dump({'mean': mean, 'std': std}, f)
print(f"✓ Saved: {output_dir / 'normalization_stats.pkl'}")

print("\n" + "=" * 80)
print("ENSEMBLE TRAINING COMPLETE")
print("=" * 80)
print(f"\nBest Model: Ensemble (Val Acc: {ensemble_val_acc:.4f})")
print(f"Improvement over single models: {ensemble_val_acc - max(rf_val_acc, xgb_val_acc, nn_val_acc):.4f}")
