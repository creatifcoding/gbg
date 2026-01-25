# Modern Data Science Stack for IoT Smoke Detection

**Date:** 2024-12-16  
**Status:** ✅ Environment Created

---

## 🎯 Architecture Overview

```
CSV → DuckDB (ingest) → Polars (transform) → JAX (train) → DuckDB (metrics)
                ↓
            Parquet (features)
```

---

## 📦 Technology Stack

### **Data Layer**

- **DuckDB** - Embedded OLAP database (like SQLite for analytics)

  - SQL interface for feature engineering
  - Blazing fast on Parquet files
  - ACID transactions
  - Built-in time-series functions

- **Polars** - Rust-based DataFrame library

  - 5-10x faster than pandas
  - Lazy evaluation
  - Better memory efficiency
  - Cleaner API with method chaining

- **PyArrow** - Columnar format foundation
  - Zero-copy interop between systems
  - Efficient Parquet I/O

### **ML Framework**

- **JAX** - Functional ML with XLA compilation

  - Pure functional approach (composable, testable)
  - GPU/TPU ready
  - NumPy-like API
  - Built-in autodiff

- **Equinox** - Pythonic neural networks for JAX

  - PyTree-based models
  - Elegant functional style
  - Better than Flax for this use case

- **Optax** - Gradient descent optimizers
  - Adam, SGD, RMSProp, etc.
  - Composable transformations

### **Orchestration**

- **Prefect 3.0** - Modern workflow framework
  - Task caching
  - Deployments with cron
  - Work pools

### **Development**

- **Nix** - Reproducible environment
  - All packages from nixpkgs
  - No venv conflicts
  - `shell.nix` for isolated environment

---

## 🚀 Quick Start

### Enter the Environment

```bash
cd /path/to/iot-data-science
nix-shell shell.nix
```

### Install Missing Packages (if needed)

Some packages may not be in stable nixpkgs:

```bash
uv pip install equinox optax prefect
```

### Interactive DuckDB

```bash
duckdb smoke.db

-- Load CSV
CREATE TABLE smoke_data AS
SELECT * FROM read_csv('smoke_analysis/data/raw/train_dataset.csv');

-- Feature engineering with SQL
CREATE TABLE features AS
SELECT
  *,
  AVG("CNT") OVER (ORDER BY "UTC" ROWS BETWEEN 10 PRECEDING AND CURRENT ROW) as cnt_roll_mean_10,
  HOUR(epoch_ms("UTC" * 1000)) as hour_of_day,
  DAYOFWEEK(epoch_ms("UTC" * 1000)) as day_of_week
FROM smoke_data;

-- Export to Parquet
COPY features TO 'features.parquet' (FORMAT PARQUET);
```

### Polars Example

```python
import polars as pl

# Lazy loading (fast!)
df = pl.scan_csv("train_dataset.csv")

# Feature engineering
features = (
    df
    .with_columns([
        pl.col("CNT").rolling_mean(10).alias("cnt_roll_mean_10"),
        pl.from_epoch("UTC", time_unit="s").dt.hour().alias("hour"),
    ])
    .collect()  # Execute lazy operations
)

# Write Parquet
features.write_parquet("features.parquet")
```

### JAX + Equinox Model

```python
import jax
import jax.numpy as jnp
import equinox as eqx
import optax

# Define model
class SmokeDetector(eqx.Module):
    layers: list

    def __init__(self, key, input_dim=64, hidden_dim=128):
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

# Training
model = SmokeDetector(jax.random.PRNGKey(0))
optimizer = optax.adam(1e-3)
opt_state = optimizer.init(eqx.filter(model, eqx.is_inexact_array))

# Loss function
@eqx.filter_jit
def loss_fn(model, x, y):
    logits = jax.vmap(model)(x)
    return optax.softmax_cross_entropy_with_integer_labels(logits, y).mean()

# Train step
@eqx.filter_jit
def train_step(model, opt_state, x, y):
    loss, grads = eqx.filter_value_and_grad(loss_fn)(model, x, y)
    updates, opt_state = optimizer.update(grads, opt_state, model)
    model = eqx.apply_updates(model, updates)
    return model, opt_state, loss
```

