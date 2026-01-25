# IoT Smoke Detection

Binary classification for smoke detection using JAX.

## Dataset

- **Train**: 5,000 samples × 14 features
- **Test**: 12,437 samples × 14 features
- **Features**: Temperature, Humidity, TVOC, eCO2, PM sensors, etc.
- **Target**: Fire Alarm (0=no fire, 1=fire)
- **Class balance**: 72% no fire, 28% fire

## Quick Start

```bash
# Install dependencies
uv pip install jax jaxlib equinox optax

# Train model
python train_simple.py
```

## Files

```
smoke_analysis/data/raw/
  ├── train_dataset.csv  # 5,000 labeled samples
  └── test_dataset.csv   # 12,437 unlabeled samples

train_simple.py          # Simple JAX training script (~200 lines)
```

## Model

- **Architecture**: MLP (13 → 64 → 32 → 2)
- **Loss**: Binary cross-entropy with class weights
- **Optimizer**: Adam (lr=1e-3)
- **Training**: 50 epochs, batch_size=64

Expected performance: ~95% accuracy on validation set.
