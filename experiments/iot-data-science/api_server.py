"""
FastAPI server for smoke detection inference.

Requirements:
    uv pip install fastapi uvicorn

Run:
    uv run uvicorn api_server:app --reload --host 0.0.0.0 --port 8000

Test:
    curl -X POST http://localhost:8000/predict \
      -H "Content-Type: application/json" \
      -d '{"Temperature[C]": 22.5, "Humidity[%]": 45.0, "TVOC[ppb]": 150, ...}'
"""

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from pathlib import Path
from typing import List, Optional
import equinox as eqx
import jax
import jax.numpy as jnp
import numpy as np

app = FastAPI(
    title="IoT Smoke Detection API",
    description="Real-time fire alarm prediction from sensor readings",
    version="1.0.0"
)

# Feature names in exact order used during training
FEATURE_NAMES = [
    "Temperature[C]", "Humidity[%]", "TVOC[ppb]", "eCO2[ppm]",
    "Raw H2", "Raw Ethanol", "Pressure[hPa]", "PM1.0", "PM2.5",
    "NC0.5", "NC1.0", "NC2.5", "CNT"
]

# Model architecture (must match training)
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

# Load model and normalization stats on startup
MODEL = None
MEAN = None
STD = None

@app.on_event("startup")
async def load_model():
    global MODEL, MEAN, STD
    
    print("Loading model...")
    model_path = Path("results/model_run_001.eqx")
    if not model_path.exists():
        raise RuntimeError(f"Model not found: {model_path}")
    
    MODEL = eqx.tree_deserialise_leaves(model_path, MLP(jax.random.PRNGKey(0)))
    
    # Load training data for normalization stats
    import polars as pl
    train_df = pl.read_csv("smoke_analysis/data/raw/train_dataset.csv")
    X_train = train_df.select(FEATURE_NAMES).to_numpy()
    
    MEAN = jnp.array(np.mean(X_train, axis=0))
    STD = jnp.array(np.std(X_train, axis=0)) + 1e-8
    
    print("Model loaded successfully!")
    print(f"  Mean: {MEAN[:3]}... (first 3 features)")
    print(f"  Std: {STD[:3]}... (first 3 features)")

# Request/Response models
class SensorReading(BaseModel):
    temperature_c: float = Field(..., alias="Temperature[C]", ge=-50, le=100)
    humidity_pct: float = Field(..., alias="Humidity[%]", ge=0, le=100)
    tvoc_ppb: float = Field(..., alias="TVOC[ppb]", ge=0)
    eco2_ppm: float = Field(..., alias="eCO2[ppm]", ge=0)
    raw_h2: float = Field(..., alias="Raw H2", ge=0)
    raw_ethanol: float = Field(..., alias="Raw Ethanol", ge=0)
    pressure_hpa: float = Field(..., alias="Pressure[hPa]", ge=800, le=1200)
    pm1_0: float = Field(..., alias="PM1.0", ge=0)
    pm2_5: float = Field(..., alias="PM2.5", ge=0)
    nc0_5: float = Field(..., alias="NC0.5", ge=0)
    nc1_0: float = Field(..., alias="NC1.0", ge=0)
    nc2_5: float = Field(..., alias="NC2.5", ge=0)
    cnt: float = Field(..., alias="CNT", ge=0)

    class Config:
        populate_by_name = True

class PredictionResponse(BaseModel):
    fire_alarm_prediction: int
    fire_probability: float
    confidence_level: str
    model_version: str = "1.0.0"

class BatchPredictionRequest(BaseModel):
    readings: List[SensorReading]

class BatchPredictionResponse(BaseModel):
    predictions: List[PredictionResponse]
    count: int

# Endpoints
@app.get("/")
async def root():
    return {
        "service": "IoT Smoke Detection API",
        "version": "1.0.0",
        "endpoints": {
            "/predict": "Single prediction",
            "/predict/batch": "Batch predictions",
            "/health": "Health check",
            "/docs": "API documentation"
        }
    }

@app.get("/health")
async def health():
    if MODEL is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    return {"status": "healthy", "model_loaded": True}

@app.post("/predict", response_model=PredictionResponse)
async def predict(reading: SensorReading):
    """Predict fire alarm from single sensor reading"""
    if MODEL is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    # Convert to array
    features = jnp.array([
        reading.temperature_c, reading.humidity_pct, reading.tvoc_ppb, reading.eco2_ppm,
        reading.raw_h2, reading.raw_ethanol, reading.pressure_hpa,
        reading.pm1_0, reading.pm2_5, reading.nc0_5, reading.nc1_0, reading.nc2_5,
        reading.cnt
    ], dtype=jnp.float32)
    
    # Normalize
    features_norm = (features - MEAN) / STD
    
    # Predict
    logits = MODEL(features_norm)
    probs = jax.nn.softmax(logits)
    prediction = int(jnp.argmax(probs))
    fire_prob = float(probs[1])
    
    # Confidence level
    if fire_prob >= 0.9 or fire_prob <= 0.1:
        confidence = "Very High"
    elif fire_prob >= 0.7 or fire_prob <= 0.3:
        confidence = "High"
    elif fire_prob >= 0.6 or fire_prob <= 0.4:
        confidence = "Medium"
    else:
        confidence = "Low"
    
    return PredictionResponse(
        fire_alarm_prediction=prediction,
        fire_probability=fire_prob,
        confidence_level=confidence
    )

@app.post("/predict/batch", response_model=BatchPredictionResponse)
async def predict_batch(request: BatchPredictionRequest):
    """Predict fire alarms for batch of sensor readings"""
    if MODEL is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    predictions = []
    for reading in request.readings:
        pred = await predict(reading)
        predictions.append(pred)
    
    return BatchPredictionResponse(
        predictions=predictions,
        count=len(predictions)
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