---

## 🔧 Why This Stack?

### **Pandas → Polars**

- **10x faster** on typical operations
- **Better memory** efficiency
- **Rust-based** - minimal C extension issues
- **Modern API** - method chaining, lazy eval

### **Sklearn → JAX**

- **Functional** - easier to test, compose
- **Fast** - XLA compilation
- **Flexible** - build custom architectures
- **Future-proof** - GPU/TPU ready

### **CSV → DuckDB**

- **SQL interface** - declarative feature engineering
- **Fast analytics** - optimized for OLAP
- **Parquet native** - query without loading
- **ACID** - proper database semantics

### **Nix Environment**

- **Reproducible** - same environment everywhere
- **Isolated** - no global pollution
- **Declarative** - shell.nix documents everything
- **Clean** - no venv/C extension conflicts

---

## 📊 Comparison: Old vs New

| Feature          | Old Stack  | New Stack  | Speedup      |
| ---------------- | ---------- | ---------- | ------------ |
| **Data loading** | pandas     | Polars     | 5-10x        |
| **Aggregations** | pandas     | DuckDB SQL | 10-50x       |
| **Storage**      | CSV        | Parquet    | 3-5x smaller |
| **ML framework** | sklearn    | JAX        | GPU-ready    |
| **Environment**  | venv + pip | Nix        | Reproducible |

---

## 🎯 Pipeline Flow

### **Stage 1: Ingest**

```sql
-- DuckDB
CREATE TABLE raw_data AS
SELECT * FROM read_csv('train_dataset.csv');
```

### **Stage 2: Feature Engineering**

```sql
-- DuckDB SQL (blazing fast)
CREATE TABLE features AS
SELECT
  *,
  -- Rolling stats (time-series)
  AVG("CNT") OVER w10 as cnt_mean_10s,
  STDDEV("CNT") OVER w10 as cnt_std_10s,

  -- Temporal features
  HOUR(epoch_ms("UTC" * 1000)) as hour,
  DAYOFWEEK(epoch_ms("UTC" * 1000)) as dow,

  -- Rate of change
  "CNT" - LAG("CNT", 1) OVER time_order as cnt_diff
FROM raw_data
WINDOW
  w10 AS (ORDER BY "UTC" ROWS BETWEEN 10 PRECEDING AND CURRENT ROW),
  time_order AS (ORDER BY "UTC");
```

### **Stage 3: Export**

```sql
COPY features TO 'features.parquet' (FORMAT PARQUET);
```

### **Stage 4: Train (Python + JAX)**

```python
import polars as pl
import jax

# Load features (lazy!)
X = pl.scan_parquet("features.parquet").select(feature_cols).collect()
y = pl.scan_parquet("features.parquet").select("Fire Alarm").collect()

# JAX training loop
model = train_jax_model(X, y)
```

---

## 🐛 Environment Issues Resolved

### **Problem:** numpy import failures with Nix + venv + pandas

### **Solution:** Use Nix's pythonPackages directly (no venv)

**Old approach (broken):**

```bash
uv venv
uv pip install pandas numpy  # ❌ C extension conflicts
```

**New approach (clean):**

```nix
# shell.nix
(python311.withPackages (ps: with ps; [
  duckdb
  polars
  pyarrow
  jax
  jaxlib
]))
```

**Result:** No more numpy/pandas import errors!

---

## 📝 Next Steps

1. **Test environment** - Verify DuckDB + Polars + JAX imports
2. **Rewrite flow** - Convert pandas code to Polars
3. **Feature engineering** - Use DuckDB SQL for rolling stats
4. **Model training** - Implement JAX-based binary classifier
5. **Prefect integration** - Wire up as Prefect tasks

---

## 📚 Resources

- **DuckDB Docs**: https://duckdb.org/docs/
- **Polars Guide**: https://docs.pola.rs/
- **JAX Tutorial**: https://jax.readthedocs.io/
- **Equinox Docs**: https://docs.kidger.site/equinox/
- **Prefect 3.0**: https://docs.prefect.io/3.0/

---

**Created:** 2024-12-16  
**Author:** Val (Prime's architectural conscience)  
**Status:** Ready for implementation
